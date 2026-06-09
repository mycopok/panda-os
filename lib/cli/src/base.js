// Base data client. Read-only. Pulls live data from public, key-free endpoints.
// Runs on the user's machine (these hosts are CORS/CLI reachable).
const BS = "https://base.blockscout.com/api/v2";
const GT = "https://api.geckoterminal.com/api/v2/networks/base";
const DS = "https://api.dexscreener.com";
const GP = "https://api.gopluslabs.io/api/v1/token_security/8453";
const RPC = process.env.BASE_RPC || "https://mainnet.base.org";

async function getJSON(url, ms = 14000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { Accept: "application/json", "User-Agent": "panda-agent" } }); clearTimeout(t); if (!r.ok) return { _error: "HTTP " + r.status }; return await r.json(); }
  catch (e) { clearTimeout(t); return { _error: String(e && e.message || e) }; }
}
async function rpc(method, params = []) {
  try { const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); return j.result; }
  catch (e) { return null; }
}
const hexToNum = (h) => (h ? parseInt(h, 16) : 0);

export async function networkStats() { return getJSON(`${BS}/stats`); }
export async function blockNumber() { const h = await rpc("eth_blockNumber"); return hexToNum(h); }
export async function ethBalance(addr) { const h = await rpc("eth_getBalance", [addr, "latest"]); return h ? Number(BigInt(h)) / 1e18 : null; }
export async function tokenBalances(addr) { return getJSON(`${BS}/addresses/${addr}/token-balances`); }
export async function addressInfo(addr) { return getJSON(`${BS}/addresses/${addr}`); }
export async function freshPools(page = 1) { return getJSON(`${GT}/new_pools?include=base_token&page=${page}`); }
export async function trendingPools() { return getJSON(`${GT}/trending_pools?include=base_token&page=1`); }
export async function yields() { return getJSON(`https://yields.llama.fi/pools`); }
export async function tokenSecurity(addr) { return getJSON(`${GP}?contract_addresses=${addr}`); }
export async function tokenMarket(addr) { return getJSON(`${DS}/latest/dex/tokens/${addr}`); }
export async function holderCount(addr) { return getJSON(`${BS}/tokens/${addr}/counters`); }
