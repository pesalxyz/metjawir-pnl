type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ?? {})
  };

  if (level === "ERROR") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (process.env.NODE_ENV === "development" || level !== "DEBUG") {
    console.log(JSON.stringify(payload));
  }
}
