import type { Manager } from "../../manager";

export class SinwanResponseManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-response-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
