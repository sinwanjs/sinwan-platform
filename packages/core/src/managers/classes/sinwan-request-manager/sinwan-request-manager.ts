import type { Manager } from "../../manager";

export class SinwanRequestManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-request-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
