# SetMetadata

`SetMetadata` is the low-level decorator factory for attaching metadata
to classes and methods using string or Symbol keys. It's the foundation
that `Reflector.createDecorator` is built on.

Use `SetMetadata` when you want quick, simple decorators without the
overhead of the typed `Reflector.createDecorator` API.

---

## Import

```ts
import { SetMetadata } from "@sinwan/meta";
```

---

## Signature

```ts
function SetMetadata<K extends MetaKey = string, V = any>(
  key: K,
  value: V,
): CustomDecorator;
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `key` | `string \| symbol` | The metadata key to store the value under. |
| `value` | `any` | The metadata value. If `null` or `undefined`, defaults to `{}`. |

**Returns:** `CustomDecorator` — a decorator that works on both classes
and methods.

---

## Usage

### Class-Level Metadata

```ts
const Public = () => SetMetadata("isPublic", true);

@Public()
class HealthController {
  check() {
    return "ok";
  }
}

// Read with reflector
import { reflector } from "@sinwan/meta";

reflector.get<boolean>("isPublic", HealthController); // true
```

### Method-Level Metadata

```ts
const CacheKey = (key: string) => SetMetadata("cacheKey", key);

class ProductsController {
  @CacheKey("products:list")
  list() {}

  @CacheKey("products:detail")
  getById() {}
}

// Read with reflector
reflector.getFromMethod<string>(
  "cacheKey",
  ProductsController.prototype,
  "list",
);
// → "products:list"
```

### Symbol Keys

Use Symbols for keys that should never collide with other metadata:

```ts
const RATE_LIMIT = Symbol("rateLimit");

const RateLimit = (rpm: number) => SetMetadata(RATE_LIMIT, rpm);

class ApiController {
  @RateLimit(100)
  search() {}
}

reflector.getFromMethod<number>(
  RATE_LIMIT,
  ApiController.prototype,
  "search",
);
// → 100
```

### Null / Undefined Values

If you pass `null` or `undefined` as the value, `SetMetadata` stores `{}`
instead. This ensures the metadata entry always exists and is truthy:

```ts
SetMetadata("flag", null)(MyClass);
reflector.get("flag", MyClass); // → {}

SetMetadata("flag", undefined)(MyClass);
reflector.get("flag", MyClass); // → {}
```

---

## Combining with Reflector

You can mix `SetMetadata` decorators with `Reflector.createDecorator`
decorators. They all write to the same underlying metadata store:

```ts
import { Reflector, reflector, SetMetadata } from "@sinwan/meta";

// Typed decorator
const Roles = Reflector.createDecorator<string[]>({ key: "roles" });

// String-key decorator
const Tags = (...tags: string[]) => SetMetadata("tags", tags);

@Roles(["admin"])
@Tags("v2", "experimental")
class FeatureController {}

reflector.get(Roles, FeatureController);           // ["admin"]
reflector.get<string[]>("tags", FeatureController); // ["v2", "experimental"]
```

---

## When to Use SetMetadata vs Reflector.createDecorator

| Feature | `SetMetadata` | `Reflector.createDecorator` |
|---|---|---|
| **Type safety** | Manual (`reflector.get<T>`) | Automatic (inferred from decorator generics) |
| **Key management** | You manage keys yourself | Auto-generated or custom via `options.key` |
| **Transform support** | No | Yes (`options.transform`) |
| **`.KEY` access** | No | Yes |
| **Best for** | Quick one-off decorators, dynamic keys | Reusable, strongly-typed decorators |
