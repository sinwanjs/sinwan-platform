import { Logger, type LoggerOptions, LogLevel } from "./sinwan-logger";

interface LoggerConfig {
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
 *  level: LogLevel.DEBUG,
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
  new Logger(config?.appName, config?.context, config?.option);

export { logger, LogLevel, type LoggerConfig };
