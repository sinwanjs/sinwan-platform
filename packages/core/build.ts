import { $ } from "bun";

await $`bunx rimraf dist`;
await $`bunx tsc -p tsconfig.build.json`;

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  minify: true,
});
