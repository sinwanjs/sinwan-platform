import { MetaStore } from "../../instances/meta-store-manager";
import type {
  CreateDecoratorOptions,
  CreateDecoratorWithTransformOptions,
  CustomDecorator,
  MetaKey,
  ReflectableDecorator,
  Type,
} from "./types";

const KEY_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_KEY_SIZE = 21;

/**
 * Generates a metadata key for decorator factories.
 *
 * @param size Key length.
 * @returns Random key string.
 *
 * @remarks
 * Uses `crypto.getRandomValues()` when available and falls back to
 * `Math.random()` in older runtimes.
 */
const createKey = (size: number = DEFAULT_KEY_SIZE): string => {
  let value = "";

  // Prefer crypto.getRandomValues for better collision resistance
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(size);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < size; i += 1) {
      value += KEY_CHARS[bytes[i]! % KEY_CHARS.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < size; i += 1) {
      value += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
    }
  }

  return value;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Resolves metadata value from native Reflect API when available,
 * otherwise falls back to Sinwan store traversal.
 */
const getMetadataValue = (
  metadataKey: MetaKey,
  target: Type<any> | Function,
): unknown => {
  const reflectApi = globalThis.Reflect as any;
  if (reflectApi && typeof reflectApi.getMetadata === "function") {
    return reflectApi.getMetadata(metadataKey, target);
  }
  return MetaStore.getInherited(metadataKey, target as object);
};

/**
 * Decorator factory for attaching metadata to classes and class members.
 *
 * @typeParam K Metadata key type.
 * @typeParam V Metadata value type.
 * @param key Metadata key.
 * @param value Metadata value.
 * @returns Decorator that writes metadata into Sinwan metadata storage.
 *
 * @remarks
 * For method decorators, metadata is stored on both:
 * - the class prototype/property slot
 * - the function value (`descriptor.value`) when available
 */
export function SetMetadata<K extends MetaKey = string, V = any>(
  key: K,
  value: V,
): CustomDecorator {
  return (
    target: Function | Object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    const storedValue = value ?? {};

    if (propertyKey !== undefined) {
      MetaStore.define(key, storedValue, target, propertyKey);
      if (descriptor?.value) {
        MetaStore.define(key, storedValue, descriptor.value);
      }
    } else {
      MetaStore.define(key, storedValue, target as object);
    }
  };
}

/**
 * High-level reflection helper for creating and reading metadata decorators.
 *
 * @remarks
 * This manager supports both raw metadata keys and generated decorators
 * carrying a `.KEY` property. Read operations prefer native `Reflect` metadata
 * APIs when present, and gracefully fall back to `MetaStore` otherwise.
 */
export class SinwanReflectorManager {
  /**
   * Creates a typed metadata decorator factory.
   *
   * @typeParam TParam Input metadata payload type.
   * @param options Decorator creation options.
   * @returns Reflectable decorator factory.
   */
  static createDecorator<TParam>(
    options?: CreateDecoratorOptions<TParam>,
  ): ReflectableDecorator<TParam>;
  /**
   * Creates a metadata decorator factory with transformation.
   *
   * @typeParam TParam Input metadata payload type.
   * @typeParam TTransformed Stored metadata payload type after transform.
   * @param options Decorator creation options including `transform`.
   * @returns Reflectable decorator factory.
   */
  static createDecorator<TParam, TTransformed>(
    options: CreateDecoratorWithTransformOptions<TParam, TTransformed>,
  ): ReflectableDecorator<TParam, TTransformed>;
  /**
   * Creates a metadata decorator factory and assigns a stable metadata key.
   *
   * @typeParam TParam Input metadata payload type.
   * @typeParam TTransformed Stored metadata payload type.
   * @param options Decorator creation options.
   * @returns Decorator factory exposing `.KEY` for reflective lookups.
   *
   * @example
   * const Roles = SinwanReflectorManager.createDecorator<string[]>({
   *   key: "auth:roles",
   * });
   *
   * @Roles(["admin"])
   * class Controller {}
   */
  static createDecorator<TParam, TTransformed = TParam>(
    options: CreateDecoratorOptions<TParam, TTransformed> = {},
  ): ReflectableDecorator<TParam, TTransformed> {
    const metadataKey = options.key ?? createKey();

    const decoratorFn = (metadataValue?: TParam): CustomDecorator => {
      return (
        target: object | Function,
        key?: string | symbol,
        descriptor?: PropertyDescriptor,
      ) => {
        const value = options.transform
          ? options.transform(metadataValue as TParam)
          : (metadataValue as TTransformed);

        const decorator = SetMetadata(metadataKey, value ?? {});
        if (key !== undefined) {
          decorator(target, key, descriptor);
        } else {
          decorator(target as Function);
        }
      };
    };

    decoratorFn.KEY = metadataKey;
    return decoratorFn as ReflectableDecorator<TParam, TTransformed>;
  }

  /**
   * Resolves a raw metadata key from either a key value or reflectable decorator.
   */
  private resolveKey<TKey>(metadataKeyOrDecorator: TKey): MetaKey {
    const decorator = metadataKeyOrDecorator as ReflectableDecorator<any, any>;
    if (typeof decorator === "function" && decorator.KEY !== undefined) {
      return decorator.KEY;
    }
    return metadataKeyOrDecorator as MetaKey;
  }

