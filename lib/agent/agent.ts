// PandaOS agent loop. With an LLM key it does real tool-calling over our tool layer; without
// one it falls back to a deterministic command parser. Non-custodial: it drafts, never signs.
import { TOOLS, byName } from "./tools.js";
import { isAddress } from "./engine/panda.js";

export type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string; tool_call_id?: string };
export type LLM = { key: string; baseUrl: string; model: string };

function systemPrompt(memory: string, enabled: string[]) {
  return [
    "You are PandaOS, an open-source, non-custodial agent for the Base network.",
    "You read on-chain data with tools and help the user act. You NEVER hold keys or sign:",
    "to act, call draft_action and tell the user to approve it in their own wallet.",
    "Be concise and concrete. Use tools for any live number; never invent figures.",
    enabled.length ? "Enabled tools: " + enabled.join(", ") + "." : "",
    memory.trim() ? "\nUser memory (their standing preferences):\n" + memory.trim() : ""
  ].filter(Boolean).join("\n");
}
export function toolSchemas(enabled: string[]) {
  return TOOLS.filter((t) => enabled.includes(t.name)).map((t) => ({ type: "function", function: { name: t.name, description: t.desc + " params " + t.params, parameters: { type: "object", properties: paramProps(t.params) } } }));
}
function paramProps(p: string) { const o: any = {}; (p.match(/[a-zA-Z_]+/g) || []).forEach((k) => { if (k !== "address" || true) o[k] = { type: "string" }; }); return o; }

// deterministic fallback (no LLM)
function parseCommand(input: string, wallet: string) {
  const s = input.trim(); const low = s.toLowerCase();
  const addr = (s.match(/0x[0-9a-fA-F]{40}/) || [])[0] || "";
  if (/(^|\s)(gas)(\s|$)/.test(low)) return { tool: "gas", args: {} };
  if (/(stat|network|chain)/.test(low)) return { tool: "network_stats", args: {} };
  if (/(holding|portfolio|what do i hold)/.test(low)) return { tool: "holdings", args: { address: addr || wallet } };
  if (/(balance|how much eth)/.test(low)) return { tool: "balance", args: { address: addr || wallet } };
  if (/(yield|apy|farm)/.test(low)) return { tool: "yields", args: {} };
  if (/(trending)/.test(low)) return { tool: "trending", args: {} };
  if (/(scan|fresh|new launch|new pool|early)/.test(low)) return { tool: "scan_new", args: {} };
  if (/(inspect|security|honeypot|safe|rug|check)/.test(low) && addr) return { tool: "inspect", args: { token: addr } };
  if (/(curve|key price|pandaex)/.test(low)) { const nums = (s.match(/\d+/g) || []); return { tool: "curve", args: { supply: nums[0] || "0", amount: nums[1] || "1" } }; }
  if (/(buy|swap|ape|get into|draft|move)/.test(low)) return { tool: "draft_action", args: { summary: s, token: addr } };
  if (addr) return { tool: "inspect", args: { token: addr } };
  return null;
}

export async function ask(input: string, ctx: { memory: string; enabled: string[]; llm: LLM | null; wallet: string }): Promise<{ reply: string; actions: any[]; trace: string[] }> {
  const actions: any[] = []; const trace: string[] = [];
  if (!ctx.llm || !ctx.llm.key) {
    const cmd = parseCommand(input, ctx.wallet);
    if (!cmd) return { reply: "i can: stats, gas, balance, holdings, scan (fresh pools), trending, yields, inspect 0x..., curve. (add an OpenAI key in configure for natural language.)", actions, trace };
    if (!ctx.enabled.includes(cmd.tool)) return { reply: "that tool is turned off in configure.", actions, trace };
    const t = byName(cmd.tool)!; trace.push(cmd.tool); const r = await t.run(cmd.args); if (r.action) actions.push(r.action); return { reply: r.text, actions, trace };
  }
  // LLM tool-calling loop
  const msgs: Msg[] = [{ role: "system", content: systemPrompt(ctx.memory, ctx.enabled) }, { role: "user", content: input }];
  for (let step = 0; step < 5; step++) {
    let j: any;
    try {
      const res = await fetch(ctx.llm.baseUrl.replace(/\/$/, "") + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ctx.llm.key }, body: JSON.stringify({ model: ctx.llm.model, temperature: 0.2, messages: msgs, tools: toolSchemas(ctx.enabled), tool_choice: "auto" }) });
      j = await res.json();
    } catch (e: any) { return { reply: "LLM call failed: " + (e?.message || e) + ". using fallback. try a command.", actions, trace }; }
    const m = j?.choices?.[0]?.message; if (!m) return { reply: "no response from the model.", actions, trace };
    msgs.push({ role: "assistant", content: m.content || "", ...(m.tool_calls ? { tool_calls: m.tool_calls } as any : {}) });
    if (m.tool_calls && m.tool_calls.length) {
      for (const tc of m.tool_calls) {
        const nm = tc.function?.name; const t = byName(nm); let args: any = {}; try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        trace.push(nm);
        const r = t ? await t.run(args) : { text: "unknown tool" };
        if (r.action) actions.push(r.action);
        msgs.push({ role: "tool", tool_call_id: tc.id, name: nm, content: r.text });
      }
      continue;
    }
    return { reply: m.content || "(no text)", actions, trace };
  }
  return { reply: "stopped after several tool calls. try narrowing the request.", actions, trace };
}
