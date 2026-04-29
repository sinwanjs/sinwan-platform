import {
  cookiesManager,
  errorManager,
  eventBusManager,
  eventManager,
  iocManager,
  lifecycleManager,
  pluginManager,
  requestManager,
  responseManager,
  routesManager,
  storageManager,
  sessionsManager,
} from "../managers";
import type {
  SinwanConfig,
  OptionalManager,
  OptionalManagerKey,
  OptionalManagerSlotMap,
} from "./types";
import { logger } from "@sinwan/logger";

/**
 * Maps each optional manager's internal property key to its:
 *  - `configKey`  : the key used in {@link SinwanConfig.managers} to enable it
 *  - `moduleName` : the npm package to dynamically import
 *
 * Extend this map to register new optional managers without touching
 * the core bootstrap logic — the setup loop reads from it automatically.
 *
 * @example
 * // To add a future @sinwan/smtp manager:
 * mapManagerKeyToModuleName["smtpManager"] = {
 *   configKey: "smtp",
 *   moduleName: "@sinwan/smtp",
 * };
 */
export const mapManagerKeyToModuleName: Record<
  string,
  { configKey: string; moduleName: string }
> = {
  openApiManager: { configKey: "openapi", moduleName: "@sinwan/openapi" },
  tcpManager: { configKey: "tcp", moduleName: "@sinwan/tcp" },
  udpManager: { configKey: "udp", moduleName: "@sinwan/udp" },
  webSocketManager: { configKey: "ws", moduleName: "@sinwan/ws" },
  graphqlManager: { configKey: "graphql", moduleName: "@sinwan/graphql" },
  grpcManager: { configKey: "grpc", moduleName: "@sinwan/grpc" },
  jwtManager: { configKey: "jwt", moduleName: "@sinwan/jwt" },
};

/**
 * Fallback configuration applied when the host application does not
 * provide a value.
 *
 * All optional managers are disabled by default so a vanilla `new SinwanApp({})`
 * starts with the smallest possible footprint.
 */
export const defaultSinwanConfig: SinwanConfig = {
  development: false,
  name: "sinwan",
  protocols: [
    { name: "http", port: 3000, hostname: "localhost" },
    { name: "grpc", port: 50051, hostname: "localhost" },
    { name: "tcp", port: 4000, hostname: "localhost" },
    { name: "udp", port: 4001, hostname: "localhost" },
  ],
  modules: [],
  managers: {
    ws: false,
    tcp: false,
    udp: false,
    graphql: false,
    grpc: false,
    jwt: false,
    openapi: false,
  },
};

/**
 * `SinwanApp` is the central kernel of the Sinwan framework.
 *
 * It bootstraps all internal managers unconditionally, then lazily loads
 * any optional external managers declared in the config. The constructor
 * is synchronous; async work (dynamic imports, manager `.start()` calls)
 * happens inside {@link SinwanApp.start}.
 *
 * ### Design constraints
 * - Managers are singletons shared across the entire application.
 * - The initialization order is fixed and intentional (see file header).
 * - External managers are loaded via `new Function("m", "return import(m)")`
 *   to preserve compatibility with bundlers that otherwise statically analyze
 *   and inline all `import()` calls, which would defeat the lazy-loading goal.
 */
export class SinwanApp {
  /** Logger instance with the "App" context. */
  private logger!: ReturnType<typeof logger>;

  /**
   * A runtime-constructed dynamic import function that bypasses static
   * analysis by bundlers (Webpack, esbuild, Rollup, etc.).
   *
   * Standard `import(moduleName)` calls are statically traced at build time,
   * which causes bundlers to attempt to resolve and bundle the module even
   * if it is only used conditionally. By wrapping the call in `new Function`,
   * the import string is invisible to the bundler's resolver and the package
   * is only fetched from the host's node_modules at runtime.
   *
   * @param moduleName - The npm package name to import (e.g. "@sinwan/jwt")
   * @returns A Promise resolving to the module's exports
   *
   * @internal
   */
  private runtimeImport = new Function("m", "return import(m)") as (
    moduleName: string,
  ) => Promise<any>;

