import type { Manager } from "../../manager";

export class SinwanStorageManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-storage-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
