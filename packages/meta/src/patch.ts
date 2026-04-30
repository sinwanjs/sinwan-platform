import { MetaPatch } from "./managers";
import {
  DesignKeys,
  type InstallMetadataPatchOptions,
} from "./managers/classes/sinwan-meta-patch-manager";

export { DesignKeys, type InstallMetadataPatchOptions };

export function installMetadataPatch(
  options?: InstallMetadataPatchOptions,
): void {
  MetaPatch.installPatch(options);
}

export function isMetadataPatched(): boolean {
  return MetaPatch.isPatched();
}

export function getParamTypes(target: any): any[] {
  return MetaPatch.getParamTypes(target);
}

export function getReturnType(target: any, propertyKey: string): any {
  return MetaPatch.getReturnType(target, propertyKey);
}

export function getPropertyType(target: any, propertyKey: string): any {
  return MetaPatch.getPropertyType(target, propertyKey);
}

// Install immediately on import for backward compatibility.
// Use silent mode to prevent throwing if Reflect metadata API already exists.
MetaPatch.installPatch({ silent: true });
