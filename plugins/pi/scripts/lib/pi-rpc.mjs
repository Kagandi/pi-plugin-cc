import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

function createJsonlReader(stream, onLine) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  const onData = (chunk) => {
    buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
    while (true) {
      const nl = buffer.indexOf("\n");
      if (nl === -1) return;
      onLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  };
  const onEnd = () => {
    buffer += decoder.end();
    if (buffer.length > 0) onLine(buffer);
  };
  stream.on("data", onData);
  stream.on("end", onEnd);
  return () => {
    stream.off("data", onData);
    stream.off("end", onEnd);
  };
}

export async function runPiTurn(cwd, prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ["--mode", "rpc", "--no-session"];
    if (options.model) {
      args.push("--model", options.model);
    }
    if (options.effort) {
      args.push("--thinking", options.effort);
    }

    const child = spawn("pi", args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    let lastAssistantText = "";
    let lastAssistantThinking = "";
    const touchedFiles = [];
    let responseReceived = false;
    let completed = false;

    const detachReader = createJsonlReader(child.stdout, (line) => {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }

      if (event.type === "response" && event.command === "prompt") {
        responseReceived = true;
        if (event.success) {
          options.onProgress?.({ message: "Processing...", phase: "running" });
        }
        return;
      }

      if (event.type === "agent_end") {
        completed = true;
        if (Array.isArray(event.messages)) {
          const lastAssistant = [...event.messages].reverse().find((m) => m.role === "assistant");
          if (lastAssistant && Array.isArray(lastAssistant.content)) {
            let extractedText = "";
            let extractedThinking = "";
            for (const part of lastAssistant.content) {
              if (part.type === "text" && part.text) extractedText = part.text;
              if (part.type === "thinking" && part.thinking) extractedThinking = part.thinking;
            }
            if (extractedText) lastAssistantText = extractedText;
            if (extractedThinking) lastAssistantThinking = extractedThinking;
          }
        }
        options.onProgress?.({ message: "Done.", phase: "done" });
        child.stdin.end();
        return;
      }

      if (event.type === "message_end" && event.message?.role === "assistant") {
        if (Array.isArray(event.message.content)) {
          for (const part of event.message.content) {
            if (part.type === "text" && part.text) lastAssistantText = part.text;
            if (part.type === "thinking" && part.thinking) lastAssistantThinking = part.thinking;
          }
        }
      }

      if (event.type === "message_update" && event.assistantMessageEvent) {
        const evt = event.assistantMessageEvent;
        if (evt.type === "text_delta" && evt.delta) {
          lastAssistantText += evt.delta;
        }
        if (evt.type === "text_end" && evt.content) {
          lastAssistantText = evt.content;
        }
        if (evt.type === "thinking_delta" && evt.delta) {
          lastAssistantThinking += evt.delta;
        }
        if (evt.type === "thinking_end" && evt.content) {
          lastAssistantThinking = evt.content;
        }
      }

      if (event.type === "tool_execution_start") {
        const toolName = event.toolName;
        const args = event.args?.command || event.args?.file || JSON.stringify(event.args || {});
        options.onProgress?.({ message: `Running ${toolName}: ${args}`, phase: "running" });
      }

      if (event.type === "tool_execution_end") {
        const toolName = event.toolName;
        if (toolName === "write" || toolName === "edit") {
          const filePath = event.args?.file || event.args?.filePath;
          if (filePath) touchedFiles.push(filePath);
        }
        options.onProgress?.({ message: `${toolName} completed.`, phase: "running" });
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      detachReader();
      reject(new Error(`Failed to spawn pi: ${error.message}`));
    });

    child.on("close", (code) => {
      detachReader();
      resolve({
        pid: child.pid,
        exitCode: code,
        finalMessage: lastAssistantText,
        stderr: stderr.trim(),
        thinking: lastAssistantThinking,
        touchedFiles: [...new Set(touchedFiles)],
        reasoningSummary: lastAssistantThinking ? [lastAssistantThinking] : []
      });
    });

    const command = JSON.stringify({ type: "prompt", message: prompt }) + "\n";
    child.stdin.write(command);
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
