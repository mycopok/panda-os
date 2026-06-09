import test from "node:test";
import assert from "node:assert";
import { run, TOOLS } from "./agent.js";

test("help + curve run with no network and return text", async () => {
  const h = await run("help"); assert.match(h, /commands/); assert.match(h, /non-custodial/);
  const c = await run("curve", ["10", "3"]); assert.match(c, /bonding curve/); assert.match(c, /buy 3 keys/);
  assert.ok(TOOLS.includes("scan") && TOOLS.includes("inspect"));
});
test("balance/holdings/inspect/score reject bad input without hitting network", async () => {
  assert.match(await run("balance", ["nope"]), /usage: balance/);
  assert.match(await run("inspect", ["x"]), /usage: inspect/);
  assert.match(await run("score", []), /usage: score/);
});
