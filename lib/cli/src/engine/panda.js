// PandaOS engine. Pure logic: pandaEX bonding-curve key math, live Base "action" parsing,
// and the agent's transparent verdict over an action vs your capital. No DOM, no network.
export const short = (a) => (typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) ? a.slice(0, 6) + "…" + a.slice(-4) : a || "");
export const isAddress = (a) => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(String(a).trim());
const num = (v) => { const x = parseFloat(String(v ?? "")); return Number.isFinite(x) ? x : 0; };
export function fmtUsd(v) { v = num(v); const s = v < 0 ? "-" : ""; v = Math.abs(v); if (v >= 1e9) return s + "$" + (v / 1e9).toFixed(2) + "B"; if (v >= 1e6) return s + "$" + (v / 1e6).toFixed(2) + "M"; if (v >= 1e3) return s + "$" + (v / 1e3).toFixed(1) + "k"; return s + "$" + (v < 10 ? v.toFixed(2) : Math.round(v)); }
export function ageText(ms, now = Date.now()) { if (!ms) return "new"; const h = Math.max(0, (now - ms) / 3600000); if (h < 1) return Math.round(h * 60) + "m"; if (h < 48) return Math.round(h) + "h"; return Math.round(h / 24) + "d"; }

// ---- pandaEX bonding curve (friend.tech-style quadratic), priced in $POS ----
export const CURVE_DIV = 16000;
const sumSq = (m) => (m <= 0 ? 0 : (m * (m + 1) * (2 * m + 1)) / 6);
export function keyPrice(supply, div = CURVE_DIV) { const s = Math.max(0, Math.floor(supply)); return ((s + 1) * (s + 1)) / div; }     // price of the NEXT key
export function buyCost(supply, amount, div = CURVE_DIV) {
  const s = Math.max(0, Math.floor(supply)), a = Math.max(0, Math.floor(amount));
  return (sumSq(s + a) - sumSq(s)) / div;   // total $POS to buy `amount` keys starting at `supply`
}
export function sellProceeds(supply, amount, div = CURVE_DIV) {
  const s = Math.max(0, Math.floor(supply)), a = Math.min(Math.max(0, Math.floor(amount)), Math.max(0, Math.floor(supply)));
  return (sumSq(s) - sumSq(s - a)) / div;   // selling burns the top `amount` keys
}
export function keysForBudget(supply, budget, div = CURVE_DIV) {
  let s = Math.max(0, Math.floor(supply)), n = 0, spent = 0;
  while (true) { const p = keyPrice(s + n, div); if (spent + p > budget) break; spent += p; n++; if (n > 100000) break; }
  return { keys: n, cost: spent };
}
export function curvePoints(maxSupply = 40, div = CURVE_DIV) { const pts = []; for (let s = 0; s <= maxSupply; s++) pts.push({ s, p: keyPrice(s, div) }); return pts; }

// ---- live Base actions (the terminal inbox) ----
// from GeckoTerminal pools -> "fresh launch / momentum" actions
export function parseGtActions(json, kind = "launch") {
  const data = (json && json.data) || [], inc = (json && json.included) || [];
  const tok = new Map(); for (const it of inc) if (it && it.type === "token") tok.set(it.id, it.attributes || {});
  const out = [];
  for (const p of data) {
    const a = p.attributes || {}, rel = p.relationships || {};
    const btId = rel.base_token && rel.base_token.data && rel.base_token.data.id;
    const t = (btId && tok.get(btId)) || {};
    const addr = (t.address || "").toLowerCase(); if (!isAddress(addr)) continue;
    const tx = (a.transactions && a.transactions.h24) || {};
    out.push({
      id: "gt-" + addr, kind, title: (t.symbol || "?"), name: t.name || "",
      address: addr, liq: num(a.reserve_in_usd), vol24: num(a.volume_usd && a.volume_usd.h24),
      change24: num(a.price_change_percentage && a.price_change_percentage.h24),
      buys: num(tx.buys), sells: num(tx.sells),
      createdAt: a.pool_created_at ? Date.parse(a.pool_created_at) : 0, dexId: (rel.dex && rel.dex.data && rel.dex.data.id) || ""
    });
  }
  return out;
}
// from DefiLlama yields -> "yield strategy" actions on Base
export function parseYieldActions(json) {
  const data = (json && json.data) || [];
  return data.filter((p) => p.chain === "Base" && num(p.tvlUsd) > 50000 && num(p.apy) > 0 && num(p.apy) < 1000)
    .sort((a, b) => num(b.apy) - num(a.apy)).slice(0, 14)
    .map((p) => ({ id: "yl-" + p.pool, kind: "yield", title: (p.symbol || "pool"), name: p.project, apy: num(p.apy), tvl: num(p.tvlUsd), createdAt: 0 }));
}

// ---- the agent's transparent verdict for an action vs your capital ----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function evalAction(a, capitalUsd = 1000, now = Date.now()) {
  let fit = 50, why = [];
  if (a.kind === "yield") {
    const apyScore = clamp((a.apy / 40) * 60, 0, 60); fit = 20 + apyScore;
    if (a.tvl > 1e6) { fit += 12; why.push("deep TVL"); } else if (a.tvl < 1e5) { fit -= 12; why.push("thin TVL"); }
    why.unshift(a.apy.toFixed(1) + "% APY");
  } else {
    const ageH = a.createdAt ? (now - a.createdAt) / 3600000 : 999;
    const youth = clamp(100 - (ageH / 48) * 100, 0, 100);
    const tot = (a.buys || 0) + (a.sells || 0); const buyP = tot ? a.buys / tot : 0.5;
    const liqFit = a.liq > 1000 ? clamp(100 - Math.abs(Math.log10(a.liq) - 4.6) * 40, 0, 100) : 0;
    fit = youth * 0.34 + liqFit * 0.33 + buyP * 100 * 0.33;
    if (ageH < 6) why.push("fresh"); if (buyP > 0.62) why.push("buy pressure"); if (a.liq < 8000) why.push("low liquidity risk");
  }
  // capital sizing: huge opp vs tiny capital, or dust opp vs big capital, both reduce fit
  const sizeRef = a.kind === "yield" ? a.tvl : a.liq;
  if (sizeRef > 0 && capitalUsd > 0) { const ratio = capitalUsd / sizeRef; if (ratio > 0.2) { fit -= 14; why.push("position would move the pool"); } }
  fit = clamp(Math.round(fit), 0, 100);
  const verdict = fit >= 70 ? "EXECUTE" : fit >= 45 ? "WATCH" : "SKIP";
  return { fit, verdict, why: why.slice(0, 3) };
}
