import { type MetaKey, type PropertyKey_ } from "./types";
import { isObjectLike, MAX_PROTOTYPE_DEPTH } from "../shared";

/**
 * Sentinel key for class-level metadata entries.
 *
 * @remarks
 * A symbol is used to avoid collisions with real property names.
 */
const CLASS_KEY: unique symbol = Symbol("__class__");

/**
 * Native metadata storage manager.
 *
 * @remarks
 * Internal layout:
 * `WeakMap<target, Map<metaKey, Map<propertyKey | CLASS_KEY, value>>>`
 *
 * Capabilities:
 * - class-level metadata (`propertyKey = undefined`)
 * - member-level metadata (`propertyKey = string | symbol`)
 * - inherited lookups with bounded prototype traversal
 *
 * The use of `WeakMap` ensures metadata is garbage collected when
 * the target object becomes unreachable.
 */
export class SinwanMetaStoreManager {
  /**
   * Backing store for all metadata.
   */
  private store = new WeakMap<
    object,
    Map<MetaKey, Map<string | symbol, any>>
  >();

  /**
   * Defines metadata for a target or one of its members.
   *
   * @param key Metadata key.
   * @param value Metadata value.
   * @param target Target object.
   * @param propertyKey Optional property key for member-level metadata.
   * @returns `void`.
   */
  define(
    key: MetaKey,
    value: any,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): void {
    if (!this.store.has(target)) {
      this.store.set(target, new Map());
    }

    const targetMeta = this.store.get(target)!;

    if (!targetMeta.has(key)) {
      targetMeta.set(key, new Map());
    }

    const propKey = propertyKey ?? CLASS_KEY;
    targetMeta.get(key)!.set(propKey, value);
  }

  /**
   * Gets own metadata value (no prototype traversal).
   *
   * @typeParam T Expected value type.
   * @param key Metadata key.
   * @param target Target object.
   * @param propertyKey Optional property key.
   * @returns Metadata value when found; otherwise `undefined`.
   */
  getOwn<T = any>(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): T | undefined {
    const propKey = propertyKey ?? CLASS_KEY;
    return this.store.get(target)?.get(key)?.get(propKey) as T | undefined;
  }

  /**
   * Gets metadata value on the target.
   *
   * @remarks
   * This method is currently equivalent to `getOwn`.
   */
  get<T = any>(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): T | undefined {
    return this.getOwn<T>(key, target, propertyKey);
  }

  /**
   * Checks whether metadata exists directly on the target.
   *
   * @param key Metadata key.
   * @param target Target object.
   * @param propertyKey Optional property key.
   * @returns `true` when metadata exists; otherwise `false`.
   */
  hasOwn(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): boolean {
    const propKey = propertyKey ?? CLASS_KEY;
    return this.store.get(target)?.get(key)?.has(propKey) ?? false;
  }

  /**
   * Checks whether metadata exists on the target.
   *
   * @remarks
   * This method is currently equivalent to `hasOwn`.
   */
  has(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): boolean {
    return this.hasOwn(key, target, propertyKey);
  }

  /**
   * Deletes metadata entry for a key from a target or target member.
   *
   * @param key Metadata key to delete.
   * @param target Target object.
   * @param propertyKey Optional property key.
   * @returns `true` when an entry was deleted; otherwise `false`.
   *
   * @remarks
   * Performs automatic cleanup of empty nested maps to keep memory compact.
   */
  delete(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): boolean {
    const propKey = propertyKey ?? CLASS_KEY;

    const targetMeta = this.store.get(target);
    if (!targetMeta) return false;

    const keyMeta = targetMeta.get(key);
    if (!keyMeta) return false;

    const didDelete = keyMeta.delete(propKey);

    if (keyMeta.size === 0) {
      targetMeta.delete(key);
    }

    if (targetMeta.size === 0) {
      this.store.delete(target);
    }

    return didDelete;
  }

  /**
   * Lists all metadata keys attached to class-level scope of the target.
   *
   * @param target Target object.
   * @returns Metadata keys for class-level metadata.
   */
  keys(target: object): MetaKey[] {
    return this.keysForProperty(target);
  }

  /**
   * Lists metadata keys for a specific target property scope.
   *
   * @param target Target object.
   * @param propertyKey Optional property key. Omit for class-level keys.
   * @returns Metadata keys for the selected scope.
   *
   * @remarks
   * Complexity: $O(n)$ where $n$ is number of distinct metadata keys
   * stored for the target.
   */
  keysForProperty(
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): MetaKey[] {
    const targetMeta = this.store.get(target);
    if (!targetMeta) return [];

    const propKey = propertyKey ?? CLASS_KEY;
    const keys: MetaKey[] = [];

    for (const [key, propMap] of targetMeta.entries()) {
      if (propMap.has(propKey)) keys.push(key);
    }

    return keys;
  }

  /**
   * Lists all member property keys that have a given metadata key.
   *
   * @param key Metadata key.
   * @param target Target object.
   * @returns Property keys containing that metadata key.
   */
  properties(key: MetaKey, target: object): Array<string | symbol> {
    const props = [...(this.store.get(target)?.get(key)?.keys() ?? [])];
    return props.filter((p): p is string | symbol => p !== CLASS_KEY);
  }

  /**
   * Gets metadata by walking target and prototype chain.
   *
   * @typeParam T Expected value type.
   * @param key Metadata key.
   * @param target Start target.
   * @param propertyKey Optional property key.
   * @returns First matching metadata value; otherwise `undefined`.
   *
   * @remarks
   * Traversal depth is bounded by `MAX_PROTOTYPE_DEPTH`.
   */
  getInherited<T = any>(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): T | undefined {
    // Fast path: check own first before entering the loop
    const own = this.getOwn<T>(key, target, propertyKey);
    if (own !== undefined) return own;

    let current: object | null = Object.getPrototypeOf(target);
    let depth = 0;

    while (isObjectLike(current)) {
      if (++depth > MAX_PROTOTYPE_DEPTH) break;
      if (this.hasOwn(key, current, propertyKey)) {
        return this.getOwn<T>(key, current, propertyKey);
      }
      current = Object.getPrototypeOf(current);
    }

    return undefined;
  }

  /**
   * Checks whether metadata exists on target or inherited prototypes.
   *
   * @param key Metadata key.
   * @param target Start target.
   * @param propertyKey Optional property key.
   * @returns `true` when metadata is found; otherwise `false`.
   */
  hasInherited(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): boolean {
    // Fast path
    if (this.hasOwn(key, target, propertyKey)) return true;

    let current: object | null = Object.getPrototypeOf(target);
    let depth = 0;

    while (isObjectLike(current)) {
      if (++depth > MAX_PROTOTYPE_DEPTH) break;
      if (this.hasOwn(key, current, propertyKey)) return true;
      current = Object.getPrototypeOf(current);
    }

    return false;
  }

  /**
   * Lists unique metadata keys from target and prototype chain.
   *
   * @param target Start target.
   * @returns Deduplicated metadata keys in traversal order.
   */
  keysInherited(target: object): MetaKey[] {
    const keys = new Set<MetaKey>();
    let current: object | null = target;
    let depth = 0;

    while (isObjectLike(current)) {
      if (++depth > MAX_PROTOTYPE_DEPTH) break;
      for (const key of this.keys(current)) keys.add(key);
      current = Object.getPrototypeOf(current);
    }

    return [...keys];
  }
}
