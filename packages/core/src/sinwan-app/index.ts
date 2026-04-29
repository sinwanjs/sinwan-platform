import { SinwanApp } from "./sinwan-app";
import type { SinwanConfig } from "./types";

const sinwan = (config: SinwanConfig) => new SinwanApp(config);

const app = sinwan({
  name: "My Sinwan App",
  port: 3000,
  grpcPort: 50051,
  tcpPort: 4000,
  udpPort: 4001,
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
