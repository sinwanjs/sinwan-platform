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

    this.setupInternalManagers();
    this.externalManagersReady = this.setupExternalManagers();
  }

  /**
   * Binds all internal (always-on) managers to their instance slots.
   *
   * Internal managers are imported statically at the top of this file and
   * are guaranteed to exist regardless of configuration. This method exists
   * as a discrete step so subclasses or test harnesses can override it to
   * swap in mock implementations.
   *
   * @internal
   */
  private setupInternalManagers(): void {
    this._cookiesManager = cookiesManager;
    this._errorManager = errorManager;
    this._eventManager = eventManager;
    this._eventbusManager = eventBusManager;
    this._iocManager = iocManager;
    this._lifecycleManager = lifecycleManager;
    this._pluginManager = pluginManager;
    this._requestManager = requestManager;
    this._responseManager = responseManager;
    this._routesManager = routesManager;
    this._sessionsManager = sessionsManager;
    this._storageManager = storageManager;
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

    const managerMethod = manager[methodName];
    if (typeof managerMethod === "function") {
      return (await managerMethod.apply(manager, args)) as T;
    }

    if (typeof manager.call === "function") {
      return (await manager.call<T>(methodName, ...args)) as T;
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

    // Wait for all enabled optional manager modules to finish dynamic import.
    await this.externalManagersReady;

    // ── Internal managers (fixed order, non-negotiable) ──────────────────
    await this._iocManager.init();
    await this._lifecycleManager.init();
    await this._pluginManager.init();
    await this._eventbusManager.init();
    await this._eventManager.init();
    await this._errorManager.init();
    await this._cookiesManager.init();
    await this._requestManager.init();
    await this._responseManager.init();
    await this._routesManager.init();
    await this._storageManager.init();
    await this._sessionsManager.init();

    // ── External managers (conditionally, in config-declaration order) ───
    if (this._openApiManager) await this._openApiManager.init();
    if (this._webSocketManager) await this._webSocketManager.init();
    if (this._tcpManager) await this._tcpManager.init();
    if (this._udpManager) await this._udpManager.init();
    if (this._graphqlManager) await this._graphqlManager.init();
    if (this._grpcManager) await this._grpcManager.init();
    if (this._jwtManager) await this._jwtManager.init();

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
    // ── External managers destroyed first ────────────────────────────────
    if (this._jwtManager) await this._jwtManager.destroy();
    if (this._grpcManager) await this._grpcManager.destroy();
    if (this._graphqlManager) await this._graphqlManager.destroy();
    if (this._tcpManager) await this._tcpManager.destroy();
    if (this._udpManager) await this._udpManager.destroy();
    if (this._webSocketManager) await this._webSocketManager.destroy();
    if (this._openApiManager) await this._openApiManager.destroy();

    // ── Internal managers destroyed in reverse init order ────────────────
    await this._sessionsManager.destroy();
    await this._storageManager.destroy();
    await this._routesManager.destroy();
    await this._responseManager.destroy();
    await this._requestManager.destroy();
    await this._cookiesManager.destroy();
    await this._errorManager.destroy();
    await this._eventManager.destroy();
    await this._eventbusManager.destroy();
    await this._pluginManager.destroy();
    await this._lifecycleManager.destroy();
    await this._iocManager.destroy();

    // ── All managers are stopped! ─────────────────────────────────────────
    this.logger.info(
      `${this.sinwanConfig.name || defaultSinwanConfig.name} stopped gracefully.`,
    );
  }
}
