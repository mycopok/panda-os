# Changelog

## 0.1.0
- Initial open-source release of PandaOS.
- `core`: read-only Base tool layer (Blockscout, GeckoTerminal, DefiLlama, GoPlus, Dexscreener, RPC), the agent loop (LLM tool-calling with a deterministic fallback), action scanners, and the opportunity-scoring engine.
- `cli`: zero-dependency headless terminal (`node cli/src/cli.js stats`).
- `web`: the PandaOS terminal UI (chat, actions inbox, memory, portfolio, configure).
- Non-custodial throughout: the agent drafts, you sign.
