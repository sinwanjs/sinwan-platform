/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    Sinwan — Dev Logger                       ║
 * ║  Production-grade · Colored · Leveled · Child-aware · Fast   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Types & Enums ──────────────────────────────────────────────────────────────

export type ChangeType = "+" | "~" | "-";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
  SILENT = 5,
}

const LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL,
  silent: LogLevel.SILENT,
};

export interface LoggerOptions {
  /** Minimum level to emit. Defaults to DEBUG in dev, INFO in prod. */
  level?: LogLevel;
  /** Emit newline-delimited JSON instead of ANSI output (e.g. in CI/prod). */
  json?: boolean;
  /** Extra static fields merged into every JSON log line. */
  meta?: Record<string, unknown>;
  /** Indicates if the logger is in development mode or production if production development: false. */
  development?: boolean;
}

// ── ANSI Palette ───────────────────────────────────────────────────────────────

const C = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

// ── Logger ─────────────────────────────────────────────────────────────────────

export class Logger {
  private readonly minLevel: LogLevel;
  private readonly json: boolean;
  private readonly meta: Record<string, unknown>;
  private readonly timers = new Map<string, number>();
  private readonly development: boolean;

  constructor(
    private readonly appName?: string,
    private readonly context?: string,
    options: LoggerOptions = {
      level: undefined,
      json: undefined,
      meta: undefined,
      development: true,
    },
  ) {
    // Resolve log level: options → LOG_LEVEL env → NODE_ENV heuristic
    const envLevel =
      typeof process !== "undefined"
        ? LEVEL_MAP[(process.env.LOG_LEVEL ?? "").toLowerCase()]
        : undefined;

    const defaultLevel =
      typeof process !== "undefined" && process.env.NODE_ENV === "production"
        ? LogLevel.INFO
        : LogLevel.DEBUG;

    this.minLevel = options.level ?? envLevel ?? defaultLevel;
    this.json =
      options.json ??
      (typeof process !== "undefined" && process.env.LOG_JSON === "1");
    this.meta = options.meta ?? {};
    this.development = options.development ?? true;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private timestamp(): string {
    const now = new Date();
    const date = now.toLocaleDateString("en-CA");
    const time = now.toLocaleTimeString("en-US", { hour12: false });
    return `${date}, ${time}`;
  }

  private emit(
    levelStr: string,
    levelEnum: LogLevel,
    color: string,
    msg: string,
    extra?: Record<string, unknown>,
  ): void {
    if (levelEnum < this.minLevel) return;

    if (this.json) {
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        app: this.appName || "sinwan",
        ctx: this.context,
        level: levelStr,
        msg,
        ...this.meta,
        ...extra,
      });
      process.stdout.write(line + "\n");
      return;
    }

    const paddedLevel = levelStr.toUpperCase().padStart(6);
    const prefix =
      `${C.green}[${this.appName || "sinwan"}]${C.reset}` +
      ` ${C.gray}${this.timestamp()}${C.reset}` +
      ` ${color}${paddedLevel}${C.reset}` +
      ` ${C.yellow}[${this.context}]${C.reset}`;

    console.log(`${prefix} ${msg}`);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  ready(msg: string): void {
    this.emit("ready", LogLevel.INFO, C.green, `${C.green}${msg}${C.reset}`);
  }

  event(msg: string): void {
    this.emit("event", LogLevel.INFO, C.cyan, `${C.cyan}${msg}${C.reset}`);
  }

  wait(msg: string): void {
    this.emit("wait", LogLevel.INFO, C.cyan, `${C.cyan}${msg}${C.reset}`);
  }

  info(msg: string): void {
    this.emit("info", LogLevel.INFO, C.blue, `${C.white}${msg}${C.reset}`);
  }

  warn(msg: string): void {
    this.emit("warn", LogLevel.WARN, C.yellow, `${C.yellow}${msg}${C.reset}`);
  }

  error(msg: string, err?: unknown): void {
    this.emit("error", LogLevel.ERROR, C.red, `${C.red}${msg}${C.reset}`, {
      ...(err instanceof Error
        ? { errorMessage: err.message, stack: err.stack }
        : err != null
          ? { errorRaw: String(err) }
          : {}),
    });
    if (!this.json && err) console.error(err);
  }

