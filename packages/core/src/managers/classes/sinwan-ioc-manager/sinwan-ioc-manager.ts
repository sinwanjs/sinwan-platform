import type { Manager } from "../../manager";

export class SinwanIocManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-ioc-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
