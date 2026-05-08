export { type MetaKey } from "../shared";

/**
 * Properly typed decorator that works as both a ClassDecorator and a MethodDecorator.
 * Unlike `ClassDecorator & MethodDecorator`, this signature correctly handles
 * the optional `descriptor` parameter without requiring `as any` casts.
 */
export type CustomDecorator = {
  <TFunction extends Function>(target: TFunction): TFunction | void;
  (
    target: object,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void;
};

export type Type<T = any> = new (...args: any[]) => T;

export interface CreateDecoratorOptions<TParam = any, TTransformed = TParam> {
  key?: string;
  transform?: (value: TParam) => TTransformed;
}

export type CreateDecoratorWithTransformOptions<
  TParam,
  TTransformed = TParam,
> = CreateDecoratorOptions<TParam, TTransformed> &
  Required<Pick<CreateDecoratorOptions<TParam, TTransformed>, "transform">>;

export type ReflectableDecorator<TParam = any, TTransformed = TParam> = ((
  opts?: TParam,
) => CustomDecorator) & {
  KEY: string;
};

export type ReflectorDecoratorFn<T> = ReflectableDecorator<T, T>;
