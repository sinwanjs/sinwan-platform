# Reflector API

The Reflector is the primary way to create and read typed decorators in
`@sinwan/meta`. It replaces manual `Reflect.getMetadata` calls with a
fully type-safe API.

---

## Imports

```ts
import { Reflector, reflector } from "@sinwan/meta";
```

| Export | Description |
|---|---|
| `Reflector` | The class itself. Use its **static** method `createDecorator` to build decorators. Instantiate it (or use the singleton) to read metadata. |
| `reflector` | A pre-instantiated singleton of `Reflector`. Ready to use. |

---

## Creating Decorators

### `Reflector.createDecorator<TParam>(options?)`

Creates a strongly-typed, reflectable decorator.

```ts
const Roles = Reflector.createDecorator<string[]>();
```

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `options.key` | `string` | Auto-generated 21-char random key | A custom metadata key. Useful for debugging or cross-module lookups. |
| `options.transform` | `(value: TParam) => TTransformed` | — | An optional transform function applied to the decorator value before storage. |

**Returns:** `ReflectableDecorator<TParam, TTransformed>` — a callable
decorator factory with a `.KEY` property.

### Basic Example

```ts
const Roles = Reflector.createDecorator<string[]>({ key: "roles" });

// Roles.KEY === "roles"

@Roles(["admin"])
class AdminController {
  @Roles(["superadmin"])
  dangerousAction() {}
}
```

### With Transform

```ts
const Tags = Reflector.createDecorator<string[], Set<string>>({
  key: "tags",
  transform: (tags) => new Set(tags),
});

@Tags(["alpha", "beta", "alpha"])
class MyService {}

// reflector.get(Tags, MyService) → Set(["alpha", "beta"])
```

### Auto-Generated Keys

When you omit `options.key`, a cryptographically random 21-character key
is generated using `crypto.getRandomValues()`. This guarantees uniqueness
even across large codebases.

```ts
const Internal = Reflector.createDecorator<boolean>();

console.log(Internal.KEY); // e.g. "kR3xZm9pLwQn7vYfA2bTc"
```

---

## Reading Metadata

All read methods are available on both the `reflector` singleton and any
`new Reflector()` instance.

### `reflector.get(decoratorOrKey, target)`

Read class-level metadata.

```ts
const Roles = Reflector.createDecorator<string[]>();

@Roles(["user"])
class UserController {}

// With a decorator (fully typed return)
const roles = reflector.get(Roles, UserController);
// → string[] | undefined → ["user"]

// With a string key
const raw = reflector.get<string[]>("roles", UserController);
// → string[] | undefined
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `decoratorOrKey` | `ReflectableDecorator<any>` or `MetaKey` | The decorator or a string/symbol key. |
| `target` | `Type<any>` or `Function` | The class or constructor function. |

**Returns:** The stored metadata value, or `undefined`.

> **Note:** When passing a `ReflectableDecorator`, the return type is
> automatically inferred from the decorator's generic parameters. When
> passing a raw string key, you should specify the type explicitly:
> `reflector.get<MyType>(key, target)`.

---

### `reflector.getFromMethod(decoratorOrKey, target, propertyKey)`

Read method-level (property-level) metadata.

```ts
const CacheTTL = Reflector.createDecorator<number>();

class ProductsController {
  @CacheTTL(60)
  list() {}
}

const ttl = reflector.getFromMethod(
  CacheTTL,
  ProductsController.prototype,
  "list",
);
// → 60
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `decoratorOrKey` | `any` | The decorator or a string/symbol key. |
| `target` | `object` | The prototype or object that owns the method. |
| `propertyKey` | `string \| symbol` | The method or property name. |

**Returns:** `T | undefined`

---

### `reflector.getAll(decoratorOrKey, targets)`

Read metadata from multiple targets and return the raw array of results.

