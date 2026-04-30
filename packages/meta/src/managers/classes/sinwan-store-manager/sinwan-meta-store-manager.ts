// ─────────────────────────────────────────────
//  MetadataStore — Native metadata engine
//  Zero dependencies. Replaces reflect-metadata.
//
//  Storage layout:
//    WeakMap<target, Map<key, Map<property, value>>>
//
//  Supports:
//    - Class-level   metadata (propertyKey = undefined)
//    - Method-level  metadata (propertyKey = string | Symbol)
//    - Any key type  (string | Symbol)
// ─────────────────────────────────────────────
import { type MetaKey, type PropertyKey_ } from "./types";
import { isObjectLike, MAX_PROTOTYPE_DEPTH } from "../shared";

// Inner structure:
//   target → metaKey → (propertyKey | CLASS_KEY) → value
// Using a Symbol prevents collisions with real property names like "__class__".
const CLASS_KEY: unique symbol = Symbol("__class__");

export class SinwanMetaStoreManager {
  // WeakMap — targets are GC'd when the class is no longer referenced
  private store = new WeakMap<
    object,
    Map<MetaKey, Map<string | symbol, any>>
  >();

  // ── Write ─────────────────────────────────────

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

  // ── Read ──────────────────────────────────────

  getOwn<T = any>(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): T | undefined {
    const propKey = propertyKey ?? CLASS_KEY;
    return this.store.get(target)?.get(key)?.get(propKey) as T | undefined;
  }

  get<T = any>(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): T | undefined {
    return this.getOwn<T>(key, target, propertyKey);
  }

  // ── Check ─────────────────────────────────────

  hasOwn(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): boolean {
    const propKey = propertyKey ?? CLASS_KEY;
    return this.store.get(target)?.get(key)?.has(propKey) ?? false;
  }

  has(
    key: MetaKey,
    target: object,
    propertyKey: PropertyKey_ = undefined,
  ): boolean {
    return this.hasOwn(key, target, propertyKey);
  }

  // ── Delete ────────────────────────────────────

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

  // ── List all keys on a target ─────────────────

  keys(target: object): MetaKey[] {
    return this.keysForProperty(target);
  }

  // ── List keys for a specific property ─────────
  // Complexity: O(n) where n = number of distinct metadata keys on the target.

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

  // ── List all properties for a key on a target ─

  properties(key: MetaKey, target: object): Array<string | symbol> {
    const props = [...(this.store.get(target)?.get(key)?.keys() ?? [])];
    return props.filter((p): p is string | symbol => p !== CLASS_KEY);
  }

  // ── Prototype-walk helpers ───────────────────
  // All prototype walks are guarded against circular chains via MAX_PROTOTYPE_DEPTH.

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
