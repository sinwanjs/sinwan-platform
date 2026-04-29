import { SinwanApp } from "./sinwan-app";
import type { SinwanConfig } from "./types";

const sinwan = (config: SinwanConfig) => new SinwanApp(config);

const app = sinwan({
  development: true,
  name: "My Sinwan App",
  protocols: [
    { name: "http", port: 8080, hostname: "localhost" },
    { name: "grpc", port: 50051, hostname: "localhost" },
  ],
  modules: [],
  managers: {
    ws: true,
    jwt: true,
    graphql: true,
    grpc: true,
    openapi: true,
    tcp: true,
    udp: true,
  },
});

await app.start(async () => {
  await app.stop();
});

process.on("SIGINT", async () => {
  console.log("\nGracefully shutting down...");
  await app.stop();
  process.exit(0);
});

export { sinwan, type SinwanConfig };