  /**
   * Gets metadata by decorator factory key.
   */
  public get<T extends ReflectableDecorator<any>>(
    decorator: T,
    target: Type<any> | Function,
  ): T extends ReflectableDecorator<any, infer R> ? R : unknown;
  /**
   * Gets metadata by explicit key.
   */
  public get<TResult = any, TKey = any>(
    metadataKey: TKey,
    target: Type<any> | Function,
  ): TResult;
  /**
   * Gets metadata for a target.
   *
   * @typeParam TResult Expected return type.
   * @param metadataKeyOrDecorator Metadata key or decorator created by `createDecorator`.
   * @param target Class constructor or function target.
   * @returns Metadata value when found; otherwise `undefined`.
   */
  public get<TResult = any, TKey = any>(
    metadataKeyOrDecorator: TKey,
    target: Type<any> | Function,
  ): TResult {
    const metadataKey = this.resolveKey(metadataKeyOrDecorator);
    return getMetadataValue(metadataKey, target) as TResult;
  }

  /**
   * Gets metadata from a specific class/prototype member.
   *
   * @typeParam T Expected return type.
   * @param keyOrDecorator Metadata key or decorator.
   * @param target Prototype or constructor containing the member.
   * @param propertyKey Method/property key.
   * @returns Metadata value when found; otherwise `undefined`.
   */
  public getFromMethod<T = any>(
    keyOrDecorator: any,
    target: object,
    propertyKey: string | symbol,
  ): T | undefined {
    const key = this.resolveKey(keyOrDecorator);
    return MetaStore.get<T>(key, target, propertyKey);
  }

  /**
   * Gets metadata values from all targets, preserving order.
   */
  public getAll<TParam = any, TTransformed = TParam>(
    decorator: ReflectableDecorator<TParam, TTransformed>,
    targets: (Type<any> | Function)[],
  ): TTransformed extends Array<any> ? TTransformed : TTransformed[];
  /**
   * Gets metadata values from all targets using a raw key.
   */
  public getAll<TResult extends any[] = any[], TKey = any>(
    metadataKey: TKey,
    targets: (Type<any> | Function)[],
  ): TResult;
  /**
   * Gets metadata values from all targets.
   *
   * @typeParam TResult Expected array result type.
   * @param metadataKeyOrDecorator Metadata key or decorator.
   * @param targets Targets to inspect.
   * @returns Array of resolved metadata values in target iteration order.
   */
  public getAll<TResult extends any[] = any[], TKey = any>(
    metadataKeyOrDecorator: TKey,
    targets: (Type<any> | Function)[],
  ): TResult {
    return (targets || []).map((target) =>
      this.get(metadataKeyOrDecorator, target),
    ) as TResult;
  }

  /**
   * Gets and merges metadata values across targets.
   */
  public getAllAndMerge<TParam = any, TTransformed = TParam>(
    decorator: ReflectableDecorator<TParam, TTransformed>,
    targets: (Type<any> | Function)[],
  ): TTransformed extends Array<any>
    ? TTransformed
    : TTransformed extends object
      ? TTransformed
      : TTransformed[];
  /**
   * Gets and merges metadata values across targets using a raw key.
   */
  public getAllAndMerge<TResult extends any[] | object = any[], TKey = any>(
    metadataKey: TKey,
    targets: (Type<any> | Function)[],
  ): TResult;
  /**
   * Gets and merges metadata from targets.
   *
   * @remarks
   * Merge strategy:
   * - Arrays are concatenated.
   * - Plain objects are shallow-merged (`{ ...a, ...b }`).
   * - Primitive or mixed values are accumulated as array pairs.
   */
  public getAllAndMerge<TResult extends any[] | object = any[], TKey = any>(
    metadataKeyOrDecorator: TKey,
    targets: (Type<any> | Function)[],
  ): TResult {
    const metadataCollection = this.getAll<any[], TKey>(
      metadataKeyOrDecorator,
      targets,
    ).filter((item) => item !== undefined);

    if (metadataCollection.length === 0) {
      return metadataCollection as TResult;
    }

    return metadataCollection.reduce((a: any, b: any) => {
      if (Array.isArray(a)) {
        return a.concat(b);
      }
      if (isObject(a) && isObject(b)) {
        return {
          ...a,
          ...b,
        };
      }
      return [a, b];
    }) as TResult;
  }

  /**
   * Gets first defined metadata value across targets.
   */
  public getAllAndOverride<TParam = any, TTransformed = TParam>(
    decorator: ReflectableDecorator<TParam, TTransformed>,
    targets: (Type<any> | Function)[],
  ): TTransformed;
  /**
   * Gets first defined metadata value across targets using a raw key.
   */
  public getAllAndOverride<TResult = any, TKey = any>(
    metadataKey: TKey,
    targets: (Type<any> | Function)[],
  ): TResult;
  /**
   * Gets the first non-`undefined` metadata result from ordered targets.
   *
   * @param metadataKeyOrDecorator Metadata key or decorator.
   * @param targets Targets in priority order.
   * @returns First defined metadata value; otherwise `undefined`.
   */
  public getAllAndOverride<TResult = any, TKey = any>(
    metadataKeyOrDecorator: TKey,
    targets: (Type<any> | Function)[],
  ): TResult | undefined {
    for (const target of targets) {
      const result = this.get(metadataKeyOrDecorator, target);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  }

  /**
   * Checks whether metadata exists on a target or its prototype chain.
   *
   * @param metadataKeyOrDecorator Metadata key or decorator.
   * @param target Class constructor or function target.
   * @returns `true` when metadata exists; otherwise `false`.
   */
  public has(
    metadataKeyOrDecorator: any,
    target: Type<any> | Function,
  ): boolean {
    const metadataKey = this.resolveKey(metadataKeyOrDecorator);
    const reflectApi = globalThis.Reflect as any;
    if (reflectApi && typeof reflectApi.hasMetadata === "function") {
      return Boolean(reflectApi.hasMetadata(metadataKey, target));
    }
    return MetaStore.hasInherited(metadataKey, target as object);
  }
}
