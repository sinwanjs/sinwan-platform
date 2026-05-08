import type { Manager } from "../../manager";

export class SinwanErrorManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-error-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
