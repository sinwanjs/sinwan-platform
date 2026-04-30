import { Sinwan } from "./sinwan";
import type { SinwanConfig } from "./types";

const sinwan = (config: SinwanConfig) => new Sinwan(config);

export { sinwan, type SinwanConfig };
