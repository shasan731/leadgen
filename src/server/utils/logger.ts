type LogPayload = Record<string, unknown>;

function write(level: "info" | "warn" | "error", event: string, payload: LogPayload = {}) {
  const record = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload
  };
  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, payload?: LogPayload) => write("info", event, payload),
  warn: (event: string, payload?: LogPayload) => write("warn", event, payload),
  error: (event: string, payload?: LogPayload) => write("error", event, payload)
};
