import type { Manager } from "../../manager";

export class SinwanContainerManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-container-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
