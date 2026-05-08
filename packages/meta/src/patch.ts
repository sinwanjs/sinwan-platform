import { MetaPatch } from "./managers";
import {
  DesignKeys,
  type InstallMetadataPatchOptions,
} from "./managers/classes/sinwan-meta-patch-manager";

/**
 * Installs and exposes Sinwan's metadata patch entry point.
 *
 * @remarks
 * Importing this module applies the metadata patch in silent mode for backward
 * compatibility, and also provides the public helpers used by consumers.
 */
export { DesignKeys, type InstallMetadataPatchOptions };

/**
 * Installs metadata helpers on the global `Reflect` object.
 *
 * @param options Patch installation options.
 * @returns `void`.
 *
 * @remarks
 * This is a public convenience wrapper around the patch manager.
 */
export function installMetadataPatch(
  options?: InstallMetadataPatchOptions,
): void {
  MetaPatch.installPatch(options);
}

/**
 * Indicates whether the metadata patch has already been applied.
 *
 * @returns `true` when the patch flag is present on `Reflect`; otherwise `false`.
 */
export function isMetadataPatched(): boolean {
  return MetaPatch.isPatched();
}

/**
 * Gets TypeScript design-time constructor parameter types for a target.
 *
 * @param target The class constructor or function target.
 * @returns The reflected constructor parameter types, or an empty array when unavailable.
 */
export function getParamTypes(target: any): any[] {
  return MetaPatch.getParamTypes(target);
}

/**
 * Gets TypeScript design-time return type metadata for a member.
 *
 * @param target The class prototype or constructor containing the member.
 * @param propertyKey The property key for the member.
 * @returns The reflected return type, or `undefined` when unavailable.
 */
export function getReturnType(target: any, propertyKey: string): any {
  return MetaPatch.getReturnType(target, propertyKey);
}

/**
 * Gets TypeScript design-time property type metadata for a member.
 *
 * @param target The class prototype or constructor containing the property.
 * @param propertyKey The property key for the property.
 * @returns The reflected property type, or `undefined` when unavailable.
 */
export function getPropertyType(target: any, propertyKey: string): any {
  return MetaPatch.getPropertyType(target, propertyKey);
}

/**
 * Ambient declarations for Meta Patch APIs provided by the Sinwan patch.
 *
 * @remarks
 * This module has no runtime exports. Importing it only augments TypeScript
 * types so editors and builds recognize Meta Patch helpers.
 */
export {};