  /** Resolved configuration (user config merged with defaults). */
  private sinwanConfig: SinwanConfig;

  /** Tracks completion of all optional manager dynamic imports. */
  private externalManagersReady!: Promise<void>;

  // ─── Internal manager slots ─────────────────────────────────────────────
  // These are always initialized — they form the non-negotiable core of every
  // Sinwan application regardless of configuration.
  // -------------------------------------------------------------------------

  /** Parses, signs, and verifies HTTP cookies on every request. */
  private _cookiesManager = cookiesManager;

  /** Catches unhandled errors and formats them into consistent HTTP responses. */
  private _errorManager = errorManager;

  /** Domain-event dispatcher — routes named events to their handlers. */
  private _eventManager = eventManager;

  /** In-process pub/sub bus for decoupled inter-manager communication. */
  private _eventbusManager = eventBusManager;

  /**
   * Inversion-of-Control container.
   * Manages dependency registration, resolution, and scoping (singleton /
   * transient / request-scoped).
   * Must be initialized first so all other managers can resolve their deps.
   */
  private _iocManager = iocManager;

  /**
   * Application lifecycle hooks manager.
   * Exposes `onStart`, `onStop`, `onReady`, and `onError` hooks that
   * plugins and user code can subscribe to.
   */
  private _lifecycleManager = lifecycleManager;

  /**
   * Plugin system manager.
   * Allows third-party code to hook into the framework by registering
   * middleware, route prefixes, custom managers, and lifecycle handlers
   * through a clean plugin API.
   */
  private _pluginManager = pluginManager;

  /**
   * Incoming HTTP request normalization layer.
   * Parses raw Node.js `IncomingMessage` objects into a rich, framework-
   * native Request model (body, query, params, headers, files, etc.).
   */
  private _requestManager = requestManager;

  /**
   * Outgoing HTTP response builder.
   * Provides helpers for JSON, HTML, redirect, streaming, and SSE responses
   * with automatic Content-Type negotiation.
   */
  private _responseManager = responseManager;

  /**
   * Route tree manager.
   * Compiles route definitions (path, method, middleware chain, handler) into
   * an efficient trie-based router. Supports parameter capture, wildcards,
   * and route groups.
   */
  private _routesManager = routesManager;

  /**
   * Session state manager.
   * Handles session creation, reading, mutation, and expiry. Delegates
   * persistence to the active storageManager adapter.
   */
  private _sessionsManager = sessionsManager;

  /**
   * Pluggable storage adapter manager.
   * Abstracts key-value and document storage behind a unified interface.
   * Ships with in-memory and file-system adapters; Redis, MongoDB, and
   * PostgreSQL adapters live in separate packages.
   */
  private _storageManager = storageManager;

  // ─── External (optional) manager slots ──────────────────────────────────
  // Each slot uses a shared lifecycle contract (`init` / `destroy`) so core
  // startup/shutdown remains type-safe even when concrete manager packages
  // are optional peer dependencies.
  // -------------------------------------------------------------------------

  /** OpenAPI 3.x spec generator and Swagger UI server. (@sinwan/openapi) */
  private _openApiManager?: OptionalManager;

  /** TCP raw socket transport manager for low-level network communication. (@sinwan/tcp) */
  private _tcpManager?: OptionalManager;

  /** UDP raw socket transport manager for connectionless network communication. (@sinwan/udp) */
  private _udpManager?: OptionalManager;

  /** WebSocket server manager for real-time bidirectional communication. (@sinwan/ws) */
  private _webSocketManager?: OptionalManager;

  /** GraphQL schema-first API manager with resolver auto-wiring. (@sinwan/graphql) */
  private _graphqlManager?: OptionalManager;

  /** gRPC service definition and server manager. (@sinwan/grpc) */
  private _grpcManager?: OptionalManager;

