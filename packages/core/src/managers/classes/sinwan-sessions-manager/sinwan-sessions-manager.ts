import type { Manager } from "../../manager";

export class SinwanSessionsManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-sessions-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
