import { type InstallMetadataPatchOptions, type MetaKey } from "./types";
import { MetaStore } from "../../instances/meta-store-manager";
import { isObjectLike, MAX_PROTOTYPE_DEPTH } from "../shared";

/**
 * Canonical metadata keys used by TypeScript design-time emit.
 *
 * @remarks
 * These keys are compatible with the values produced when
 * `emitDecoratorMetadata` is enabled in TypeScript.
 *
 * @example
 * const parameterTypes = manager.get(DesignKeys.paramTypes, SomeClass);
 */
export const DesignKeys = {
  paramTypes: "design:paramtypes",
  returnType: "design:returntype",
  type: "design:type",
} as const;

const PATCH_FLAG = "__sinwanMetaPatched";

/**
 * Provides installation and utility operations for metadata APIs on `globalThis.Reflect`.
 *
 * @remarks
 * This manager installs a compatible subset of the `reflect-metadata` API and
 * delegates metadata persistence to `MetaStore`. Once installed, methods such as
 * `Reflect.defineMetadata`, `Reflect.getMetadata`, and related key/introspection
 * APIs become available in the runtime process.
 *
 * Patch behavior:
 * - Does not patch multiple times in the same process.
 * - Refuses to override an existing metadata API unless `override` is `true`.
 * - Can run in silent mode to avoid throwing in unsupported environments.
 *
 * @example
 * const manager = new SinwanMetaPatchManager();
 * manager.installPatch({ override: false });
 * Reflect.defineMetadata("example:key", { enabled: true }, SomeClass);
 */
export class SinwanMetaPatchManager {
  private metaStore = MetaStore;

  // Patch installation

  /**
   * Installs metadata helpers on `globalThis.Reflect`.
   *
   * @param options Patch installation options.
   * @param options.override When `true`, existing metadata APIs on `Reflect` may be replaced.
   * @param options.silent When `true`, installation failures are ignored instead of throwing.
   * @returns `void`.
   *
   * @remarks
   * If a patch is already installed by this manager, this method exits early.
   * If metadata APIs already exist and `override` is `false`, installation is
   * rejected unless `silent` is enabled.
   *
   * @example
   * const manager = new SinwanMetaPatchManager();
   * manager.installPatch({ override: true, silent: false });
   */
  installPatch(options: InstallMetadataPatchOptions = {}): void {
    const { override = false, silent = false } = options;
    const R = globalThis.Reflect as any;

    if (!isObjectLike(R)) {
      if (!silent) {
        throw new Error(
          "Global Reflect object not found; cannot install metadata patch",
        );
      }
      return;
    }

    const reflectApi = R as Record<string, any>;

    if (reflectApi[PATCH_FLAG]) return;

    const hasMetadataApi =
      typeof reflectApi.metadata === "function" ||
      typeof reflectApi.defineMetadata === "function" ||
      typeof reflectApi.getMetadata === "function";

    if (hasMetadataApi && !override) {
      if (!silent) {
        throw new Error(
          "Reflect metadata API already exists, and override option is not set; cannot install the path from @sinwan/meta/patch",
        );
      }
      return;
    }

    /**
     * Creates a metadata-producing decorator.
     *
     * @param key Metadata key to write.
     * @param value Metadata value to attach.
     * @returns Decorator function for class or class member targets.
     *
     * @remarks
     * This mirrors `Reflect.metadata` behavior and writes metadata through
     * the local store-backed `define` operation.
     */
    reflectApi.metadata = (key: string, value: any) => {
      return (target: object | Function, propertyKey?: string | symbol) => {
        this.assertTarget(target);
        if (propertyKey !== undefined) {
          this.define(key, value, target as object, propertyKey);
        } else {
          this.define(key, value, target as object);
        }
      };
    };

    /**
     * Defines metadata on a target or target member.
     *
     * @param key Metadata key.
     * @param value Metadata value.
     * @param target Metadata target.
     * @param propertyKey Optional property key for member-level metadata.
     * @returns `void`.
     */
    reflectApi.defineMetadata = (
      key: string | symbol,
      value: any,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      this.define(key, value, target, propertyKey);
    };

    /**
     * Gets metadata from target or prototype chain.
     *
     * @param key Metadata key.
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns Metadata value when found; otherwise `undefined`.
     */
    reflectApi.getMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getInherited(key, target, propertyKey);
    };