  /** JWT token generation, signing, and validation middleware. (@sinwan/jwt) */
  private _jwtManager?: OptionalManager;

  /**
   * Creates a new Sinwan application instance.
   *
   * The constructor is intentionally synchronous. It wires up all internal
   * managers immediately and starts resolving optional external managers.
   *
   * Call {@link SinwanApp.start} after construction to fully initialize every
   * manager in dependency order.
   *
   * @param sinwanConfig - Application configuration. Merged with
   *   {@link defaultSinwanConfig} so only the fields you need to override
   *   must be provided.
   */
  constructor(sinwanConfig: SinwanConfig) {
    this.sinwanConfig = {
      ...defaultSinwanConfig,
      ...sinwanConfig,
      managers: {
        ...defaultSinwanConfig.managers,
        ...sinwanConfig.managers,
      },
    };

    this.logger = logger({
      appName: this.sinwanConfig.name || defaultSinwanConfig.name!,
      context: "App",
    });

    // initializers above already assign every internal manager at class
    // instantiation time, so a second assignment inside a dedicated method
    // was pure dead work.
    this.externalManagersReady = this.setupExternalManagers();
  }

  /**
   * Iterates over the optional manager registry and kicks off a dynamic
   * import for each manager whose config flag is `true`.
   *
   * Import errors are caught per-manager and logged with context so a single
   * missing optional package does not crash the entire application.
   *
   * To add a new optional manager, register it in
   * {@link mapManagerKeyToModuleName} — no changes to this method are needed.
   *
   * @internal
   */
  private async setupExternalManagers(): Promise<void> {
    if (!this.sinwanConfig.managers) return;

    const loadPromises: Promise<void>[] = [];

    for (const [managerKey, { configKey, moduleName }] of Object.entries(
      mapManagerKeyToModuleName,
    )) {
      const isEnabled = (this.sinwanConfig.managers as Record<string, boolean>)[
        configKey
      ];

      if (isEnabled) {
        loadPromises.push(
          this.loadManager(managerKey as OptionalManagerKey, moduleName),
        );
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Dynamically imports a single external manager package and assigns it
   * to the corresponding private slot on this instance.
   *
   * Uses {@link SinwanApp.runtimeImport} to avoid static bundler analysis.
   * Falls back gracefully if the package is not installed — an error message
   * is emitted via `this.logger.error` so the developer is informed without
   * crashing the process.
   *
   * @param managerKey  - The private property name to assign to (e.g. `"_jwtManager"`)
   * @param moduleName  - The npm package to import (e.g. `"@sinwan/jwt"`)
   *
   * @internal
   */
  private async loadManager(
    managerKey: OptionalManagerKey,
    moduleName: string,
  ): Promise<void> {
    try {
      const mod = await this.runtimeImport(moduleName);

      // Modules may export via `.default` (ESM default export) or directly
      // as a named export matching the manager key. We prefer the named
      // export for explicitness; fall back to `.default` for interop.
      const resolvedManager = mod[managerKey] ?? mod.default ?? mod;
      if (!this.isOptionalManager(resolvedManager)) {
        this.logger.error(
          `Optional manager "${managerKey}" from "${moduleName}" does not implement init()/destroy().`,
        );
        return;
      }

      const slotKey = `_${managerKey}` as keyof OptionalManagerSlotMap;
      (this as unknown as OptionalManagerSlotMap)[slotKey] = resolvedManager;
    } catch (err) {
      this.logger.error(
        `Failed to load optional manager "${managerKey}" from "${moduleName}". ` +
          `Make sure to run this command: sinwan add ${moduleName}\n`,
        err,
      );
    }
  }

  private isOptionalManager(manager: unknown): manager is OptionalManager {
    if (
      !manager ||
      (typeof manager !== "object" && typeof manager !== "function")
    ) {
      return false;
    }

    const lifecycleManager = manager as Partial<OptionalManager>;
    return (
      typeof lifecycleManager.init === "function" &&
      typeof lifecycleManager.destroy === "function"
    );
  }

  /**
   * Calls any method exposed by an optional manager using a type-safe runtime
   * path, even when that method is not part of the shared OptionalManager
   * interface.
   */
  public async callOptionalManagerMethod<T = unknown>(
    managerKey: OptionalManagerKey,
    methodName: string,
    ...args: unknown[]
  ): Promise<T> {
    const slotKey = `_${managerKey}` as keyof OptionalManagerSlotMap;
    const manager = (this as unknown as OptionalManagerSlotMap)[slotKey];

    if (!manager) {
      throw new Error(`Optional manager "${managerKey}" is not available.`);
    }

    // FIX: removed the `manager.call` fallback — that resolved to
    // Function.prototype.call (a native JS method), not a custom dispatcher,
    // which would silently produce wrong behavior instead of a clear error.
    // If the requested method simply does not exist, we throw immediately.
    const managerMethod = (manager as Record<string, unknown>)[methodName];
    if (typeof managerMethod === "function") {
      return (await (managerMethod as Function).apply(manager, args)) as T;
    }

    throw new Error(
      `Method "${methodName}" is not available on optional manager "${managerKey}".`,
    );
  }

  /**
   * Initializes all managers in the prescribed dependency order.
   *
   * Must be called once after construction and awaited before the
   * application begins handling requests.
   *
   * Initialization order rationale:
   *  1. `iocManager`       — must be ready before any manager resolves deps
   *  2. `lifecycleManager` — hooks must exist before plugins register them
   *  3. `pluginManager`    — plugins may register routes, middleware, events
   *  4. `eventBusManager`  — required by eventManager for pub/sub routing
   *  5. `eventManager`     — domain events wired after bus is live
   *  6. `errorManager`     — error handlers registered before request flow
   *  7. `cookiesManager`   — needed by request and session managers
   *  8. `requestManager`   — normalizes incoming data before routing
   *  9. `responseManager`  — builder available before first route handler runs
   * 10. `routesManager`    — route tree compiled after all plugins are loaded
   * 11. `storageManager`   — storage ready before sessions need persistence
   * 12. `sessionsManager`  — last internal manager; depends on storage
   *
   * For external managers  — initialized after the full internal stack is live
   *
   * @example
   * const app = sinwan({ managers: { ws: true } });
   * await app.start();
   */
  async start(cb?: () => Promise<void>): Promise<void> {
    this.logger.banner();

    // Wrapped in try/catch — an unhandled rejection here would crash
    // the process with no useful context. Errors from individual managers
    // are already caught inside loadManager(), but a programming error in
    // setupExternalManagers() itself would otherwise be silent.
    try {
      await this.externalManagersReady;
    } catch (err) {
      this.logger.error("External managers setup failed", err);
      throw err;
    }

    // ── Internal managers ────────────────────────────────────────────────
    //
    // Managers that have no inter-dependency are initialized in
    // parallel using Promise.all (grouped into "waves"). This cuts cold-start
    // time significantly when individual init() calls involve I/O (DB
    // connections, file reads, port bindings, etc.).
    //
    // Wave 1 — foundation: IoC container must exist before everything else.
    await this._iocManager.init();

    // Wave 2 — lifecycle hooks must be registered before plugins run.
    await this._lifecycleManager.init();

    // Wave 3 — plugins may register routes/middleware/events; must run before
    //           the bus, event layer, and request pipeline are wired.
    await this._pluginManager.init();

    // Wave 4 — event bus must be live before the domain-event layer starts.
    await this._eventbusManager.init();

    // Wave 5 — errorManager and cookiesManager have no dependency on each
    //           other and can start together. eventManager requires the bus
    //           (wave 4) but not cookies or error handling.
    await Promise.all([
      this._eventManager.init(),
      this._errorManager.init(),
      this._cookiesManager.init(),
    ]);

    // Wave 6 — request and response managers are fully independent of each
    //           other; both depend on cookies (wave 5) being ready.
    await Promise.all([
      this._requestManager.init(),
      this._responseManager.init(),
    ]);

    // Wave 7 — route tree is compiled after all plugins (wave 3) and the full
    //           request pipeline (wave 6) are in place.
    await this._routesManager.init();

    // Wave 8 — storage must be ready before sessions can persist state.
    await this._storageManager.init();

    // Wave 9 — sessions are last: they depend on storage (wave 8).
    await this._sessionsManager.init();

    // ── External managers (conditionally, in config-declaration order) ───
    // Each external manager is independent of the others at this stage, so
    // all enabled ones start in parallel.
    await Promise.all([
      this._openApiManager?.init(),
      this._webSocketManager?.init(),
      this._tcpManager?.init(),
      this._udpManager?.init(),
      this._graphqlManager?.init(),
      this._grpcManager?.init(),
      this._jwtManager?.init(),
    ]);

    // ── All managers are live!
    // ── The Event "app:ready" emitted and a callback well called ─────────
    if (cb) {
      await cb();
    } else {
      this.logger.info(
        `${this.sinwanConfig.name || defaultSinwanConfig.name} started successfully!`,
      );
    }
  }

  /**
   * Gracefully shuts down all active managers in reverse initialization order
   * (LIFO — Last initialized, First Destroyed).
   *
   * Ensures that managers with dependencies are torn down before the
   * managers they depend on, preventing dangling references and unclosed
   * handles at process exit.
   *
   * @example
   * process.on("SIGTERM", async () => {
   *   await app.stop();
   *   process.exit(0);
   * });
   */
  async stop(): Promise<void> {
    // Each destroy() call is wrapped in a resilient helper.
    // Previously, a single manager throwing during shutdown would abort the
    // entire stop sequence, leaving all subsequent managers running and
    // potentially preventing a clean process exit. Now every manager is
    // given the chance to clean up regardless of what others do.
    const errors: unknown[] = [];

    const safeDestroy = async (
      manager: OptionalManager | undefined,
      name: string,
    ): Promise<void> => {
      if (!manager) return;
      try {
        await manager.destroy();
      } catch (err) {
        errors.push(err);
        this.logger.error(`Failed to destroy "${name}"`, err);
      }
    };

    // ── External managers destroyed first ────────────────────────────────
    await safeDestroy(this._jwtManager, "jwtManager");
    await safeDestroy(this._grpcManager, "grpcManager");
    await safeDestroy(this._graphqlManager, "graphqlManager");
    await safeDestroy(this._tcpManager, "tcpManager");
    await safeDestroy(this._udpManager, "udpManager");
    await safeDestroy(this._webSocketManager, "webSocketManager");
    await safeDestroy(this._openApiManager, "openApiManager");

    // ── Internal managers destroyed in reverse init order ────────────────
    await safeDestroy(this._sessionsManager, "sessionsManager");
    await safeDestroy(this._storageManager, "storageManager");
    await safeDestroy(this._routesManager, "routesManager");
    await safeDestroy(this._responseManager, "responseManager");
    await safeDestroy(this._requestManager, "requestManager");
    await safeDestroy(this._cookiesManager, "cookiesManager");
    await safeDestroy(this._errorManager, "errorManager");
    await safeDestroy(this._eventManager, "eventManager");
    await safeDestroy(this._eventbusManager, "eventbusManager");
    await safeDestroy(this._pluginManager, "pluginManager");
    await safeDestroy(this._lifecycleManager, "lifecycleManager");
    await safeDestroy(this._iocManager, "iocManager");

    // ── All managers are stopped! ─────────────────────────────────────────
    if (errors.length > 0) {
      this.logger.warn(
        `${this.sinwanConfig.name || defaultSinwanConfig.name} stopped with ${errors.length} manager(s) that failed to clean up — check logs above.`,
      );
    } else {
      this.logger.info(
        `${this.sinwanConfig.name || defaultSinwanConfig.name} stopped gracefully.`,
      );
    }
  }
}
