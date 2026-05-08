import type { Manager } from "../../manager";

export class SinwanPluginManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-plugin-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
