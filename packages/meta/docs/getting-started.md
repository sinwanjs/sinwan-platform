# @sinwan/meta

Native metadata engine and Reflect patch for Bun. Zero dependency on
reflect-metadata. Includes a typed decorator API and a manager-style
metadata store.

## Install

```bash
bun add @sinwan/meta
```

## Setup

Enable decorators and metadata in your tsconfig:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Install the patch as the **first import** in your application entry point:

```ts
import "@sinwan/meta/patch";

import { sinwan } from "@sinwan/core";
```

> **Why first?** The patch installs polyfilled `Reflect.metadata`,
> `Reflect.defineMetadata`, and other APIs onto the global `Reflect` object.
> TypeScript's `emitDecoratorMetadata` compiler option emits calls to these
> APIs at class-definition time, so the patch **must** be active before any
> decorated class is loaded.

---

## Package Exports

`@sinwan/meta` ships two entry points:

| Import Path | Purpose |
|---|---|
| `@sinwan/meta` | Reflector API, `SetMetadata`, type helpers, design-key helpers, and patch utilities. |
| `@sinwan/meta/patch` | Side-effect import that installs the Reflect metadata patch automatically. |

### `@sinwan/meta`

```ts
import {
  // Runtime values
  reflector,          // Pre-instantiated Reflector singleton
  Reflector,          // The Reflector class (use static methods + instances)
  SetMetadata,        // Low-level decorator factory (string / Symbol keys)

  // Patch helpers
  DesignKeys,         // Constants: "design:paramtypes", "design:returntype", "design:type"
  installMetadataPatch,
  isMetadataPatched,
  getParamTypes,
  getReturnType,
  getPropertyType,

  // Types
  type CreateDecoratorOptions,
  type CreateDecoratorWithTransformOptions,
  type CustomDecorator,
  type MetaKey,
  type ReflectableDecorator,
  type ReflectorDecoratorFn,
  type InstallMetadataPatchOptions,
  type Type,
} from "@sinwan/meta";
```

### `@sinwan/meta/patch`

```ts
// Side-effect only — installs the patch in silent mode.
// No exports needed; just import it.
import "@sinwan/meta/patch";
```

---

## Quick Start

```ts
import "@sinwan/meta/patch";
import { Reflector, reflector, SetMetadata } from "@sinwan/meta";

// ─── 1. Strongly-typed decorator ────────────────────────
const Roles = Reflector.createDecorator<string[]>({ key: "roles" });

class UsersController {
  @Roles(["admin", "moderator"])
  deleteUser() {
    /* ... */
  }
}

// Read from a method
const roles = reflector.getFromMethod(
  Roles,
  UsersController.prototype,
  "deleteUser",
);
console.log(roles); // ["admin", "moderator"]

// ─── 2. Low-level string-key decorator ──────────────────
const Public = () => SetMetadata("isPublic", true);

@Public()
class HealthController {
  check() {
    return "ok";
  }
}

const isPublic = reflector.get<boolean>("isPublic", HealthController);
console.log(isPublic); // true

// ─── 3. Global Reflect API (installed by the patch) ─────
const R = Reflect as any;

R.defineMetadata("version", 2, HealthController);
console.log(R.getMetadata("version", HealthController)); // 2
```

---

## Next Steps

- [Reflector API](./reflector-api.md) — Typed decorators, reading metadata, merging.
- [SetMetadata](./set-metadata.md) — Low-level decorator factory.
- [Reflect Patch & Design Keys](./reflect-patch.md) — Global `Reflect` API and `design:*` helpers.
- [Types Reference](./types-reference.md) — All exported TypeScript types.
