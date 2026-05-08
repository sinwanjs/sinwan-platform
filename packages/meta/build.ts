import { $ } from "bun";
import { logger } from "@sinwan/logger";

await $`bunx rimraf dist`;
await $`bunx tsc -p tsconfig.build.json`;

await Bun.build({
  entrypoints: ["./src/index.ts", "./src/patch.ts"],
  outdir: "./dist",
  minify: true,
});

logger({ context: "Meta build" }).info("Meta package built successfully.");
