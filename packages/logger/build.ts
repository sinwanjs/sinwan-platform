import { $ } from "bun";
import { logger } from "./src";

await $`bunx rimraf dist`;
await $`bunx tsc -p tsconfig.build.json`;

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  minify: true,
});

logger({ context: "Logger build" }).info("Logger package built successfully.");
