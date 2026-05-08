/**
 * Maximum depth for prototype-chain walks.
 * Prevents infinite loops caused by circular prototype chains
 * (e.g. via `Object.setPrototypeOf` abuse).
 */
export const MAX_PROTOTYPE_DEPTH = 100;

/**
 * Checks whether a value is an object-like entity (non-null object or function).
 * Used as a guard for metadata targets and prototype-chain walks.
 */
export const isObjectLike = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";
