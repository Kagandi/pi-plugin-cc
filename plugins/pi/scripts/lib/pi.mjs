import { spawn } from "node:child_process";
import fs from "node:fs";
import { binaryAvailable } from "./process.mjs";

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

export async function spawnPiProcess(cwd, prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ["--mode", "rpc"];
    if (options.model) {
      args.push("--model", options.model);
    }
    if (options.write) {
      args.push("--write");
    }
    if (options.effort) {
      args.push("--effort", options.effort);
    }

    const child = spawn("pi", args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      options.onProgress?.({ message: data.toString().trim(), phase: "running" });
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      options.onProgress?.({ message: data.toString().trim(), phase: "stderr" });
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to spawn pi: ${error.message}`));
    });

    child.on("close", (code) => {
      resolve({
        pid: child.pid,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code
      });
    });

    // Send prompt via stdin
    child.stdin.write(`${prompt}\n`);
    child.stdin.end();
  });
}

export function interruptPiProcess(pid) {
  if (!pid || !Number.isFinite(pid)) {
    return { attempted: false, interrupted: false, detail: "no pid" };
  }

  try {
    process.kill(pid, "SIGINT");
    return { attempted: true, interrupted: true, detail: `Sent SIGINT to ${pid}.` };
  } catch (error) {
    if (error.code === "ESRCH") {
      return { attempted: true, interrupted: false, detail: `Process ${pid} not found.` };
    }
    return { attempted: true, interrupted: false, detail: error.message };
  }
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

export function readOutputSchema(schemaPath) {
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

export { DEFAULT_CONTINUE_PROMPT, TASK_THREAD_PREFIX, PI_SESSION_ID_ENV };
