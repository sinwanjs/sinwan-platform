import { SinwanHttpDecorators } from "../classes/sinwan-http-decorators";

const httpDecorators = new SinwanHttpDecorators();

/**
 * HTTP Controller decorator
 * @param prefix
 * @returns
 */
export const Controller = (prefix: string) => httpDecorators.Controller(prefix);

/**
 * HTTP GET decorator
 * @param path
 * @returns
 */
export const Get = (path: string) => httpDecorators.Get(path);

/**
 * HTTP POST decorator
 * @param path
 * @returns
 */
export const Post = (path: string) => httpDecorators.Post(path);

/**
 * HTTP PUT decorator
 * @param path
 * @returns
 */
export const Put = (path: string) => httpDecorators.Put(path);

/**
 * HTTP DELETE decorator
 * @param path
 * @returns
 */
export const Delete = (path: string) => httpDecorators.Delete(path);

/**
 * HTTP PATCH decorator
 * @param path
 * @returns
 */
export const Patch = (path: string) => httpDecorators.Patch(path);

/**
 * HTTP Guard decorator
 * @param guardClass
 * @param priority
 * @returns
 */
export const Guard = (guardClass: any, priority = 10) =>
  httpDecorators.Guard(guardClass, priority);
