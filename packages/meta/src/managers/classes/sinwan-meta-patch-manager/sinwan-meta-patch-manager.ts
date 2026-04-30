import { type InstallMetadataPatchOptions, type MetaKey } from "./types";
import { MetaStore } from "../../instances/meta-store-manager";
import { isObjectLike, MAX_PROTOTYPE_DEPTH } from "../shared";

export const DesignKeys = {
  paramTypes: "design:paramtypes",
  returnType: "design:returntype",
  type: "design:type",
} as const;

const PATCH_FLAG = "__sinwanMetaPatched";

export class SinwanMetaPatchManager {
  private metaStore = MetaStore;

  // Patch installation

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

    reflectApi.defineMetadata = (
      key: string | symbol,
      value: any,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      this.define(key, value, target, propertyKey);
    };

    reflectApi.getMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getInherited(key, target, propertyKey);
    };

    reflectApi.getOwnMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getOwn(key, target, propertyKey);
    };

    reflectApi.hasMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.hasInherited(key, target, propertyKey);
    };

    reflectApi.hasOwnMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.hasOwn(key, target, propertyKey);
    };

    reflectApi.getMetadataKeys = (
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getKeysInherited(target, propertyKey);
    };

    reflectApi.getOwnMetadataKeys = (
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.getKeys(target, propertyKey);
    };

    reflectApi.deleteMetadata = (
      key: string | symbol,
      target: object,
      propertyKey?: string | symbol,
    ) => {
      this.assertTarget(target);
      return this.delete(key, target, propertyKey);
    };

    Object.defineProperty(reflectApi, PATCH_FLAG, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  }

  isPatched(): boolean {
    const R = globalThis.Reflect as any;
    if (!isObjectLike(R)) return false;
    const reflectApi = R as Record<string, any>;
    return Boolean(reflectApi[PATCH_FLAG]);
  }

  // Store delegation

  define(
    key: MetaKey,
    value: any,
    target: object,
    propertyKey?: string | symbol,
  ): void {
    this.metaStore.define(key, value, target, propertyKey);
  }

  get<T = any>(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): T | undefined {
    return this.metaStore.get<T>(key, target, propertyKey);
  }

  getOwn<T = any>(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): T | undefined {
    return this.metaStore.getOwn<T>(key, target, propertyKey);
  }

  getInherited<T = any>(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): T | undefined {
    return this.metaStore.getInherited<T>(key, target, propertyKey);
  }

  has(key: MetaKey, target: object, propertyKey?: string | symbol): boolean {
    return this.metaStore.has(key, target, propertyKey);
  }

  hasOwn(key: MetaKey, target: object, propertyKey?: string | symbol): boolean {
    return this.metaStore.hasOwn(key, target, propertyKey);
  }

  hasInherited(
    key: MetaKey,
    target: object,
    propertyKey?: string | symbol,
  ): boolean {
    return this.metaStore.hasInherited(key, target, propertyKey);
  }

  delete(key: MetaKey, target: object, propertyKey?: string | symbol): boolean {
    return this.metaStore.delete(key, target, propertyKey);
  }

  getKeys(target: object, propertyKey?: string | symbol): MetaKey[] {
    if (propertyKey === undefined) return this.metaStore.keys(target);
    return this.metaStore.keysForProperty(target, propertyKey);
  }

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

  properties(key: MetaKey, target: object): Array<string | symbol> {
    return this.metaStore.properties(key, target);
  }

  // Design metadata helpers

  getParamTypes(target: any): any[] {
    return this.get<any[]>(DesignKeys.paramTypes, target) ?? [];
  }

  getReturnType(target: any, propertyKey: string): any {
    return this.get(DesignKeys.returnType, target, propertyKey);
  }

  getPropertyType(target: any, propertyKey: string): any {
    return this.get(DesignKeys.type, target, propertyKey);
  }

  private assertTarget(target: unknown): asserts target is object {
    if (!isObjectLike(target)) {
      throw new TypeError("Metadata target must be an object");
    }
  }
}
