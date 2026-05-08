// ─── Guard Types ──────────────────────────────────────────────────────────────

import type { ScopeOptions, VersionOptions } from "../../interfaces";

/**
 * Generic constructor type for DI-compatible guard classes.
 */
export type Type<T = any> = new (...args: any[]) => T;

/**
 * Contract that every guard class must implement.
 */
export interface IGuard {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

/**
 * Internal guard entry stored in route metadata.
 */
export interface GuardEntry {
  handler: Type<IGuard>;
  priority: number;
}

// ─── Route Metadata ───────────────────────────────────────────────────────────

export interface RouteMetadata {
  /** URL path e.g., "/users", "/products/:id", etc. */
  path?: string | string[];
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Handler method name */
  handlerName: string;
  /** List of guards before the request reaches the handler */
  guards: GuardEntry[];
}

// ─── Execution Context ────────────────────────────────────────────────────────

/**
 * Passed to guards at runtime. Extend this as your framework grows.
 */
export interface ExecutionContext {
  request: Request;
  response: Response;
  handler: Function;
}

/**
 * Interface defining options that can be passed to `@Controller()` decorator
 *
 * @publicApi
 */
export interface ControllerOptions extends ScopeOptions, VersionOptions {
  /**
   * Specifies an optional `route path prefix`.  The prefix is pre-pended to the
   * path specified in any request decorator in the class.
   *
   * Supported only by HTTP-based applications (does not apply to non-HTTP microservices).
   *
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   */
  path?: string | string[];

  /**
   * Specifies an optional HTTP Request host filter.  When configured, methods
   * within the controller will only be routed if the request host matches the
   * specified value.
   *
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   */
  host?: string | RegExp | Array<string | RegExp>;
}
