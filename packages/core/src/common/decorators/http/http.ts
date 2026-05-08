import {
  type RouteMetadata,
  type GuardEntry,
  type IGuard,
  type Type,
  type ControllerOptions,
} from "./types";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTES_METADATA,
  CONTROLLER_WATERMARK,
  HOST_METADATA,
  SCOPE_OPTIONS_METADATA,
  VERSION_METADATA,
  REDIRECT_METADATA,
  RENDER_METADATA,
  SSE_METADATA,
  HTTP_CODE_METADATA,
} from "../constants";
import { isString, isUndefined } from "../utils/shared.utils";
import { RequestMethod } from "../enums";

/**
 * Normalizes a route path input into a clean string.
 * - Empty string / empty array → "/"
 * - Array → joined with "/"
 * - Strips double slashes
 */
function normalizePath(path?: string | string[]): string {
  if (!path || (Array.isArray(path) && path.length === 0)) return "/";

  const raw = Array.isArray(path)
    ? path
        .map((p) => p.trim())
        .filter(Boolean)
        .join("/")
    : path.trim();

  if (!raw) return "/";

  const normalized = "/" + raw.replace(/^\/+/, "").replace(/\/+/g, "/");
  return normalized;
}

function buildHttpDecorator(
  method: RequestMethod,
  path?: string | string[],
): MethodDecorator {
  const normalizedPath = normalizePath(path);

  return (
    target: object,
    key: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    const handlerName = String(key);
    const routes =
      (Reflect.getMetadata(ROUTES_METADATA, target) as
        | RouteMetadata[]
        | undefined) ?? [];

    const existingIndex = routes.findIndex(
      (r) => r.handlerName === handlerName,
    );
    const existingRoute =
      existingIndex >= 0 ? routes[existingIndex] : undefined;

    const guards: GuardEntry[] = [...(existingRoute?.guards ?? [])];

    const nextRoute: RouteMetadata = {
      path: normalizedPath,
      method,
      handlerName,
      guards,
    };

    if (existingIndex >= 0) {
      routes[existingIndex] = nextRoute;
    } else {
      routes.push(nextRoute);
    }

    Reflect.defineMetadata(ROUTES_METADATA, routes, target);

    if (guards.length) {
      Reflect.defineMetadata(GUARDS_METADATA, guards, descriptor.value);
    }

    Reflect.defineMetadata(PATH_METADATA, normalizedPath, descriptor.value);
    Reflect.defineMetadata(METHOD_METADATA, method, descriptor.value);

    return descriptor;
  };
}

// ─── HTTP Method Decorators (namespace) ───────────────────────────────────────

/**
 * @sinwan/http route decorators.
 *
 * @example
 * import { Http } from "@sinwan/core";
 *
 * @Http.Get("/users")
 * getUsers() { ... }
 */
export namespace Http {
  /**
   * Decorator that marks a class as a Nest controller that can receive inbound
   * requests and produce responses.
   *
   * An HTTP Controller responds to inbound HTTP Requests and produces HTTP Responses.
   * It defines a class that provides the context for one or more related route
   * handlers that correspond to HTTP request methods and associated routes
   * for example `GET /api/profile`, `POST /users/resume`.
   *
   * A Microservice Controller responds to requests as well as events, running over
   * a variety of transports [(read more here)](https://docs.sinwanjs.com/microservices/basics).
   * It defines a class that provides a context for one or more message or event
   * handlers.
   *
   * @see [Controllers](https://docs.sinwanjs.com/controllers)
   * @see [Microservices](https://docs.sinwanjs.com/microservices/basics#request-response)
   *
   * @publicApi
   */
  export function Controller(): ClassDecorator;

  /**
   * Decorator that marks a class as a Nest controller that can receive inbound
   * requests and produce responses.
   *
   * An HTTP Controller responds to inbound HTTP Requests and produces HTTP Responses.
   * It defines a class that provides the context for one or more related route
   * handlers that correspond to HTTP request methods and associated routes
   * for example `GET /api/profile`, `POST /users/resume`.
   *
   * A Microservice Controller responds to requests as well as events, running over
   * a variety of transports [(read more here)](https://docs.sinwanjs.com/microservices/basics).
   * It defines a class that provides a context for one or more message or event
   * handlers.
   *
   * @param {string|Array} prefix string that defines a `route path prefix`.  The prefix
   * is pre-pended to the path specified in any request decorator in the class.
   *
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @see [Controllers](https://docs.sinwanjs.com/controllers)
   * @see [Microservices](https://docs.sinwanjs.com/microservices/basics#request-response)
   *
   * @publicApi
   */
  export function Controller(prefix: string | string[]): ClassDecorator;