    /**
     * Gets own metadata from the target only.
     *
     * @param key Metadata key.
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns Own metadata value when found; otherwise `undefined`.
     */
    reflectApi.getOwnMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getOwn(key, target, propertyKey);
    };

    /**
     * Checks metadata existence on target or prototype chain.
     *
     * @param key Metadata key.
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns `true` when metadata exists; otherwise `false`.
     */
    reflectApi.hasMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.hasInherited(key, target, propertyKey);
    };

    /**
     * Checks own metadata existence on target.
     *
     * @param key Metadata key.
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns `true` when own metadata exists; otherwise `false`.
     */
    reflectApi.hasOwnMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.hasOwn(key, target, propertyKey);
    };

    /**
     * Gets unique metadata keys from target and prototype chain.
     *
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns Deduplicated metadata keys.
     */
    reflectApi.getMetadataKeys = (
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getKeysInherited(target, propertyKey);
    };

    /**
     * Gets own metadata keys from target only.
     *
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns Metadata keys defined directly on the target scope.
     */
    reflectApi.getOwnMetadataKeys = (
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getKeys(target, propertyKey);
    };

    /**
     * Deletes metadata from target scope.
     *
     * @param key Metadata key.
     * @param target Metadata target.
     * @param propertyKey Optional property key.
     * @returns `true` when metadata was deleted; otherwise `false`.
     */
    reflectApi.deleteMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.delete(key, target, propertyKey);
    };

    /**
     * Marks Reflect as patched by this manager.
     *
     * @remarks
     * The flag is non-enumerable so it does not pollute Reflect introspection.
     */
    Object.defineProperty(reflectApi, PATCH_FLAG, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  }

  /**
   * Indicates whether the runtime was already patched by this manager.
   *
   * @returns `true` when the internal patch flag exists on `globalThis.Reflect`; otherwise `false`.
   */
  isPatched(): boolean {
    const R = globalThis.Reflect as any;
    if (!isObjectLike(R)) return false;
    const reflectApi = R as Record<string, any>;
    return Boolean(reflectApi[PATCH_FLAG]);
  }

  // Store delegation

  /**
   * Defines metadata for a target or one of its properties.
   *
   * @param key Metadata key.
   * @param value Metadata value.
   * @param target Target object that receives metadata.
   * @param propertyKey Optional property key for member-level metadata.
   * @returns `void`.
   *
   * @example
   * manager.define("custom:role", "service", ExampleClass);
   * manager.define("custom:role", "method", ExampleClass.prototype, "run");
   */
  define(
    key: MetaKey,
    value: any,
    target: object,
    propertyKey?: string | symbol,
  ): void {
    this.metaStore.define(key, value, target, propertyKey);
  }

  /**
   * Gets metadata defined directly on the target or target property.
   *
   * @typeParam T Expected metadata value type.
   * @param key Metadata key.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns Metadata value when found; otherwise `undefined`.
   */
  get<T = any>(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): T | undefined {
    return this.metaStore.get<T>(key, target, propertyKey);
  }

  /**
   * Gets metadata defined directly on the target only (no prototype traversal).
   *
   * @typeParam T Expected metadata value type.
   * @param key Metadata key.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns Own metadata value when found; otherwise `undefined`.
   */
  getOwn<T = any>(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): T | undefined {
    return this.metaStore.getOwn<T>(key, target, propertyKey);
  }

  /**
   * Gets metadata from the target or its prototype chain.
   *
   * @typeParam T Expected metadata value type.
   * @param key Metadata key.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns First matching metadata value found while traversing inheritance; otherwise `undefined`.
   */
  getInherited<T = any>(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): T | undefined {
    return this.metaStore.getInherited<T>(key, target, propertyKey);
  }

  /**
   * Checks whether metadata exists on the target.
   *
   * @param key Metadata key.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns `true` when metadata exists on the target-level store; otherwise `false`.
   */
  has(key: MetaKey, target: object, propertyKey?: string | symbol): boolean {
    return this.metaStore.has(key, target, propertyKey);
  }

  /**
   * Checks whether metadata exists directly on the target (own metadata only).
   *
   * @param key Metadata key.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns `true` when own metadata exists; otherwise `false`.
   */
  hasOwn(key: MetaKey, target: object, propertyKey?: string | symbol): boolean {
    return this.metaStore.hasOwn(key, target, propertyKey);
  }

  /**
   * Checks whether metadata exists on the target or in its prototype chain.
   *
   * @param key Metadata key.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns `true` when metadata is found on own or inherited levels; otherwise `false`.
   */
  hasInherited(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): boolean {
    return this.metaStore.hasInherited(key, target, propertyKey);
  }

  /**
   * Deletes metadata from the target.
   *
   * @param key Metadata key to remove.
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns `true` when an entry was removed; otherwise `false`.
   */
  delete(key: MetaKey, target: object, propertyKey?: string | symbol): boolean {
    return this.metaStore.delete(key, target, propertyKey);
  }

  /**
   * Gets metadata keys defined for the target at the current level.
   *
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns Array of keys for the requested scope.
   */
  getKeys(target: object, propertyKey?: string | symbol): MetaKey[] {
    if (propertyKey === undefined) return this.metaStore.keys(target);
    return this.metaStore.keysForProperty(target, propertyKey);
  }

  /**
   * Gets metadata keys from the target and inherited prototypes.
   *
   * @param target Metadata target.
   * @param propertyKey Optional property key.
   * @returns Deduplicated metadata keys collected across the inheritance chain.
   *
   * @remarks
   * Prototype traversal is bounded by `MAX_PROTOTYPE_DEPTH` to avoid pathological
   * or cyclic prototype walks.
   */
  getKeysInherited(target: object, propertyKey?: string | symbol): MetaKey[] {
    if (propertyKey === undefined) return this.metaStore.keysInherited(target);

    const keys = new Set<MetaKey>();
    let current: object | null = target;
    let depth = 0;

    while (isObjectLike(current)) {
      if (++depth > MAX_PROTOTYPE_DEPTH) break;
      for (const key of this.metaStore.keysForProperty(current, propertyKey)) {
        keys.add(key);
      }
      current = Object.getPrototypeOf(current);
    }

    return [...keys];
  }

  /**
   * Lists property keys that currently have a specific metadata key.
   *
   * @param key Metadata key to inspect.
   * @param target Metadata target.
   * @returns Property keys that contain the provided metadata key.
   */
  properties(key: MetaKey, target: object): Array<string | symbol> {
    return this.metaStore.properties(key, target);
  }

  // Design metadata helpers

  /**
   * Gets constructor parameter design types.
   *
   * @param target Class constructor.
   * @returns Constructor parameter types, or an empty array when unavailable.
   */
  getParamTypes(target: any): any[] {
    return this.get<any[]>(DesignKeys.paramTypes, target) ?? [];
  }

  /**
   * Gets method return design type metadata.
   *
   * @param target Prototype or constructor containing the member.
   * @param propertyKey Method name.
   * @returns Return type metadata when available; otherwise `undefined`.
   */
  getReturnType(target: any, propertyKey: string): any {
    return this.get(DesignKeys.returnType, target, propertyKey);
  }

  /**
   * Gets property design type metadata.
   *
   * @param target Prototype or constructor containing the property.
   * @param propertyKey Property name.
   * @returns Property type metadata when available; otherwise `undefined`.
   */
  getPropertyType(target: any, propertyKey: string): any {
    return this.get(DesignKeys.type, target, propertyKey);
  }

  /**
   * Validates that a metadata target is object-like.
   *
   * @param target Value to validate.
   * @throws {TypeError} Thrown when the value is not object-like.
   */
  private assertTarget(target: unknown): asserts target is object {
    if (!isObjectLike(target)) {
      throw new TypeError("Metadata target must be an object");
    }
  }
}
