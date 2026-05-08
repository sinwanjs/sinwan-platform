import type { Manager } from "../../manager";

export class SinwanLifecycleManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-lifecycle-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
