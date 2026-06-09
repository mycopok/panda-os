import { createSignal, onMount, For, Show } from "solid-js";
import { TOOLS, TOOL_GROUPS } from "../../agent/tools.js";
import { ask } from "../../agent/agent.js";
import { isAddress, short } from "../../agent/engine/panda.js";

const CFG: any = (window as any).PANDAOS_CONFIG || {};
const realX = typeof CFG.TWITTER_URL === "string" && CFG.TWITTER_URL.startsWith("https://") && !/SET_/.test(CFG.TWITTER_URL);
const realCA = isAddress(CFG.CONTRACT_ADDRESS || ""); const ca = CFG.CONTRACT_ADDRESS || "";
const LS = (k: string, d: any) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v));

export default function App() {
  const [tab, setTab] = createSignal("chat");
  const [msgs, setMsgs] = createSignal<any[]>([]);
  const [input, setInput] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [actions, setActions] = createSignal<any[]>([]);
  const [memory, setMemory] = createSignal<string>(LS("pos-memory", CFG.DEFAULT_MEMORY || ""));
  const [cfg, setCfg] = createSignal<any>(LS("pos-cfg", { key: "", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", enabled: TOOLS.map(t => t.name) }));
  const [wallet, setWallet] = createSignal("");
  let threadRef: any;

  const enabled = () => cfg().enabled as string[];
  function setCfgPart(p: any) { const c = { ...cfg(), ...p }; setCfg(c); save("pos-cfg", c); }
  function saveMem(v: string) { setMemory(v); save("pos-memory", v); }

  async function send(text?: string) {
    const q = (text ?? input()).trim(); if (!q || busy()) return;
    setInput(""); setMsgs(m => [...m, { id: Date.now() + "u", role: "user", text: q }]); setBusy(true);
    queueMicrotask(() => threadRef && (threadRef.scrollTop = threadRef.scrollHeight));
    const llm = cfg().key ? { key: cfg().key, baseUrl: cfg().baseUrl, model: cfg().model } : null;
    const res = await ask(q, { memory: memory(), enabled: enabled(), llm, wallet: wallet() });
    setMsgs(m => [...m, { id: Date.now() + "b", role: "bot", text: res.reply, trace: res.trace, recs: res.actions }]); setBusy(false);
    queueMicrotask(() => threadRef && (threadRef.scrollTop = threadRef.scrollHeight));
  }

  // action system: run scanners on their intervals
  onMount(async () => {
    const { SCANNERS } = await import("../../agent/scanners.js");
    const runOne = async (sc: any) => { try { const rows = await sc.run(); if (rows.length) setActions(prev => { const have = new Set(prev.map((r: any) => r.id)); return [...rows.filter((r: any) => !have.has(r.id)), ...prev].slice(0, 40); }); } catch {} };
    for (const sc of SCANNERS) { runOne(sc); setInterval(() => runOne(sc), sc.every * 1000); }
    // wallet discovery
    (window as any).addEventListener?.("eip6963:announceProvider", (e: any) => { (window as any)._pos_prov = e.detail.provider; });
    (window as any).dispatchEvent?.(new Event("eip6963:requestProvider"));
  });

  async function connect() {
    const eth = (window as any)._pos_prov || (window as any).ethereum;
    if (!eth) { alert("No EVM wallet found. Install Coinbase Wallet or MetaMask."); return; }
    try { const a = await eth.request({ method: "eth_requestAccounts" }); let cid = await eth.request({ method: "eth_chainId" }); if (cid !== "0x2105") { try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }); } catch {} } setWallet(a[0]); } catch {}
  }
  function execRec(imp: string) { setTab("chat"); send(imp); }
  const recCount = () => actions().length;

  return (
    <div class="os">
      <header class="bar">
        <span class="lg"><img src={CFG.IMG?.logo} alt="" onerror={(e: any) => e.target.style.display = "none"} />Panda<b>OS</b></span>
        <span class="tk">$POS</span>
        <span class="sp" />
        <button class="b" onclick={() => { if (realCA) navigator.clipboard?.writeText(ca); }}>{realCA ? "CA " + short(ca) : "CA soon"}</button>
        <a class="b" href={CFG.GITHUB_URL} target="_blank" rel="noopener">github</a>
        {realX ? <a class="b" href={CFG.TWITTER_URL} target="_blank" rel="noopener">x</a> : <button class="b off">x</button>}
        <a class="b off" href="#">buy</a>
        <button class="b solid" onclick={connect}>{wallet() ? short(wallet()) : "connect"}</button>
      </header>

      <nav class="tabs">
        <button class={tab() === "chat" ? "on" : ""} onclick={() => setTab("chat")}>chat</button>
        <button class={tab() === "actions" ? "on" : ""} onclick={() => setTab("actions")}>actions inbox<Show when={recCount()}><span class="badge">{recCount()}</span></Show></button>
        <button class={tab() === "memory" ? "on" : ""} onclick={() => setTab("memory")}>memory</button>
        <button class={tab() === "portfolio" ? "on" : ""} onclick={() => setTab("portfolio")}>portfolio</button>
        <button class={tab() === "configure" ? "on" : ""} onclick={() => setTab("configure")}>configure</button>
      </nav>

      <Show when={tab() === "chat"}>
        <div class="view chat">
          <div class="thread" ref={threadRef}>
            <Show when={msgs().length} fallback={<div class="empty">PandaOS terminal. read-only + non-custodial.<br/>try a chip or type a command:<br/><br/><span class="chip" onclick={() => send("network stats")}>network stats</span><span class="chip" onclick={() => send("scan fresh launches")}>scan fresh</span><span class="chip" onclick={() => send("top base yields")}>yields</span><span class="chip" onclick={() => send("gas")}>gas</span><br/><span class="note">add an OpenAI key in configure for natural language + multi-step tool use.</span></div>}>
              <For each={msgs()}>{(m) => <>
                <div class={"msg " + (m.role === "user" ? "user" : "bot")}>{m.role === "bot" && m.trace?.length ? <div class="trace">⚙ {m.trace.join(" → ")}</div> : null}{m.text}</div>
                <For each={m.recs || []}>{(a) => <div class="rec"><div class="rt">drafted action</div><div class="rd">{a.summary}{a.token ? " · " + short(a.token) : ""}</div><a href={a.link} target="_blank" rel="noopener"><button>approve in your wallet ↗</button></a></div>}</For>
              </>}</For>
            </Show>
          </div>
          <div class="composer">
            <input placeholder={busy() ? "panda is working…" : "ask panda, or: stats / scan / inspect 0x… / yields"} value={input()} onInput={(e) => setInput(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} disabled={busy()} />
            <button onclick={() => send()} disabled={busy()}>send</button>
          </div>
        </div>
      </Show>

      <Show when={tab() === "actions"}>
        <div class="view">
          <Show when={actions().length} fallback={<div class="note">scanners are sweeping Base… recommendations and alerts will land here.</div>}>
            <For each={actions()}>{(a) => <div class={"act " + (a.kind === "alert" ? "alert" : "")}><div class="ah"><span class="at">{a.title}</span><span class="ak">{a.kind}</span></div><div class="ad">{a.detail}</div><Show when={a.imperative}><button onclick={() => execRec(a.imperative)}>send to chat ▶</button></Show></div>}</For>
          </Show>
        </div>
      </Show>

      <Show when={tab() === "memory"}>
        <div class="view"><div class="note" style="margin-bottom:10px">markdown the agent reads before every move. it shapes recommendations and risk. saved locally.</div>
          <textarea class="mem" value={memory()} onInput={(e) => saveMem(e.currentTarget.value)} /></div>
      </Show>

      <Show when={tab() === "portfolio"}>
        <div class="view"><Portfolio wallet={wallet()} /></div>
      </Show>

      <Show when={tab() === "configure"}>
        <div class="view"><div class="cfg">
          <h3>agent model (optional)</h3>
          <div class="note">leave blank to use the built-in command parser. with an OpenAI-compatible key, panda does natural language + multi-step tool calls. stored only in your browser.</div>
          <div class="row"><label>API key</label><input type="password" value={cfg().key} onInput={(e) => setCfgPart({ key: e.currentTarget.value })} placeholder="sk-…" /></div>
          <div class="row"><label>base url</label><input value={cfg().baseUrl} onInput={(e) => setCfgPart({ baseUrl: e.currentTarget.value })} /></div>
          <div class="row"><label>model</label><input value={cfg().model} onInput={(e) => setCfgPart({ model: e.currentTarget.value })} /></div>
          <h3>tools / protocols</h3>
          <For each={TOOL_GROUPS}>{(g) => <For each={TOOLS.filter(t => t.group === g)}>{(t) => <label class="toggle"><input type="checkbox" checked={enabled().includes(t.name)} onChange={(e) => { const s = new Set(enabled()); e.currentTarget.checked ? s.add(t.name) : s.delete(t.name); setCfgPart({ enabled: [...s] }); }} />{t.name}<span class="g">{t.group}</span></label>}</For>}</For>
          <h3>security</h3>
          <div class="note">PandaOS is non-custodial. it has no signing path. it reads data and drafts actions; you approve everything in your own wallet. open-source, MIT.</div>
        </div></div>
      </Show>
    </div>
  );
}

function Portfolio(props: { wallet: string }) {
  const [addr, setAddr] = createSignal(props.wallet || "");
  const [out, setOut] = createSignal<string>("");
  async function load() { const a = (addr() || props.wallet).trim(); if (!isAddress(a)) { setOut("enter a valid 0x address (or connect a wallet)"); return; } setOut("loading…"); const { byName } = await import("../../agent/tools.js"); const r = await byName("holdings")!.run({ address: a }); setOut(r.text); }
  onMount(() => { if (props.wallet) { setAddr(props.wallet); load(); } });
  return <div class="cfg"><h3>portfolio</h3>
    <div class="row"><label>address</label><input value={addr()} onInput={(e) => setAddr(e.currentTarget.value)} placeholder="0x… (or connect a wallet)" /></div>
    <button class="chip" onclick={load}>load holdings</button>
    <pre style="font-family:var(--mono);font-size:13px;color:var(--ink);white-space:pre-wrap;margin-top:14px">{out()}</pre>
  </div>;
}
