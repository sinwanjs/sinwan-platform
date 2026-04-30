# Reflect Patch & Design Keys

`@sinwan/meta` includes a zero-dependency Reflect metadata polyfill that
replaces the `reflect-metadata` npm package. Once installed, the global
`Reflect` object gains all the standard metadata APIs that TypeScript's
`emitDecoratorMetadata` expects.

---

## Two Ways to Install the Patch

### 1. Side-Effect Import (Recommended)

```ts
// app.ts — must be your very first import
import "@sinwan/meta/patch";
```

This calls `installMetadataPatch({ silent: true })` automatically.
The `silent` flag means it will **never throw** if `Reflect.metadata`
already exists (e.g. from another polyfill). It simply no-ops.

### 2. Explicit API Call

```ts
import { installMetadataPatch } from "@sinwan/meta";

installMetadataPatch();           // throws if Reflect metadata API already exists
installMetadataPatch({ silent: true });   // silently no-ops if already present
installMetadataPatch({ override: true }); // forcefully replaces existing APIs
```

---

## `installMetadataPatch(options?)`

Installs the polyfilled Reflect metadata APIs onto the global `Reflect`
object.

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `options.override` | `boolean` | `false` | If `true`, replaces any existing `Reflect.metadata` / `Reflect.defineMetadata` / etc. APIs. |
| `options.silent` | `boolean` | `false` | If `true`, silently no-ops instead of throwing when APIs already exist. |

**Behavior:**

1. Checks if `globalThis.Reflect` exists and is an object.
2. If the patch is already installed (internal flag), returns immediately.
3. If existing metadata APIs are detected and `override` is `false`:
   - Throws an error (or silently returns if `silent` is `true`).
4. Otherwise, installs all 9 APIs and sets an internal `__sinwanMetaPatched` flag.

---

## `isMetadataPatched()`

Returns `true` if the patch has been installed.

```ts
import { isMetadataPatched } from "@sinwan/meta";

console.log(isMetadataPatched()); // true or false
```

---

## Installed Reflect APIs

After the patch is installed, the global `Reflect` object provides these
methods. They match the [Reflect Metadata Proposal](https://rbuckton.github.io/reflect-metadata/)
specification.

> **Type note:** TypeScript doesn't type these by default. Cast `Reflect`
> to `any` or declare them in a `.d.ts` file.

```ts
const R = Reflect as any;
```

### `R.metadata(key, value)`

Returns a decorator that defines metadata on the decorated target.
This is what TypeScript's `emitDecoratorMetadata` calls internally.

```ts
// TypeScript emits this automatically when you use @decorators
// with emitDecoratorMetadata enabled:
R.metadata("design:paramtypes", [String, Number])(MyClass);
```

You generally **don't call this directly** — TypeScript generates these
calls for you.

---

### `R.defineMetadata(key, value, target, propertyKey?)`

Explicitly define metadata on a target.

```ts
class UserService {}

// Class-level
R.defineMetadata("version", 3, UserService);

// Method-level
R.defineMetadata("throttle", 100, UserService.prototype, "findAll");
```

---

### `R.getMetadata(key, target, propertyKey?)`

Read metadata, **walking the prototype chain** if not found on the target
itself.

```ts
class Base {}
class Child extends Base {}

R.defineMetadata("source", "base", Base);

R.getMetadata("source", Child);  // "base" (inherited)
R.getMetadata("source", Base);   // "base" (own)
```

---

### `R.getOwnMetadata(key, target, propertyKey?)`

Read metadata from the target **only** — does not walk the prototype
chain.

```ts
R.defineMetadata("source", "base", Base);

R.getOwnMetadata("source", Base);   // "base"
R.getOwnMetadata("source", Child);  // undefined (not inherited)
```

---

### `R.hasMetadata(key, target, propertyKey?)`

Check if metadata exists, **including inherited** metadata.

```ts
R.defineMetadata("flag", true, Base);

R.hasMetadata("flag", Base);   // true
R.hasMetadata("flag", Child);  // true (inherited)
```

---

### `R.hasOwnMetadata(key, target, propertyKey?)`

Check if metadata exists on the target **only**.

```ts
R.hasOwnMetadata("flag", Base);   // true
R.hasOwnMetadata("flag", Child);  // false
```

---

### `R.getMetadataKeys(target, propertyKey?)`

Return all metadata keys, **including inherited** ones.

```ts
R.defineMetadata("a", 1, Base);
R.defineMetadata("b", 2, Child);

R.getMetadataKeys(Child);  // ["b", "a"]
```

---

### `R.getOwnMetadataKeys(target, propertyKey?)`

Return metadata keys defined **only** on the target itself.

```ts
R.getOwnMetadataKeys(Child);  // ["b"]
R.getOwnMetadataKeys(Base);   // ["a"]
```

---

### `R.deleteMetadata(key, target, propertyKey?)`

Delete a metadata entry. Returns `true` if the key existed, `false`
otherwise.

```ts
R.defineMetadata("temp", "value", MyClass);
R.deleteMetadata("temp", MyClass);      // true
R.deleteMetadata("temp", MyClass);      // false (already deleted)
R.getMetadata("temp", MyClass);         // undefined
```

---

## Design Keys & Helpers

TypeScript's `emitDecoratorMetadata` stores type information under
specific keys. `@sinwan/meta` provides constants and helper functions to
read them.

### `DesignKeys`

```ts
import { DesignKeys } from "@sinwan/meta";

DesignKeys.paramTypes  // "design:paramtypes"
DesignKeys.returnType  // "design:returntype"
DesignKeys.type        // "design:type"
```

### `getParamTypes(target)`

Reads the constructor parameter types emitted by TypeScript.

```ts
import { getParamTypes } from "@sinwan/meta";

class Logger {}

class AppService {
  constructor(private logger: Logger) {}
}

getParamTypes(AppService);
// → [Logger]
```

> **Important:** This only works when `emitDecoratorMetadata: true` is
> enabled **and** the class has at least one decorator applied. TypeScript
> only emits `design:paramtypes` for decorated classes.

### `getReturnType(target, propertyKey)`

Reads the return type metadata of a method.

```ts
import { getReturnType } from "@sinwan/meta";

class MyController {
  @SomeDecorator()
  getUser(): Promise<User> {
    // ...
  }
}

getReturnType(MyController.prototype, "getUser");
// → Promise (the constructor, not the generic parameter)
```

### `getPropertyType(target, propertyKey)`

Reads the type metadata of a property.

```ts
import { getPropertyType } from "@sinwan/meta";

class Config {
  @SomeDecorator()
  host: string = "localhost";
}

getPropertyType(Config.prototype, "host");
// → String
```

---

## Prototype Chain Behavior

All `get*` and `has*` methods that walk the prototype chain are protected
by a **maximum depth of 100**. This prevents infinite loops in case of
circular prototype chains (e.g. via `Object.setPrototypeOf` abuse).

```
Object.prototype   ← depth 3
      ↑
  Base.prototype    ← depth 2
      ↑
  Child.prototype   ← depth 1  (start)
```

If metadata is found at any level, it's returned immediately (fast-path
optimization: own metadata is checked first before entering the loop).

---

## Error Handling

| Scenario | `silent: false` (default) | `silent: true` |
|---|---|---|
| `Reflect` not found | Throws `Error` | Returns silently |
| Metadata APIs already exist, `override: false` | Throws `Error` | Returns silently |
| Metadata APIs already exist, `override: true` | Replaces them | Replaces them |
| Non-object target passed to any API | Throws `TypeError` | Throws `TypeError` |
