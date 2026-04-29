import { SinwanApp, defaultSinwanConfig } from "./sinwan-app";
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
export interface SinwanConfig {
  /** The name of the application. Default: `"SinwanApp"`. */
  name?: string;
  /** Port number or named pipe for the HTTP server to listen on. Default: `3000`. */
  port?: number | string;

  /** Port number or named pipe for the gRPC server to listen on. Default: `50051`. */
  grpcPort?: number | string;

  /** Port number or named pipe for the GraphQL server to listen on. Default: `4000`. */
  tcpPort?: number | string;

  /** Port number or named pipe for the UDP server to listen on. Default: `4001`. */
  udpPort?: number | string;

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
   * as a dependency in the host project.
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
