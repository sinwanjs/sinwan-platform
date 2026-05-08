export {
  reflector,
  Reflector,
  SetMetadata,
  type CreateDecoratorOptions,
  type CreateDecoratorWithTransformOptions,
  type CustomDecorator,
  type MetaKey,
  type ReflectableDecorator,
  type ReflectorDecoratorFn,
  type Type,
} from "./managers";

export {
  DesignKeys,
  getParamTypes,
  getPropertyType,
  getReturnType,
  installMetadataPatch,
  isMetadataPatched,
  type InstallMetadataPatchOptions,
} from "./patch";
