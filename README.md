# Pi plugin for Claude Code

Use Pi from inside Claude Code for code reviews or to delegate tasks to Pi.

This plugin is for Claude Code users who want an easy way to start using Pi from the workflow
they already have.

## What You Get

- `/pi:review` for a normal read-only Pi review
- `/pi:adversarial-review` for a steerable challenge review
- `/pi:rescue`, `/pi:status`, `/pi:result`, and `/pi:cancel` to delegate work and manage background jobs

## Requirements

- **API key or local model support.**
  - Pi works with a variety of models including hosted APIs and local models. Check your provider's documentation for pricing.
- **Node.js 18.18 or later**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add Kagandi/pi-plugin-cc
```

Install the plugin:

```bash
/plugin install Kagandi@pi
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/pi:setup
```

`/pi:setup` will tell you whether Pi is ready. If Pi is missing and npm is available, it can offer to install Pi for you.

If you prefer to install Pi yourself, use:

```bash
npm install -g @pi/cli
```

If Pi is installed but not logged in yet, run:

```bash
!pi login
```

After install, you should see:

- the slash commands listed below
- the `pi:pi-rescue` subagent in `/agents`

One simple first run is:

```bash
/pi:review --background
/pi:status
/pi:result
```

## Usage

### `/pi:review`

Runs a normal Pi review on your current work. It gives you the same quality of code review as running `/review` inside Pi directly.

> [!NOTE]
> Code review especially for multi-file changes might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. It also supports `--wait` and `--background`. It is not steerable and does not take custom focus text. Use [`/pi:adversarial-review`](#piadversarial-review) when you want to challenge a specific decision or risk area.

Examples:

```bash
/pi:review
/pi:review --base main
/pi:review --background
```

This command is read-only and will not perform any changes. When run in the background you can use [`/pi:status`](#pistatus) to check on the progress and [`/pi:cancel`](#picancel) to cancel the ongoing task.

### `/pi:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler.

It uses the same review target selection as `/pi:review`, including `--base <ref>` for branch review.
It also supports `--wait` and `--background`. Unlike `/pi:review`, it can take extra focus text after the flags.

Use it when you want:

- a review before shipping that challenges the direction, not just the code details
- review focused on design choices, tradeoffs, hidden assumptions, and alternative approaches
- pressure-testing around specific risk areas like auth, data loss, rollback, race conditions, or reliability

Examples:

```bash
/pi:adversarial-review
/pi:adversarial-review --base main challenge whether this was the right caching and retry design
/pi:adversarial-review --background look for race conditions and question the chosen approach
```

This command is read-only. It does not fix code.

### `/pi:rescue`

Hands a task to Pi through the `pi:pi-rescue` subagent.

Use it when you want Pi to:

- investigate a bug
- try a fix
- continue a previous Pi task
- take a faster or cheaper pass with a smaller model

> [!NOTE]
> Depending on the task and the model you choose these tasks might take a long time and it's generally recommended to force the task to be in the background or move the agent to the background.

It supports `--background`, `--wait`, `--resume`, and `--fresh`. If you omit `--resume` and `--fresh`, the plugin can offer to continue the latest rescue thread for this repo.

Examples:

```bash
/pi:rescue investigate why the tests started failing
/pi:rescue fix the failing test with the smallest safe patch
/pi:rescue --resume apply the top fix from the last run
/pi:rescue --model your-model-name --effort medium investigate the flaky integration test
/pi:rescue --model spark fix the issue quickly
/pi:rescue --background investigate the regression
```

You can also just ask for a task to be delegated to Pi:

```text
Ask Pi to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--model` or `--effort`, Pi chooses its own defaults.
- pass any model name through as-is; Pi will use it directly
- follow-up rescue requests can continue the latest Pi task in the repo

### `/pi:status`

Shows running and recent Pi jobs for the current repository.

Examples:

```bash
/pi:status
/pi:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/pi:result`

Shows the final stored Pi output for a finished job.
When available, it also includes the Pi session ID so you can reopen that run directly in Pi with `pi resume <session-id>`.

Examples:

```bash
/pi:result
/pi:result task-abc123
```

### `/pi:cancel`

Cancels an active background Pi job.

Examples:

```bash
/pi:cancel
/pi:cancel task-abc123
```

### `/pi:setup`

Checks whether Pi is installed and authenticated.
If Pi is missing and npm is available, it can offer to install Pi for you.

You can also use `/pi:setup` to manage the optional review gate.

#### Enabling review gate

```bash
/pi:setup --enable-review-gate
/pi:setup --disable-review-gate
```

When the review gate is enabled, the plugin uses a `Stop` hook to run a targeted Pi review based on Claude's response. If that review finds issues, the stop is blocked so Claude can address them first.

> [!WARNING]
> The review gate can create a long-running Claude/Pi loop and may drain usage limits quickly. Only enable it when you plan to actively monitor the session.

## Typical Flows

### Review Before Shipping

```bash
/pi:review
```

### Hand A Problem To Pi

```bash
/pi:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```bash
/pi:adversarial-review --background
/pi:rescue --background investigate the flaky test
```

Then check in with:

```bash
/pi:status
/pi:result
```

## Pi Integration

The Pi plugin wraps the [Pi CLI](https://docs.pi.dev/cli). It uses the global `pi` binary installed in your environment and [applies the same configuration](https://docs.pi.dev/config).

### Common Configurations

If you want to change the default reasoning effort or the default model that gets used by the plugin, you can define that inside your user-level or project-level `config.toml`. For example to always use a specific model on a specific effort for a project you can add the following to a `.pi/config.toml` file at the root of the directory you started Claude in:

```toml
model = "your-model-name"
model_reasoning_effort = "high"
```

Your configuration will be picked up based on:

- user-level config in `~/.pi/config.toml`
- project-level overrides in `.pi/config.toml`
- project-level overrides only load when the [project is trusted](https://docs.pi.dev/config)

Check out the Pi docs for more [configuration options](https://docs.pi.dev/config).

### Moving The Work Over To Pi

Delegated tasks and any [stop gate](#what-does-the-review-gate-do) run can also be directly resumed inside Pi by running `pi resume` either with the specific session ID you received from running `/pi:result` or `/pi:status` or by selecting it from the list.

This way you can review the Pi work or continue the work there.

## FAQ

### Do I need a separate Pi account for this plugin?

If you are already signed into Pi on this machine, that account should work immediately here too. This plugin uses your local Pi CLI authentication.

If you only use Claude Code today and have not used Pi yet, you will also need to configure Pi with your preferred provider. [`pi login`](https://docs.pi.dev/cli/reference/#pi-login) supports API keys and other authentication methods. Run `/pi:setup` to check whether Pi is ready, and use `!pi login` if it is not.

### Does the plugin use a separate Pi runtime?

No. This plugin delegates through your local [Pi CLI](https://docs.pi.dev/cli/) on the same machine.

That means:

- it uses the same Pi install you would use directly
- it uses the same local authentication state
- it uses the same repository checkout and machine-local environment

### Will it use the same Pi config I already have?

Yes. If you already use Pi, the plugin picks up the same [configuration](#common-configurations).

### Can I keep using my current API key or base URL setup?

Yes. Because the plugin uses your local Pi CLI, your existing sign-in method and config still apply.

If you need to point the provider at a different endpoint, configure it in your [Pi config](https://docs.pi.dev/config).
