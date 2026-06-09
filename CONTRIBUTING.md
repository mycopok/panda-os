# Contributing to PandaOS

Thanks for helping build the open agent layer for Base.

## Setup
```bash
pnpm install
pnpm test      # core + cli unit tests
pnpm dev       # the web terminal
```

## Where things live
- `lib/agent` — the agent: tools, the agent loop, scanners, the scoring engine. This is the brain.
- `lib/cli` — a zero-dependency headless terminal.
- `lib/interface` — the web terminal.

## Good first contributions
- Add a new read-only tool source to `lib/agent/tools.ts` and a toggle in the interface.
- Write a new scanner in `lib/agent/scanners.ts`.
- Improve the agent loop or the opportunity-scoring engine (`lib/agent/engine/panda.js`).

## Rules
- Keep it **read-only and non-custodial**. No code that holds keys or signs for the user.
- No invented metrics. If a number is shown, it comes from a real source.
- Run `pnpm test` and `pnpm typecheck` before opening a PR.
