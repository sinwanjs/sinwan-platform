/**
 * A metadata key — can be a string or a symbol.
 * This is the canonical definition used throughout @sinwan/meta.
 */
export type MetaKey = string | symbol;

/**
 * A property key for method-level metadata, or undefined for class-level.
 */
export type PropertyKey_ = string | symbol | undefined;
