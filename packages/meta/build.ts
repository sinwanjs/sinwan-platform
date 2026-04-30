import { $ } from "bun";

await $`bunx tsc -p tsconfig.build.json`;

await Bun.build({
  entrypoints: ["./src/index.ts", "./src/patch.ts"],
  outdir: "./dist",
  minify: true,
});
