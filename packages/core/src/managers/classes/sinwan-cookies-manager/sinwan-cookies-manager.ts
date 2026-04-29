import { Manager } from "../../manager";

export class SinwanCookiesManager implements Manager {
  name: string;

  constructor() {
    this.name = "sinwan-cookies-manager";
  }

  async init(): Promise<void> {
    // Implementation for initialization
  }

  async destroy(): Promise<void> {
    // Implementation for destruction
  }
}
