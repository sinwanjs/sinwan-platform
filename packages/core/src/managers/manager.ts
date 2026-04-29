export abstract class Manager {
  abstract name: string;
  abstract init(): Promise<void>;
  abstract destroy(): Promise<void>;
}
