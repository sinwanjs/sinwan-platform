const ROUTES_KEY = Symbol("sinwan:routes");
const CHANNELS_KEY = Symbol("sinwan:channels");
type RouteMetadata = {
  method: string; // HTTP method (GET, POST, etc.)
  path: string; // URL path
  handlerFn: string; // Handler function name
  guards: any[]; // List of guards
};

export class SinwanHttpDecorators {
  Controller(prefix: string = "") {
    return function (target: any) {
      Reflect.defineProperty(target, "prefix", { value: prefix });
      target.__prefix = prefix;
    };
  }

  Get(path: string) {
    return this.HttpMethod("GET", path);
  }

  Post(path: string) {
    return this.HttpMethod("POST", path);
  }

  Put(path: string) {
    return this.HttpMethod("PUT", path);
  }

  Delete(path: string) {
    return this.HttpMethod("DELETE", path);
  }

  Patch(path: string) {
    return this.HttpMethod("PATCH", path);
  }

  Guard(guardClass: any, priority = 10) {
    return function (target: any, propertyKey: string) {
      // Ensure the route entry exists
      if (!target[ROUTES_KEY]) target[ROUTES_KEY] = [];

      let route: RouteMetadata = target[ROUTES_KEY].find(
        (r: RouteMetadata) => r.handlerFn === propertyKey,
      );
      if (!route) {
        // Route decorator not yet applied — create placeholder
        route = { method: "", path: "", handlerFn: propertyKey, guards: [] };
        target[ROUTES_KEY].push(route);
      }
      route.guards.push({ handler: guardClass, priority });
    };
  }

  private HttpMethod(method: string, path: string) {
    return function (target: any, propertyKey: string) {
      if (!target[ROUTES_KEY]) target[ROUTES_KEY] = [];

      // Check if route already registered for this method (by @Guard being applied first)
      const existing: RouteMetadata = target[ROUTES_KEY].find(
        (r: RouteMetadata) =>
          r.handlerFn === propertyKey && r.method === method,
      );
      if (existing) {
        existing.path = path;
      } else {
        target[ROUTES_KEY].push({
          method,
          path,
          handlerFn: propertyKey,
          guards: [],
        });
      }
    };
  }
}