```ts
const Flag = Reflector.createDecorator<boolean>();

@Flag(true)
class A {}

class B {} // no metadata

@Flag(false)
class C {}

const results = reflector.getAll(Flag, [A, B, C]);
// → [true, undefined, false]
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `decoratorOrKey` | `ReflectableDecorator` or `MetaKey` | The decorator or key. |
| `targets` | `(Type<any> \| Function)[]` | Array of classes to inspect. |

**Returns:** An array with one entry per target.

---

### `reflector.getAllAndMerge(decoratorOrKey, targets)`

Read metadata from multiple targets and **merge** the results:

- **Arrays** are concatenated.
- **Objects** are shallow-merged (`{ ...a, ...b }`).
- **Primitives** are collected into an array.

```ts
const Permissions = Reflector.createDecorator<string[]>();

@Permissions(["read"])
class Base {}

@Permissions(["write", "delete"])
class Admin extends Base {}

const merged = reflector.getAllAndMerge(Permissions, [
  Admin,
  Base,
]);
// → ["write", "delete", "read"]
```

```ts
const Config = Reflector.createDecorator<Record<string, any>>();

@Config({ host: "localhost" })
class DbConfig {}

@Config({ port: 5432 })
class ConnConfig {}

const merged = reflector.getAllAndMerge(Config, [DbConfig, ConnConfig]);
// → { host: "localhost", port: 5432 }
```

---

### `reflector.getAllAndOverride(decoratorOrKey, targets)`

Return the **first defined** metadata value from the targets array.
Useful for "most-specific-wins" resolution patterns.

```ts
const Timeout = Reflector.createDecorator<number>();

@Timeout(5000)
class GlobalDefaults {}

@Timeout(1000)
class FastEndpoint {}

class NoTimeout {}

// FastEndpoint comes first → returns 1000
reflector.getAllAndOverride(Timeout, [FastEndpoint, GlobalDefaults]);
// → 1000

// NoTimeout has no metadata → skips to GlobalDefaults → returns 5000
reflector.getAllAndOverride(Timeout, [NoTimeout, GlobalDefaults]);
// → 5000

// Neither target has metadata → undefined
reflector.getAllAndOverride(Timeout, [NoTimeout]);
// → undefined
```

---

### `reflector.has(decoratorOrKey, target)`

Check whether metadata exists for a given key on a target (including
inherited metadata via prototype chain).

```ts
const Cacheable = Reflector.createDecorator<boolean>();

@Cacheable(true)
class Parent {}

class Child extends Parent {}

reflector.has(Cacheable, Parent); // true
reflector.has(Cacheable, Child);  // true (inherited)
```

---

## Accessing the Metadata Key

Every decorator created via `Reflector.createDecorator` exposes its
internal metadata key via `.KEY`:

```ts
const MyDecorator = Reflector.createDecorator<string>({ key: "my-key" });

console.log(MyDecorator.KEY); // "my-key"

// This lets you use the key directly with lower-level APIs:
const R = Reflect as any;
R.defineMetadata(MyDecorator.KEY, "manual-value", SomeClass);
```

---

## Full Example: Guard Pattern

```ts
import "@sinwan/meta/patch";
import { Reflector, reflector } from "@sinwan/meta";

// 1. Create decorators
const Roles = Reflector.createDecorator<string[]>({ key: "roles" });
const Public = Reflector.createDecorator<boolean>({ key: "isPublic" });

// 2. Apply to controllers
@Roles(["user"])
class OrdersController {
  @Public(true)
  getStatus() {}

  @Roles(["admin"])
  cancelOrder() {}
}

// 3. Read in a guard
function canActivate(
  controllerClass: Function,
  methodName: string,
): boolean {
  const handler = Object.getOwnPropertyDescriptor(
    controllerClass.prototype,
    methodName,
  )?.value;

  if (!handler) return false;

  // Check if route is public
  const isPublic = reflector.getAllAndOverride(Public, [
    handler,
    controllerClass,
  ]);
  if (isPublic) return true;

  // Check required roles
  const requiredRoles = reflector.getAllAndMerge(Roles, [
    handler,
    controllerClass,
  ]);

  const userRoles = ["user"]; // from auth context
  return requiredRoles.some((role: string) => userRoles.includes(role));
}

canActivate(OrdersController, "getStatus");   // true  (public)
canActivate(OrdersController, "cancelOrder");  // false (needs admin)
```
