#!/usr/bin/env node
// PandaOS agent CLI. Interactive REPL + one-shot mode. Read-only, non-custodial.
import { createInterface } from "node:readline";
import { route, run } from "./agent.js";

const BANNER = [
  "",
  "  ██████   PandaOS agent  ·  the open-source Base terminal",
  "  ██  ██   read-only · non-custodial · $POS",
  "",
  "  type a command (or plain English if OPENAI_API_KEY is set). `help` for the list, `exit` to quit.",
  ""
].join("\n");

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length) { console.log(await route(argv.join(" "))); return; }   // one-shot: panda-agent stats
  console.log(BANNER);
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "panda> " });
  rl.prompt();
  rl.on("line", async (raw) => {
    const s = raw.trim();
    if (s === "exit" || s === "quit") { rl.close(); return; }
    if (s === "clear") { console.clear(); rl.prompt(); return; }
    if (s) { try { console.log(await route(s)); } catch (e) { console.log("error:", e && e.message || e); } }
    rl.prompt();
  });
  rl.on("close", () => { console.log("\npanda out. stay non-custodial."); process.exit(0); });
}
main();