  /**
   * Like `error`, but also throws — use for unrecoverable states.
   */
  fatal(msg: string, err?: unknown): never {
    this.emit(
      "fatal",
      LogLevel.FATAL,
      `${C.bold}${C.red}`,
      `${C.bold}${C.red}${msg}${C.reset}`,
    );
    if (!this.json && err) console.error(err);
    throw err instanceof Error ? err : new Error(msg);
  }

  debug(msg: string): void {
    this.emit(
      "debug",
      LogLevel.DEBUG,
      C.magenta,
      `${C.magenta}${msg}${C.reset}`,
    );
  }

  change(type: ChangeType, file: string): void {
    const icon: Record<ChangeType, string> = {
      "+": `${C.green}+${C.reset}`,
      "~": `${C.yellow}~${C.reset}`,
      "-": `${C.red}-${C.reset}`,
    };
    this.emit(
      "change",
      LogLevel.INFO,
      C.magenta,
      `${icon[type]} ${C.bold}${file}${C.reset}`,
    );
  }

  // ── Perf Timers ────────────────────────────────────────────────────────────

  /**
   * Start a named timer.
   * @example logger.timer("db:connect");
   */
  timer(label: string): void {
    this.timers.set(label, performance.now());
    this.emit("timer", LogLevel.DEBUG, C.cyan, `${C.cyan}▶ ${label}${C.reset}`);
  }

