import {
  SinwanApp,
  defaultSinwanConfig,
  mapManagerKeyToModuleName,
} from "./sinwan-app";
/**
 * Top-level configuration object passed to {@link SinwanApp}.
 *
 * All fields are optional. Omitted fields fall back to the defaults
 * defined in {@link defaultSinwanConfig}.
 *
 * @example
 * ```ts
 * const app = sinwan({
 *   port: 8080,
 *   grpcPort: 50051,
 *   tcpPort: 4000,
 *   udpPort: 4001,
 *   modules: [SinwanModule, ProductModule, UserModule],
 *   managers: {
 *     ws: true,       // enable WebSocket support
 *     jwt: true,     // enable JWT middleware
 *     ...           // other managers are disabled by default
 *   },
 * });
 * ```
 */

interface ProtocolConfig {
  /** The protocol name, e.g. "http", "grpc", "tcp", "udp", etc. */
  name: "http" | "grpc" | "tcp" | "udp";
  /** The port number or named pipe to listen on for this protocol. */
  port: number | string;
  /** Additional options specific to the protocol manager, if any. */
  hostname?: string;
}

export interface SinwanConfig {
  /** Enable development mode with hot-reloading and verbose logging. Default: `false`. */
  development?: boolean;

  /** The name of the application. Default: `"SinwanApp"`. */
  name?: string;

  /**
   * Protocols to listen on.
   *
   * Default:
   * ```ts
   * [
   *   { name: "http", port: 3000, hostname: "localhost" },
   *   { name: "grpc", port: 50051, hostname: "localhost" },
   *   { name: "tcp", port: 4000, hostname: "localhost" },
   *   { name: "udp", port: 4001, hostname: "localhost" },
   * ]
   * ```
   *
   * Each item defines:
   * - `name`: the protocol name (`"http"`, `"grpc"`, `"tcp"`, `"udp"`)
   * - `port`: the port number or named pipe to bind to
   * - `hostname`: optional host name to bind to
   *
   * Use this option to enable only the transports you need and customize
   * their settings when required.
   *
   * @example
   * ```ts
   * const app = sinwan({
   *   protocols: [
   *     { name: "http", port: 8080, hostname: "localhost" },
   *     { name: "grpc", port: 50051, hostname: "localhost" },
   *   ],
   * });
   * ```
   */
  protocols?: ProtocolConfig[];

  /**
   * Unix domain socket path to listen on.
   *
   * Examples:
   * - `"/tmp/my-socket.sock"` for a filesystem-backed Unix domain socket
   * - `"\0my-abstract-socket"` for a Linux abstract namespace socket
   *
   * Abstract namespace sockets are not bound to the filesystem and are
   * automatically removed when the last reference to the socket is closed.
   */
  unix?: string;

  /**
   * Idle timeout in seconds for connections. Default: `10`.
   *
   * By default, connections are closed after this duration of inactivity.
   * A connection is considered idle when there is no data being sent or received —
   * this includes in-flight requests where the handler is still running but
   * hasn't written any bytes to the response yet.
   *
   * The maximum value is 255, and 0 disables the timeout entirely.
   *
   * For long-lived streams, disable the timeout for that request with `server.timeout(req, 0)`.
   *
   * @example
   * ```ts
   * const app = sinwan({
   *   idleTimeout: 30, // 30 seconds
   * });
   * ```
   */
  idleTimeout?: number;

  /** The main entry point of modules to load at startup. Default: `[]`.
   * @example
   * ```ts
   * const app = sinwan({
   *   modules: [SinwanModule, ProductModule, UserModule],
   * });
   * ```
   */
  modules?: any[];

  /**
   * Feature flags for optional external managers.
   *
   * Setting a flag to `true` causes the corresponding `@sinwan/*` package
   * to be dynamically imported at startup. The package must be installed
   * as a dependency in the host project, or use the sinwan CLI to install it automatically
   * with the sinwan add `@sinwan/<package>` command, which automatically sets the flag to `true`
   * in the managers object for the corresponding package.
   *
   * Setting a flag to `false` (or omitting it) means that manager is
   * never loaded and adds zero overhead to the bundle.
   */
  managers?: {
    /** Enable WebSocket server (@sinwan/ws) */
    ws?: boolean;
    /** Enable TCP/UDP raw transport (@sinwan/tsp) */
    tcp?: boolean;
    /** Enable UDP raw transport (@sinwan/udp) */
    udp?: boolean;
    /** Enable GraphQL schema endpoint (@sinwan/graphql) */
    graphql?: boolean;
    /** Enable gRPC service definitions (@sinwan/grpc) */
    grpc?: boolean;
    /** Enable JWT token middleware (@sinwan/jwt) */
    jwt?: boolean;
    /** Enable OpenAPI spec generation and Swagger UI (@sinwan/openapi) */
    openapi?: boolean;
  };
}

/**
 * Shared runtime contract for optional managers loaded by `SinwanApp`.
 *
 * `call` is a generic optional entrypoint that lets optional manager packages
 * expose a unified invocation API for custom operations while keeping
 * `SinwanApp` decoupled from package-specific method names.
 *
 * @example
 * class SinwanJwtManager implements OptionalManager {
 *   async init() {}
 *   async destroy() {}
 *
 *   async call(methodName: string, ...args: unknown[]) {
 *     if (methodName === "sign") return this.sign(args[0]);
 *     if (methodName === "verify") return this.verify(args[0]);
 *     throw new Error(`Unknown method: ${methodName}`);
 *   }
 * }
 */
export interface OptionalManager {
  init(): Promise<void> | void;
  destroy(): Promise<void> | void;
  call?<T = unknown>(methodName: string, ...args: unknown[]): Promise<T> | T;
  // Escape hatch for manager-specific APIs not declared in this shared contract.
  [memberName: string]: any;
}

export type OptionalManagerSlotMap = {
  [K in OptionalManagerKey as `_${K}`]?: OptionalManager;
};

export type OptionalManagerKey = keyof typeof mapManagerKeyToModuleName;
