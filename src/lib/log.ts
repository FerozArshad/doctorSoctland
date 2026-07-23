// Compact structured logging for Vercel — one line per event, errors only verbose.
// Avoid dumping tokens, full HTML emails, or huge payloads.

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, fields?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitize(fields),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

function sanitize(fields?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    const key = k.toLowerCase();
    if (key.includes("token") || key.includes("password") || key.includes("secret") || key.includes("authorization")) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string") {
      out[k] = v.length > 240 ? v.slice(0, 240) + "…" : v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Truncate Meta/API error bodies to a short code + message. */
export function summarizeError(err: unknown): { code?: string | number; message: string } {
  if (err == null) return { message: "unknown" };
  if (typeof err === "string") {
    try {
      const j = JSON.parse(err);
      const e = j.error || j;
      return { code: e.code ?? e.error_subcode, message: String(e.message || err).slice(0, 200) };
    } catch {
      return { message: err.slice(0, 200) };
    }
  }
  if (err instanceof Error) return { message: err.message.slice(0, 200) };
  try {
    return { message: JSON.stringify(err).slice(0, 200) };
  } catch {
    return { message: "unserializable error" };
  }
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
