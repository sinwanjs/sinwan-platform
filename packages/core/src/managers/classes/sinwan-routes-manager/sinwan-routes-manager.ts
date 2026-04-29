import type { Manager } from "../../manager";

export class SinwanRoutesManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-routes-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
