export interface Middleware {
  when(event: string, context: any, next: () => Promise<void>): Promise<void>;
}
