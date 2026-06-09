// PandaOS agent: maps a command (or natural language, if an LLM key is set) to a read-only
// Base tool and returns formatted text. Non-custodial: it never holds keys or signs.
import * as base from "./base.js";
import { fmtUsd, ageText, short, isAddress, parseGtActions, parseYieldActions, evalAction, keyPrice, buyCost, keysForBudget } from "./engine/panda.js";

export const TOOLS = ["help","stats","gas","balance","holdings","scan","trending","yields","inspect","score","curve","clear","exit"];

const n = (v) => { const x = parseFloat(String(v ?? "")); return Number.isFinite(x) ? x : 0; };
const line = (l) => l.join("\n");

function parseCommand(input) {
  const s = input.trim(); if (!s) return null;
  const [cmd, ...rest] = s.split(/\s+/); const c = cmd.toLowerCase();
  if (TOOLS.includes(c)) return { tool: c, args: rest };
  return null;
}

// optional natural-language intent via an OpenAI-compatible endpoint
async function llmIntent(input) {
  const key = process.env.OPENAI_API_KEY; if (!key) return null;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const r = await fetch(baseUrl + "/chat/completions", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, temperature: 0, messages: [
        { role: "system", content: "You route a user's request to ONE Base tool. Reply ONLY with compact JSON {\"tool\":\"<one of: " + TOOLS.join(",") + ">\",\"args\":[\"...\"]}. Tools: stats(network), gas, balance <addr>, holdings <addr>, scan(fresh pools), trending, yields, inspect <token>, score <token>, curve <supply> <amount>. If unsure use stats." },
        { role: "user", content: input } ] }) });
    const j = await r.json(); const txt = j.choices?.[0]?.message?.content || "";
    const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
    const o = JSON.parse(m[0]); if (o && TOOLS.includes(o.tool)) return { tool: o.tool, args: o.args || [] };
  } catch { /* fall through */ }
  return null;
}

export async function route(input) {
  let intent = parseCommand(input);
  if (!intent) intent = await llmIntent(input);
  if (!intent) return line(["i did not catch that. type `help` for commands" + (process.env.OPENAI_API_KEY ? "" : " (set OPENAI_API_KEY for natural language)") + "."]);
  return run(intent.tool, intent.args);
}