  /**
   * Decorator that marks a class as a Nest controller that can receive inbound
   * requests and produce responses.
   *
   * An HTTP Controller responds to inbound HTTP Requests and produces HTTP Responses.
   * It defines a class that provides the context for one or more related route
   * handlers that correspond to HTTP request methods and associated routes
   * for example `GET /api/profile`, `POST /users/resume`.
   *
   * A Microservice Controller responds to requests as well as events, running over
   * a variety of transports [(read more here)](https://docs.sinwanjs.com/microservices/basics).
   * It defines a class that provides a context for one or more message or event
   * handlers.
   *
   * @param {object} options configuration object specifying:
   *
   * - `scope` - symbol that determines the lifetime of a Controller instance.
   * [See Scope](https://docs.sinwanjs.com/fundamentals/injection-scopes#usage) for
   * more details.
   * - `prefix` - string that defines a `route path prefix`.  The prefix
   * is pre-pended to the path specified in any request decorator in the class.
   * - `version` - string, array of strings, or Symbol that defines the version
   * of all routes in the class. [See Versioning](https://docs.sinwanjs.com/techniques/versioning)
   * for more details.
   *
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @see [Controllers](https://docs.sinwanjs.com/controllers)
   * @see [Microservices](https://docs.sinwanjs.com/microservices/basics#request-response)
   * @see [Versioning](https://docs.sinwanjs.com/techniques/versioning)
   *
   * @publicApi
   */
  export function Controller(options: ControllerOptions): ClassDecorator;

  /**
   * Decorator that marks a class as a Nest controller that can receive inbound
   * requests and produce responses.
   *
   * An HTTP Controller responds to inbound HTTP Requests and produces HTTP Responses.
   * It defines a class that provides the context for one or more related route
   * handlers that correspond to HTTP request methods and associated routes
   * for example `GET /api/profile`, `POST /users/resume`
   *
   * A Microservice Controller responds to requests as well as events, running over
   * a variety of transports [(read more here)](https://docs.sinwanjs.com/microservices/basics).
   * It defines a class that provides a context for one or more message or event
   * handlers.
   *
   * @param prefixOrOptions a `route path prefix` or a `ControllerOptions` object.
   * A `route path prefix` is pre-pended to the path specified in any request decorator
   * in the class. `ControllerOptions` is an options configuration object specifying:
   * - `scope` - symbol that determines the lifetime of a Controller instance.
   * [See Scope](https://docs.sinwanjs.com/fundamentals/injection-scopes#usage) for
   * more details.
   * - `prefix` - string that defines a `route path prefix`.  The prefix
   * is pre-pended to the path specified in any request decorator in the class.
   * - `version` - string, array of strings, or Symbol that defines the version
   * of all routes in the class. [See Versioning](https://docs.sinwanjs.com/techniques/versioning)
   * for more details.
   *
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @see [Controllers](https://docs.sinwanjs.com/controllers)
   * @see [Microservices](https://docs.sinwanjs.com/microservices/basics#request-response)
   * @see [Scope](https://docs.sinwanjs.com/fundamentals/injection-scopes#usage)
   * @see [Versioning](https://docs.sinwanjs.com/techniques/versioning)
   *
   * @publicApi
   */
  export function Controller(
    prefixOrOptions?: string | string[] | ControllerOptions,
  ): ClassDecorator {
    const defaultPath = "/";

    const [path, host, scopeOptions, versionOptions] = isUndefined(
      prefixOrOptions,
    )
      ? [defaultPath, undefined, undefined, undefined]
      : isString(prefixOrOptions) || Array.isArray(prefixOrOptions)
        ? [prefixOrOptions, undefined, undefined, undefined]
        : [
            prefixOrOptions.path || defaultPath,
            prefixOrOptions.host,
            { scope: prefixOrOptions.scope, durable: prefixOrOptions.durable },
            Array.isArray(prefixOrOptions.version)
              ? Array.from(new Set(prefixOrOptions.version))
              : prefixOrOptions.version,
          ];

    return (target: object) => {
      Reflect.defineMetadata(CONTROLLER_WATERMARK, true, target);
      Reflect.defineMetadata(PATH_METADATA, path, target);
      Reflect.defineMetadata(HOST_METADATA, host, target);
      Reflect.defineMetadata(SCOPE_OPTIONS_METADATA, scopeOptions, target);
      Reflect.defineMetadata(VERSION_METADATA, versionOptions, target);
    };
  }

  /**
   * Redirects request to the specified URL.
   *
   * @publicApi
   */
  export function Redirect(url = "", statusCode?: number): MethodDecorator {
    return (
      target: object,
      key: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ) => {
      Reflect.defineMetadata(
        REDIRECT_METADATA,
        { statusCode, url },
        descriptor.value,
      );
      return descriptor;
    };
  }