declare global {
  namespace Reflect {
    /**
     * Creates a decorator that writes metadata to a class or class member.
     *
     * @param metadataKey The key for the metadata entry.
     * @param metadataValue The value to attach.
     * @returns A decorator function.
     *
     * @remarks
     * If the same metadata key already exists for the target, the value is
     * overwritten.
     *
     * @example
     *
     *     const Role = (role: string) => Reflect.metadata("app:role", role);
     *
     *     @Role("admin")
     *     class Example {}
     */
    function metadata(
      metadataKey: any,
      metadataValue: any,
    ): {
      (target: Function): void;
      (target: Object, propertyKey: string | symbol): void;
    };

    /**
     * Defines metadata on a target object.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param metadataValue A value that contains attached metadata.
     * @param target The target object on which to define metadata.
     * @returns `void`.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", { enabled: true }, Example);
     */
    function defineMetadata(
      metadataKey: any,
      metadataValue: any,
      target: Object,
    ): void;

    /**
     * Defines metadata on a target member.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param metadataValue A value that contains attached metadata.
     * @param target The target object on which to define metadata.
     * @param propertyKey The property key for the target.
     * @returns `void`.
     *
     * @example
     *
     *     class Example {
     *         static staticMethod() {}
     *         method() {}
     *     }
     *
     *     Reflect.defineMetadata("custom:annotation", Number, Example, "staticMethod");
     *     Reflect.defineMetadata("custom:annotation", Number, Example.prototype, "method");
     */
    function defineMetadata(
      metadataKey: any,
      metadataValue: any,
      target: Object,
      propertyKey: string | symbol,
    ): void;

    /**
     * Gets a metadata value from a target or its prototype chain.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @returns The metadata value if found; otherwise `undefined`.
     *
     * @example
     *
     *     class Example {}
     *     const value = Reflect.getMetadata("custom:annotation", Example);
     */
    function getMetadata(metadataKey: any, target: Object): any;

    /**
     * Gets a metadata value from a target member or its prototype chain.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns The metadata value if found; otherwise `undefined`.
     *
     * @example
     *
     *     class Example { method() {} }
     *     const value = Reflect.getMetadata(
     *         "custom:annotation",
     *         Example.prototype,
     *         "method",
     *     );
     */
    function getMetadata(
      metadataKey: any,
      target: Object,
      propertyKey: string | symbol,
    ): any;

    /**
     * Gets a metadata value defined directly on a target object.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @returns The metadata value if found; otherwise `undefined`.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", 123, Example);
     *     const value = Reflect.getOwnMetadata("custom:annotation", Example);
     */
    function getOwnMetadata(metadataKey: any, target: Object): any;

    /**
     * Gets a metadata value defined directly on a target member.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns The metadata value if found; otherwise `undefined`.
     *
     * @example
     *
     *     class Example { method() {} }
     *     Reflect.defineMetadata("custom:annotation", true, Example.prototype, "method");
     *     const value = Reflect.getOwnMetadata(
     *         "custom:annotation",
     *         Example.prototype,
     *         "method",
     *     );
     */
    function getOwnMetadata(
      metadataKey: any,
      target: Object,
      propertyKey: string | symbol,
    ): any;

    /**
     * Determines whether a metadata key is defined on a target or its prototypes.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @returns `true` if the metadata key exists; otherwise `false`.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", "value", Example);
     *     const exists = Reflect.hasMetadata("custom:annotation", Example);
     */
    function hasMetadata(metadataKey: any, target: Object): boolean;

    /**
     * Determines whether a metadata key is defined on a target member or its prototypes.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns `true` if the metadata key exists; otherwise `false`.
     *
     * @example
     *
     *     class Example { method() {} }
     *     Reflect.defineMetadata("custom:annotation", "value", Example.prototype, "method");
     *     const exists = Reflect.hasMetadata(
     *         "custom:annotation",
     *         Example.prototype,
     *         "method",
     *     );
     */
    function hasMetadata(
      metadataKey: any,
      target: Object,
      propertyKey: string | symbol,
    ): boolean;

    /**
     * Determines whether a metadata key is defined directly on a target object.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @returns `true` if the metadata key exists; otherwise `false`.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", "value", Example);
     *     const exists = Reflect.hasOwnMetadata("custom:annotation", Example);
     */
    function hasOwnMetadata(metadataKey: any, target: Object): boolean;

    /**
     * Determines whether a metadata key is defined directly on a target member.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns `true` if the metadata key exists; otherwise `false`.
     *
     * @example
     *
     *     class Example { method() {} }
     *     Reflect.defineMetadata("custom:annotation", "value", Example.prototype, "method");
     *     const exists = Reflect.hasOwnMetadata(
     *         "custom:annotation",
     *         Example.prototype,
     *         "method",
     *     );
     */
    function hasOwnMetadata(
      metadataKey: any,
      target: Object,
      propertyKey: string | symbol,
    ): boolean;

    /**
     * Gets metadata keys defined on a target or its prototypes.
     *
     * @param target The target object on which the metadata is defined.
     * @returns An array of unique metadata keys.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", 1, Example);
     *     const keys = Reflect.getMetadataKeys(Example);
     */
    function getMetadataKeys(target: Object): any[];

    /**
     * Gets metadata keys defined on a target member or its prototypes.
     *
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns An array of unique metadata keys.
     *
     * @example
     *
     *     class Example { method() {} }
     *     Reflect.defineMetadata("custom:annotation", 1, Example.prototype, "method");
     *     const keys = Reflect.getMetadataKeys(Example.prototype, "method");
     */
    function getMetadataKeys(
      target: Object,
      propertyKey: string | symbol,
    ): any[];

    /**
     * Gets metadata keys defined directly on a target object.
     *
     * @param target The target object on which the metadata is defined.
     * @returns An array of unique metadata keys.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", 1, Example);
     *     const keys = Reflect.getOwnMetadataKeys(Example);
     */
    function getOwnMetadataKeys(target: Object): any[];

    /**
     * Gets metadata keys defined directly on a target member.
     *
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns An array of unique metadata keys.
     *
     * @example
     *
     *     class Example { method() {} }
     *     Reflect.defineMetadata("custom:annotation", 1, Example.prototype, "method");
     *     const keys = Reflect.getOwnMetadataKeys(Example.prototype, "method");
     */
    function getOwnMetadataKeys(
      target: Object,
      propertyKey: string | symbol,
    ): any[];

    /**
     * Deletes metadata from a target object.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @returns `true` if the metadata entry was found and deleted; otherwise `false`.
     *
     * @example
     *
     *     class Example {}
     *     Reflect.defineMetadata("custom:annotation", 1, Example);
     *     const deleted = Reflect.deleteMetadata("custom:annotation", Example);
     */
    function deleteMetadata(metadataKey: any, target: Object): boolean;

    /**
     * Deletes metadata from a target member.
     *
     * @param metadataKey A key used to store and retrieve metadata.
     * @param target The target object on which the metadata is defined.
     * @param propertyKey The property key for the target.
     * @returns `true` if the metadata entry was found and deleted; otherwise `false`.
     *
     * @example
     *
     *     class Example { method() {} }
     *     Reflect.defineMetadata("custom:annotation", 1, Example.prototype, "method");
     *     const deleted = Reflect.deleteMetadata(
     *         "custom:annotation",
     *         Example.prototype,
     *         "method",
     *     );
     */
    function deleteMetadata(
      metadataKey: any,
      target: Object,
      propertyKey: string | symbol,
    ): boolean;
  }
}


// Install immediately on import for backward compatibility.
// Use silent mode to prevent throwing if Reflect metadata API already exists.
MetaPatch.installPatch({ silent: true });
