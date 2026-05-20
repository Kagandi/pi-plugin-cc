---
description: Check whether the local Pi CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" setup --json $ARGUMENTS
```

If the result says Pi is unavailable:
- Present the guidance to ensure `pi` is installed and available on PATH.
- Do not attempt any installation automatically.

Output rules:
- Present the final setup output to the user.
- If Pi is available, present the original setup output.
- If Pi is configured but needs environment setup, preserve the guidance.
