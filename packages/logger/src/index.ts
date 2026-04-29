import { Logger, type LoggerOptions } from "./sinwan-logger";

export interface LoggerConfig {
  appName?: string;
  context?: string;
  option?: LoggerOptions;
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Convenience factory — preferred entry point.
 *
 * @example
 * enum LogLevel {
 *   DEBUG = 0,
 *   INFO = 1,
 *   WARN = 2,
 *   ERROR = 3,
 *   FATAL = 4,
 *   SILENT = 5,
 * }
 * const log = logger({ appName: "My-App-Name", context: "Core", option: {
 *  level: "debug",
 *  json: true,
 *  meta: { version: "1.0.0" },
 * } });
 * log.banner();
 * log.ready("Server started on http://localhost:3000");
 *
 * const db = log.child("Database", { pool: 10 });
 * db.timer("connect");
 * // ... connect ...
 * db.timerEnd("connect");
 */
const logger = (config: LoggerConfig) =>
  new Logger(config.appName, config.context, config.option);

const log = logger({
  appName: "My-App-Name",
  context: "Core",
  option: {
    development: false,
  },
});

// log.banner();
// log.ready("Logger initialized");
// log.info("This is an info message");
// log.warn("This is a warning");
// log.error("This is an error");
// // log.fatal("This is a fatal error");
// log.debug("This is a debug message");
// log.event("User logged in");
// log.wait("Waiting for database connection...");
// log.change("+", "src/index.ts");
// log.child("Database", { pool: 10 }).info("Connected to database");

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const fakeDbConnect = () => delay(120); // simule ~120ms
const fakeRedisConnect = () => delay(45); // simule ~45ms
const fakeAiSearch = () => delay(820); // simule ~820ms  (lent → rouge)
const fakeQueryUser = () => delay(80); // simule ~80ms

// ── Test ───────────────────────────────────────────────────────────────────

async function main() {
  log.banner();

  // 🟢 Fast — vert (<100ms)
  log.timer("redis:connect");
  await fakeRedisConnect();
  log.timerEnd("redis:connect");

  // 🟡 Medium — jaune (<500ms)
  log.timer("db:connect");
  await fakeDbConnect();
  log.timerEnd("db:connect");

  // 🔴 Slow — rouge (>500ms)
  log.timer("ai:search");
  await fakeAiSearch();
  const ms = log.timerEnd("ai:search");

  if (ms > 500) log.warn(`AI search trop lent: ${ms}ms — consider caching`);

  // ── Child logger ─────────────────────────────────────────────────────────
  const db = log.child("Database");

  db.timer("user:findById");
  await fakeQueryUser();
  db.timerEnd("user:findById");

  // ── timerEnd sans timer() — doit logger un warn, pas crasher ─────────────
  log.timerEnd("ghost:timer");

  log.ready("All tests passed ✓");
}

main();

export { logger };
