# 🐼 PandaOS agent (`panda-agent`)

**The open-source, non-custodial Base agent terminal.** A tiny, dependency-free CLI that reads
the Base network for you: live stats, your wallet, freshly-launched pools, yields, and a
transparent opportunity verdict on any token. It researches and drafts. It never holds your keys.

The command-line companion to the **PandaOS** terminal (this repo). Same engine, headless.

```
  ██████   PandaOS agent · the open-source Base terminal
  ██  ██   read-only · non-custodial · $POS
```

## Why
AI agents are becoming the way people touch crypto. That layer should be **open, auditable and
self-hostable**, not a black box that holds your funds. `panda-agent` is exactly that: a small,
readable agent you run yourself. It has **no write capability** — it can read chain data, score
opportunities and explain what it would do; signing always stays in your own wallet.

## Quickstart
Requires **Node 18+**. No build step, no API keys needed.

```bash
git clone https://github.com/mycopok/panda-os
cd panda-os/cli
npm start            # interactive terminal
# or one-shot:
node src/cli.js stats
node src/cli.js scan
node src/cli.js inspect 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed
```

That's it. It works out of the box against public, key-free endpoints.

## Commands
| command | what it does |
|---|---|
| `stats` | live Base network stats (txns, blocks, gas, ETH price) |
| `gas` | current Base gas price |
| `balance <addr>` | ETH balance (defaults to `WALLET_ADDRESS`) |
| `holdings <addr>` | token holdings of an address, by USD value |
| `scan` | freshly-launched Base pools, agent-scored |
| `trending` | trending Base pools, agent-scored |
| `yields` | top Base yield strategies (DefiLlama) |
| `inspect <token>` | security + market for a token (GoPlus + Dexscreener) |
| `score <token>` | the agent's opportunity verdict for a token |
| `curve <supply> <amt>` | pandaEX bonding-curve key price / cost |
| `help`, `clear`, `exit` | |

## Natural language (optional)
Set an OpenAI-compatible key and the agent will route plain English to the right tool:
```bash
cp .env.example .env   # then set OPENAI_API_KEY
# "what's gas right now" -> gas ; "show me fresh launches" -> scan
```
Without a key it uses the built-in command parser — fully functional.

## Data sources
All public, key-free, read-only: Base RPC (`mainnet.base.org`), Blockscout v2, GeckoTerminal,
DefiLlama yields, GoPlus token security, Dexscreener. Swap the RPC via `BASE_RPC`.

## How the score works
The opportunity verdict (`EXECUTE` / `WATCH` / `SKIP`) is a transparent heuristic over real
metrics — youth, liquidity depth, buy/sell pressure, and how your capital sizes against the pool.
It is **not** financial advice or a price prediction. Read `src/engine/panda.js`; it is ~80 lines
and unit-tested (`npm test`).

## Security model
- **No private keys, ever.** The agent has no signing path. It cannot move funds.
- **Read-only.** It fetches public data and computes. Nothing is written on-chain.
- Treat outputs as research. Verify everything before you act in your own wallet.

## Disclaimer
Experimental software. On-chain activity carries risk. You are responsible for your own wallets
and decisions. Provided as-is under the MIT License.