export async function run(tool, args = []) {
  switch (tool) {
    case "help": return line([
      "PandaOS agent — read-only Base terminal. commands:",
      "  stats                 live Base network stats",
      "  gas                   current Base gas price",
      "  balance <addr>        ETH balance (uses WALLET_ADDRESS if omitted)",
      "  holdings <addr>       token holdings of an address",
      "  scan                  freshly-launched Base pools, scored",
      "  trending              trending Base pools, scored",
      "  yields                top Base yield strategies (DefiLlama)",
      "  inspect <token>       security + market for a token (GoPlus + Dexscreener)",
      "  score <token>         the agent's opportunity verdict for a token",
      "  curve <supply> <amt>  pandaEX bonding-curve key price / cost",
      "  clear, exit",
      "non-custodial: this agent never holds keys. it researches and drafts; you sign in your own wallet."
    ]);
    case "stats": { const s = await base.networkStats(); if (!s || s._error) return "could not reach Base stats (" + (s && s._error) + ")";
      return line(["BASE MAINNET",
        "  total txns   " + n(s.total_transactions).toLocaleString("en-US"),
        "  txns today   " + n(s.transactions_today).toLocaleString("en-US"),
        "  blocks       " + n(s.total_blocks).toLocaleString("en-US"),
        "  addresses    " + n(s.total_addresses).toLocaleString("en-US"),
        "  avg block    " + (n(s.average_block_time) / 1000).toFixed(2) + "s",
        "  gas          " + n(s.gas_prices && s.gas_prices.average).toFixed(4) + " gwei",
        "  ETH          $" + n(s.coin_price).toLocaleString("en-US")]); }
    case "gas": { const s = await base.networkStats(); if (!s || s._error) return "gas: unreachable"; return "Base gas: " + n(s.gas_prices && s.gas_prices.average).toFixed(4) + " gwei"; }
    case "balance": { const a = (args[0] || process.env.WALLET_ADDRESS || "").trim(); if (!isAddress(a)) return "usage: balance <0x address> (or set WALLET_ADDRESS)";
      const b = await base.ethBalance(a); return b == null ? "balance: unreachable" : short(a) + " holds " + b.toFixed(5) + " ETH"; }
    case "holdings": { const a = (args[0] || process.env.WALLET_ADDRESS || "").trim(); if (!isAddress(a)) return "usage: holdings <0x address>";
      const j = await base.tokenBalances(a); if (!j || j._error || !Array.isArray(j)) return "holdings: unreachable or none";
      const rows = j.filter((x) => x.token && x.value).map((x) => { const dec = n(x.token.decimals) || 18; const amt = Number(BigInt(x.value)) / 10 ** dec; const usd = n(x.token.exchange_rate) * amt; return { sym: x.token.symbol || "?", amt, usd }; }).sort((p, q) => q.usd - p.usd).slice(0, 12);
      if (!rows.length) return short(a) + " holds no indexed tokens";
      return line([short(a) + " holdings:", ...rows.map((r) => "  " + r.sym.padEnd(10) + r.amt.toFixed(4).padStart(16) + (r.usd ? "   " + fmtUsd(r.usd) : ""))]); }
    case "scan": case "trending": { const j = tool === "scan" ? await base.freshPools() : await base.trendingPools(); const acts = parseGtActions(j); if (!acts.length) return tool + ": unreachable or empty";
      const scored = acts.map((a) => ({ ...a, ...evalAction(a, n(process.env.PANDA_CAPITAL) || 1000) })).sort((a, b) => b.fit - a.fit).slice(0, 12);
      return line([tool.toUpperCase() + " on Base (agent-scored):", ...scored.map((a) => "  [" + String(a.verdict).padEnd(7) + " " + String(a.fit).padStart(3) + "] " + (a.title || "?").padEnd(10) + " " + fmtUsd(a.liq).padStart(8) + " liq · " + ageText(a.createdAt).padStart(4) + " · " + (a.why || []).join(", "))]); }
    case "yields": { const j = await base.yields(); const ys = parseYieldActions(j); if (!ys.length) return "yields: unreachable or empty";
      return line(["TOP BASE YIELDS:", ...ys.slice(0, 12).map((y) => "  " + (y.title || "?").padEnd(12) + " " + y.apy.toFixed(1).padStart(6) + "% APY  " + fmtUsd(y.tvl).padStart(8) + " TVL  (" + y.name + ")")]); }
    case "inspect": { const a = (args[0] || "").trim(); if (!isAddress(a)) return "usage: inspect <0x token>";
      const [gp, m, hc] = await Promise.all([base.tokenSecurity(a), base.tokenMarket(a), base.holderCount(a)]);
      const out = ["INSPECT " + short(a)];
      const pairs = (m && m.pairs) || []; const best = pairs.sort((x, y) => n(y.liquidity && y.liquidity.usd) - n(x.liquidity && x.liquidity.usd))[0];
      if (best) out.push("  market   " + (best.baseToken && best.baseToken.symbol || "?") + " · " + fmtUsd(n(best.liquidity && best.liquidity.usd)) + " liq · " + fmtUsd(n(best.volume && best.volume.h24)) + " vol24 · " + n(best.priceChange && best.priceChange.h24).toFixed(1) + "% 24h");
      if (hc && hc.token_holders_count) out.push("  holders  " + n(hc.token_holders_count).toLocaleString("en-US"));
      const r = gp && gp.result && Object.values(gp.result)[0];
      if (r) { out.push("  honeypot " + (String(r.is_honeypot) === "1" ? "YES (danger)" : "no") + " · tax " + (n(r.buy_tax) * 100).toFixed(0) + "%/" + (n(r.sell_tax) * 100).toFixed(0) + "% · " + (String(r.is_open_source) === "1" ? "verified" : "unverified") + " · " + (String(r.is_mintable) === "1" ? "mintable" : "fixed supply")); }
      else out.push("  security unavailable");
      return line(out); }
    case "score": { const a = (args[0] || "").trim(); if (!isAddress(a)) return "usage: score <0x token>";
      const m = await base.tokenMarket(a); const pairs = (m && m.pairs) || []; const p = pairs.sort((x, y) => n(y.liquidity && y.liquidity.usd) - n(x.liquidity && x.liquidity.usd))[0];
      if (!p) return "score: no market found"; const tx = (p.txns && p.txns.h24) || {};
      const act = { kind: "launch", liq: n(p.liquidity && p.liquidity.usd), buys: n(tx.buys), sells: n(tx.sells), change24: n(p.priceChange && p.priceChange.h24), createdAt: n(p.pairCreatedAt) };
      const e = evalAction(act, n(process.env.PANDA_CAPITAL) || 1000);
      return line(["VERDICT " + (p.baseToken && p.baseToken.symbol || short(a)) + ": " + e.verdict + " (fit " + e.fit + ")", "  reasons: " + (e.why.join(", ") || "neutral signals")]); }
    case "curve": { const supply = Math.max(0, parseInt(args[0] || "0") || 0), amt = Math.max(1, parseInt(args[1] || "1") || 1);
      const price = keyPrice(supply), cost = buyCost(supply, amt);
      return line(["pandaEX bonding curve (in $POS):", "  next key @ supply " + supply + " = " + price.toFixed(6), "  buy " + amt + " keys = " + cost.toFixed(6) + " $POS total", "  (price grows with the square of supply; selling burns the top keys)"]); }
    default: return "unknown tool";
  }
}
