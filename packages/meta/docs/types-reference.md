# Types Reference

All TypeScript types exported from `@sinwan/meta`.

---

## `MetaKey`

```ts
type MetaKey = string | symbol;
```

The type for metadata keys used throughout the package. Both string and
Symbol keys are supported.

```ts
// String key
SetMetadata("myKey", value);

// Symbol key
const MY_KEY = Symbol("myKey");
SetMetadata(MY_KEY, value);
```

---

## `Type<T>`

```ts
type Type<T = any> = new (...args: any[]) => T;
```

Represents a class constructor. Used in reflector method signatures to
accept class references.

```ts
function getMetadata<T>(target: Type<T>) {
  return reflector.get(SomeDecorator, target);
}

getMetadata(UserService); // target is Type<UserService>
```

---

## `CustomDecorator`

```ts
type CustomDecorator = {
  <TFunction extends Function>(target: TFunction): TFunction | void;
  (
    target: object,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void;
};
```

A decorator that works on both **classes** and **methods/properties**.
This is the return type of `SetMetadata()`.

The union signature properly handles:
- **Class decoration:** receives the constructor, optionally returns a replacement.
- **Method/property decoration:** receives the prototype, property key, and optional descriptor.

```ts
const myDecorator: CustomDecorator = SetMetadata("key", "value");

// As a class decorator
@myDecorator
class MyClass {}

// As a method decorator
class Other {
  @myDecorator
  method() {}
}
```

---

## `ReflectableDecorator<TParam, TTransformed>`

```ts
type ReflectableDecorator<TParam = any, TTransformed = TParam> = ((
  opts?: TParam,
) => CustomDecorator) & {
  KEY: string;
};
```

The return type of `Reflector.createDecorator()`. It's a callable
decorator factory with an attached `KEY` property.

**Type parameters:**

| Parameter | Description |
|---|---|
| `TParam` | The type of the value passed to the decorator at the call site. |
| `TTransformed` | The type of the value after `options.transform` is applied. Defaults to `TParam`. |

```ts
// TParam = string[], TTransformed = string[] (no transform)
const Roles: ReflectableDecorator<string[]> =
  Reflector.createDecorator<string[]>();

Roles(["admin"]); // opts: string[]
Roles.KEY;        // string

// TParam = string[], TTransformed = Set<string>
const Tags: ReflectableDecorator<string[], Set<string>> =
  Reflector.createDecorator({
    transform: (tags: string[]) => new Set(tags),
  });
```

---

## `ReflectorDecoratorFn<T>`

```ts
type ReflectorDecoratorFn<T> = ReflectableDecorator<T, T>;
```

A convenience alias for decorators where the input and output types are
the same (no transform).

```ts
const Roles: ReflectorDecoratorFn<string[]> =
  Reflector.createDecorator<string[]>();
```

---

## `CreateDecoratorOptions<TParam, TTransformed>`

```ts
interface CreateDecoratorOptions<TParam = any, TTransformed = TParam> {
  key?: string;
  transform?: (value: TParam) => TTransformed;
}
```

Options for `Reflector.createDecorator()`.

| Property | Type | Description |
|---|---|---|
| `key` | `string` | Optional custom metadata key. Auto-generated if omitted. |
| `transform` | `(value: TParam) => TTransformed` | Optional function to transform the value before storage. |

---

## `CreateDecoratorWithTransformOptions<TParam, TTransformed>`

```ts
type CreateDecoratorWithTransformOptions<TParam, TTransformed = TParam> =
  CreateDecoratorOptions<TParam, TTransformed> &
  Required<Pick<CreateDecoratorOptions<TParam, TTransformed>, "transform">>;
```

A stricter version of `CreateDecoratorOptions` where `transform` is
**required**. Used internally by the `createDecorator` overload that
expects a transform function.

---

## `InstallMetadataPatchOptions`

```ts
type InstallMetadataPatchOptions = {
  override?: boolean;
  silent?: boolean;
};
```

Options for `installMetadataPatch()`.

| Property | Type | Default | Description |
|---|---|---|---|
| `override` | `boolean` | `false` | Replace existing Reflect metadata APIs if they already exist. |
| `silent` | `boolean` | `false` | Suppress errors when the patch can't be installed (e.g. APIs already exist). |
