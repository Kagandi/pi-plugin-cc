import { binaryAvailable } from "./process.mjs";
import { runPiTurn, interruptPiProcess } from "./pi-rpc.mjs";

const PI_SESSION_ID_ENV = "PI_COMPANION_SESSION_ID";
const TASK_THREAD_PREFIX = "Pi Companion Task";
const DEFAULT_CONTINUE_PROMPT =
  "Continue from the current thread state. Pick the next highest-value step and follow through until the task is resolved.";

function shorten(text, limit = 72) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

export function getPiAvailability(cwd) {
  const status = binaryAvailable("pi", ["--version"], { cwd });
  if (!status.available) {
    return status;
  }
  return {
    available: true,
    detail: `${status.detail}; pi CLI available`
  };
}

export function getSessionRuntimeStatus(env = process.env, cwd = process.cwd()) {
  const sessionId = env?.[PI_SESSION_ID_ENV] ?? null;
  if (sessionId) {
    return {
      mode: "session-scoped",
      label: "session-scoped session",
      detail: "This Claude session has an active Pi companion session.",
      sessionId
    };
  }

  return {
    mode: "direct",
    label: "direct startup",
    detail: "No active Pi companion session. The first review or task command will spawn pi on demand.",
    sessionId: null
  };
}

export function buildTaskThreadName(prompt) {
  const excerpt = shorten(prompt, 56);
  return excerpt ? `${TASK_THREAD_PREFIX}: ${excerpt}` : TASK_THREAD_PREFIX;
}

export function parseStructuredOutput(rawOutput, fallback = {}) {
  if (!rawOutput) {
    return {
      parsed: null,
      parseError: fallback.failureMessage ?? "Pi did not return a final structured message.",
      rawOutput: rawOutput ?? "",
      ...fallback
    };
  }

  try {
    return {
      parsed: JSON.parse(rawOutput),
      parseError: null,
      rawOutput,
      ...fallback
    };
  } catch (error) {
    return {
      parsed: null,
      parseError: error.message,
      rawOutput,
      ...fallback
    };
  }
}

export { runPiTurn, interruptPiProcess, DEFAULT_CONTINUE_PROMPT, TASK_THREAD_PREFIX, PI_SESSION_ID_ENV };