  /**
   * Route handler method Decorator.  Defines a template to be rendered by the controller.
   *
   * For example: `@Render('index')`
   *
   * @param template name of the render engine template file
   *
   * @see [Model-View-Controller](https://docs.sinwanjs.com/techniques/mvc)
   *
   * @publicApi
   */
  export function Render(template: string): MethodDecorator {
    return (
      target: object,
      key: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ) => {
      Reflect.defineMetadata(RENDER_METADATA, template, descriptor.value);
      return descriptor;
    };
  }

  /**
   * Declares this route as a Server-Sent-Events endpoint
   *
   * @publicApi
   */
  export function Sse(
    path?: string,
    options: { [METHOD_METADATA]?: RequestMethod } = {
      [METHOD_METADATA]: RequestMethod.GET,
    },
  ): MethodDecorator {
    return (
      target: object,
      key: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ) => {
      path = path && path.length ? path : "/";

      Reflect.defineMetadata(PATH_METADATA, path, descriptor.value);
      Reflect.defineMetadata(
        METHOD_METADATA,
        options[METHOD_METADATA],
        descriptor.value,
      );
      Reflect.defineMetadata(SSE_METADATA, true, descriptor.value);
      return descriptor;
    };
  }

  /**
   * Request method Decorator.  Defines the HTTP response status code.  Overrides
   * default status code for the decorated request method.
   *
   * @param statusCode HTTP response code to be returned by route handler.
   *
   * @see [Http Status Codes](https://docs.sinwanjs.com/controllers#status-code)
   *
   * @publicApi
   */
  export function Code(statusCode: number): MethodDecorator {
    return (
      target: object,
      key: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ) => {
      Reflect.defineMetadata(HTTP_CODE_METADATA, statusCode, descriptor.value);
      return descriptor;
    };
  }

  /**
   * Route guard (method) Decorator. Registers a guard for the handler.
   *
   * @param guard  - Guard class implementing `IGuard`
   * @param priority - Execution priority (lower = earlier). Default: 10
   *
   * @publicApi
   */
  export function Guard(guard: Type<IGuard>, priority = 10): MethodDecorator {
    return (
      target: object,
      key: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ) => {
      const handlerName = String(key);
      const routes =
        (Reflect.getMetadata(ROUTES_METADATA, target) as
          | RouteMetadata[]
          | undefined) ?? [];

      let route = routes.find((r) => r.handlerName === handlerName);

      if (!route) {
        route = {
          path: "/",
          method: RequestMethod.GET,
          handlerName,
          guards: [],
        };
        routes.push(route);
      }

      const guardEntry: GuardEntry = { handler: guard, priority };
      route.guards = [...(route.guards ?? []), guardEntry];

      Reflect.defineMetadata(ROUTES_METADATA, routes, target);

      const methodGuards =
        (Reflect.getMetadata(GUARDS_METADATA, descriptor.value) as
          | GuardEntry[]
          | undefined) ?? [];
      methodGuards.push(guardEntry);
      Reflect.defineMetadata(GUARDS_METADATA, methodGuards, descriptor.value);

      return descriptor;
    };
  }

  /**
   * Routes HTTP GET requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Get(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.GET, path);
  }

  /**
   * Routes HTTP POST requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Post(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.POST, path);
  }

  /**
   * Routes HTTP PUT requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Put(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.PUT, path);
  }

  /**
   * Routes HTTP DELETE requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Delete(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.DELETE, path);
  }

  /**
   * Routes HTTP PATCH requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Patch(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.PATCH, path);
  }

  /**
   * Routes HTTP OPTIONS requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Options(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.OPTIONS, path);
  }

  /**
   * Routes HTTP HEAD requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Head(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.HEAD, path);
  }

  /**
   * Routes all HTTP requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function All(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.ALL, path);
  }

  /**
   * Routes HTTP SEARCH requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Search(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.SEARCH, path);
  }

  /**
   * Routes WebDAV PROPFIND requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Propfind(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.PROPFIND, path);
  }

  /**
   * Routes WebDAV PROPPATCH requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Proppatch(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.PROPPATCH, path);
  }

  /**
   * Routes WebDAV MKCOL requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Mkcol(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.MKCOL, path);
  }

  /**
   * Routes WebDAV COPY requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Copy(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.COPY, path);
  }

  /**
   * Routes WebDAV MOVE requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Move(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.MOVE, path);
  }

  /**
   * Routes WebDAV LOCK requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Lock(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.LOCK, path);
  }

  /**
   * Routes WebDAV UNLOCK requests to the specified path.
   * @see [Routing](https://docs.sinwanjs.com/controllers#routing)
   * @publicApi
   */
  export function Unlock(path?: string | string[]): MethodDecorator {
    return buildHttpDecorator(RequestMethod.UNLOCK, path);
  }
}
