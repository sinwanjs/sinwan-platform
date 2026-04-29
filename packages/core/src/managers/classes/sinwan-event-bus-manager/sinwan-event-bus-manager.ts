import type { Manager } from "../../manager";

export class SinwanEventBusManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-event-bus-manager";
  }

  async init(): Promise<void> {
    throw new Error("SinwanEventBusManager is not implemented yet");
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
