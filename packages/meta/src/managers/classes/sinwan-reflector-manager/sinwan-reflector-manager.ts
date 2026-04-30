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
 * Generates a collision-resistant random key using crypto.getRandomValues().
 * Falls back to Math.random() if crypto API is unavailable (e.g. older runtimes).
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

const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
};

const getMetadataValue = (
  metadataKey: MetaKey,
  target: Type<any> | Function,
) => {
  const reflectApi = globalThis.Reflect as any;
  if (reflectApi && typeof reflectApi.getMetadata === "function") {
    return reflectApi.getMetadata(metadataKey, target);
  }
  return MetaStore.getInherited(metadataKey, target as object);
};

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

export class SinwanReflectorManager {
  static createDecorator<TParam>(
    options?: CreateDecoratorOptions<TParam>,
  ): ReflectableDecorator<TParam>;
  static createDecorator<TParam, TTransformed>(
    options: CreateDecoratorWithTransformOptions<TParam, TTransformed>,
  ): ReflectableDecorator<TParam, TTransformed>;
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

  private resolveKey<TKey>(metadataKeyOrDecorator: TKey): MetaKey {
    const decorator = metadataKeyOrDecorator as ReflectableDecorator<any, any>;
    if (typeof decorator === "function" && decorator.KEY !== undefined) {
      return decorator.KEY;
    }
    return metadataKeyOrDecorator as MetaKey;
  }

  public get<T extends ReflectableDecorator<any>>(
    decorator: T,
    target: Type<any> | Function,
  ): T extends ReflectableDecorator<any, infer R> ? R : unknown;
  public get<TResult = any, TKey = any>(
    metadataKey: TKey,
    target: Type<any> | Function,
  ): TResult;
  public get<TResult = any, TKey = any>(
    metadataKeyOrDecorator: TKey,
    target: Type<any> | Function,
  ): TResult {
    const metadataKey = this.resolveKey(metadataKeyOrDecorator);
    return getMetadataValue(metadataKey, target) as TResult;
  }

  public getFromMethod<T = any>(
    keyOrDecorator: any,
    target: object,
    propertyKey: string | symbol,
  ): T | undefined {
    const key = this.resolveKey(keyOrDecorator);
    return MetaStore.get<T>(key, target, propertyKey);
  }

  public getAll<TParam = any, TTransformed = TParam>(
    decorator: ReflectableDecorator<TParam, TTransformed>,
    targets: (Type<any> | Function)[],
  ): TTransformed extends Array<any> ? TTransformed : TTransformed[];
  public getAll<TResult extends any[] = any[], TKey = any>(
    metadataKey: TKey,
    targets: (Type<any> | Function)[],
  ): TResult;
  public getAll<TResult extends any[] = any[], TKey = any>(
    metadataKeyOrDecorator: TKey,
    targets: (Type<any> | Function)[],
  ): TResult {
    return (targets || []).map((target) =>
      this.get(metadataKeyOrDecorator, target),
    ) as TResult;
  }

  public getAllAndMerge<TParam = any, TTransformed = TParam>(
    decorator: ReflectableDecorator<TParam, TTransformed>,
    targets: (Type<any> | Function)[],
  ): TTransformed extends Array<any>
    ? TTransformed
    : TTransformed extends object
      ? TTransformed
      : TTransformed[];
  public getAllAndMerge<TResult extends any[] | object = any[], TKey = any>(
    metadataKey: TKey,
    targets: (Type<any> | Function)[],
  ): TResult;
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

  public getAllAndOverride<TParam = any, TTransformed = TParam>(
    decorator: ReflectableDecorator<TParam, TTransformed>,
    targets: (Type<any> | Function)[],
  ): TTransformed;
  public getAllAndOverride<TResult = any, TKey = any>(
    metadataKey: TKey,
    targets: (Type<any> | Function)[],
  ): TResult;
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