  /**
   * End a named timer and log elapsed ms.
   * @example logger.timerEnd("db:connect");
   */
  timerEnd(label: string): number {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.warn(`timerEnd("${label}") called without a matching timer()`);
      return -1;
    }
    const ms = +(performance.now() - start).toFixed(2);
    this.timers.delete(label);
    const color = ms < 100 ? C.green : ms < 500 ? C.yellow : C.red;
    this.emit(
      "timer",
      LogLevel.DEBUG,
      C.cyan,
      `${C.cyan}■ ${label}${C.reset} ${color}${ms}ms${C.reset}`,
      { label, ms },
    );
    return ms;
  }

  // ── Child Loggers ──────────────────────────────────────────────────────────

  /**
   * Create a child logger that inherits all settings but with a sub-context.
   * @example const db = logger.child("Database");
   */
  child(subContext: string, extraMeta?: Record<string, unknown>): Logger {
    return new Logger(this.appName, `${this.context}:${subContext}`, {
      level: this.minLevel,
      json: this.json,
      meta: { ...this.meta, ...extraMeta },
    });
  }

  // ── Banner ─────────────────────────────────────────────────────────────────

  banner(): void {
    const { blue, cyan, magenta, bold, reset, dim, green, yellow } = C;

    //
    // Layout math (all values are VISIBLE character widths, ANSI codes excluded):
    //
    //   Letter widths  →  S=8  I=3  N=10  W=10  A=8  N=10  →  total=49
    //   Inter-letter gaps: 3 spaces × 5 gaps = 15
    //   ASCII art row width = 49 + 15 = 64
    //
    //   Box inner width = 76
    //   Side padding = (76 − 64) / 2 = 6 spaces on each side  ✓
    //
    //   Subtitle visual width = 70
    //   Side padding = (76 − 70) / 2 = 3 spaces on each side  ✓
    //

    const B = "║"; // box side char
    const lp = "      "; // 6-space left pad  (art rows)
    const rp = "      "; // 6-space right pad (art rows)
    const g = "   "; // 3-space inter-letter gap
    const IW = 76; // inner width (between ║ chars)

    const blank = `${dim}${B}${reset}${" ".repeat(IW)}${dim}${B}${reset}`;

    // ── Box top ──────────────────────────────────────────────────────────────
    console.log();
    console.log(`${dim}╔${"═".repeat(IW)}╗${reset}`);
    console.log(blank);

    // ── ASCII art rows ────────────────────────────────────────────────────────
    const row = (
      s: string,
      i: string,
      n1: string,
      w: string,
      a: string,
      n2: string,
    ) =>
      `${dim}${B}${reset}${lp}` +
      `${blue}${bold}${s}${reset}${g}` +
      `${cyan}${bold}${i}${reset}${g}` +
      `${green}${bold}${n1}${reset}${g}` +
      `${yellow}${bold}${w}${reset}${g}` +
      `${magenta}${bold}${a}${reset}${g}` +
      `${cyan}${bold}${n2}${reset}` +
      `${rp}${dim}${B}${reset}`;

    console.log(
      row(
        "███████╗",
        "██╗",
        "███╗   ██╗",
        "██╗    ██╗",
        " █████╗ ",
        "███╗   ██╗",
      ),
    );
    console.log(
      row(
        "██╔════╝",
        "██║",
        "████╗  ██║",
        "██║    ██║",
        "██╔══██╗",
        "████╗  ██║",
      ),
    );
    console.log(
      row(
        "███████╗",
        "██║",
        "██╔██╗ ██║",
        "██║ █╗ ██║",
        "███████║",
        "██╔██╗ ██║",
      ),
    );
    console.log(
      row(
        "╚════██║",
        "██║",
        "██║╚██╗██║",
        "██║███╗██║",
        "██╔══██║",
        "██║╚██╗██║",
      ),
    );
    console.log(
      row(
        "███████║",
        "██║",
        "██║ ╚████║",
        "╚███╔███╔╝",
        "██║  ██║",
        "██║ ╚████║",
      ),
    );
    console.log(
      row(
        "╚══════╝",
        "╚═╝",
        "╚═╝  ╚═══╝",
        " ╚══╝╚══╝ ",
        "╚═╝  ╚═╝",
        "╚═╝  ╚═══╝",
      ),
    );

    // ── Subtitle (visual width = 70, padded 3 each side) ─────────────────────
    console.log(blank);
    console.log(
      `${dim}${B}${reset}   ` +
        `${dim}${this.development ? "DEV SERVER" : "PRODUCTION"}${reset}` +
        `  ${dim}·${reset}  ${blue}${bold}Bun-native${reset}` +
        `  ${dim}·${reset}  ${cyan}${bold}crash-safe${reset}` +
        `  ${dim}·${reset}  ${magenta}${bold}HMR-ready${reset}` +
        `  ${dim}·${reset}  ${green}${bold}log-leveled${reset}` +
        `   ${dim}${B}${reset}`,
    );
    console.log(blank);

    // ── Box bottom ────────────────────────────────────────────────────────────
    console.log(`${dim}╚${"═".repeat(IW)}╝${reset}`);
    console.log();
  }

  // ── Shortcuts ──────────────────────────────────────────────────────────────

  shortcuts(): void {
    console.log();
    this.info(`${C.dim}Keyboard shortcuts:${C.reset}`);
    console.log(
      `${C.dim}  press ${C.bold}${C.cyan}r${C.reset}${C.dim}  → restart server${C.reset}`,
    );
    console.log(
      `${C.dim}  press ${C.bold}${C.cyan}c${C.reset}${C.dim}  → clear console${C.reset}`,
    );
    console.log(
      `${C.dim}  press ${C.bold}${C.cyan}q${C.reset}${C.dim}  → quit${C.reset}`,
    );
    console.log();
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  separator(): void {
    console.log(`${C.dim}${"─".repeat(70)}${C.reset}`);
  }

  clear(): void {
    process.stdout.write("\x1Bc");
  }

  // ── Inline color helpers (for composing messages) ──────────────────────────

  bold = (t: string) => `${C.bold}${t}${C.reset}`;
  dim = (t: string) => `${C.dim}${t}${C.reset}`;
  cyan = (t: string) => `${C.cyan}${t}${C.reset}`;
  yellow = (t: string) => `${C.yellow}${t}${C.reset}`;
  green = (t: string) => `${C.green}${t}${C.reset}`;
  red = (t: string) => `${C.red}${t}${C.reset}`;
  blue = (t: string) => `${C.blue}${t}${C.reset}`;
}
