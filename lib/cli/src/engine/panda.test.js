import test from "node:test";
import assert from "node:assert";
import { short, fmtUsd, ageText, keyPrice, buyCost, sellProceeds, keysForBudget, curvePoints, parseGtActions, parseYieldActions, evalAction, CURVE_DIV } from "./panda.js";

test("helpers", () => {
  assert.equal(short("0x"+"a".repeat(40)), "0xaaaa…aaaa");
  assert.equal(fmtUsd(2500000), "$2.50M"); assert.equal(fmtUsd(1500), "$1.5k");
  assert.equal(ageText(0), "new");
});
test("bonding curve: price, cost, symmetry, budget", () => {
  assert.ok(Math.abs(keyPrice(0) - 1/CURVE_DIV) < 1e-12);
  assert.ok(Math.abs(keyPrice(15) - 256/CURVE_DIV) < 1e-12);
  // buy 2 keys from supply 0 = (1+4)/div
  assert.ok(Math.abs(buyCost(0,2) - 5/CURVE_DIV) < 1e-12);
  // cost rises with supply
  assert.ok(buyCost(10,1) > buyCost(0,1));
  // sell symmetry: selling the top 2 of supply-2 == cost to have bought them
  assert.ok(Math.abs(sellProceeds(2,2) - buyCost(0,2)) < 1e-12);
  const b = keysForBudget(0, 5/CURVE_DIV);
  assert.equal(b.keys, 2); assert.ok(Math.abs(b.cost - 5/CURVE_DIV) < 1e-12);
  assert.equal(curvePoints(10).length, 11);
});
test("parseGtActions reads pools into launch actions", () => {
  const j = { data:[{ attributes:{ reserve_in_usd:"42000", volume_usd:{h24:"9000"}, price_change_percentage:{h24:"20"}, transactions:{h24:{buys:30,sells:10}}, pool_created_at:"2026-06-09T10:00:00Z" }, relationships:{ base_token:{data:{id:"base_x"}}, dex:{data:{id:"aerodrome"}} } }],
    included:[{ id:"base_x", type:"token", attributes:{ address:"0x"+"a".repeat(40), symbol:"FOO", name:"Foo" } }] };
  const a = parseGtActions(j);
  assert.equal(a.length,1); assert.equal(a[0].title,"FOO"); assert.equal(a[0].liq,42000); assert.equal(a[0].kind,"launch");
});
test("parseYieldActions filters Base + sane apy, sorts desc", () => {
  const j = { data:[ {chain:"Base",symbol:"USDC",project:"aero",tvlUsd:2000000,apy:12,pool:"p1"},
                     {chain:"Base",symbol:"X",project:"y",tvlUsd:60000,apy:90,pool:"p2"},
                     {chain:"Ethereum",symbol:"E",project:"z",tvlUsd:9e9,apy:5,pool:"p3"} ] };
  const r = parseYieldActions(j);
  assert.equal(r.length,2); assert.equal(r[0].apy,90); assert.equal(r[0].kind,"yield");
});
test("evalAction gives bounded verdicts with reasons", () => {
  const fresh = evalAction({ kind:"launch", liq:40000, buys:80, sells:20, createdAt:Date.now()-2*3600000 }, 1000);
  assert.ok(fresh.fit>=0 && fresh.fit<=100); assert.ok(["EXECUTE","WATCH","SKIP"].includes(fresh.verdict)); assert.ok(fresh.why.length>0);
  const yld = evalAction({ kind:"yield", apy:60, tvl:5e6 }, 1000);
  assert.match(yld.why.join(" "), /APY/);
  // huge capital vs tiny pool -> penalized
  const tiny = evalAction({ kind:"launch", liq:3000, buys:5, sells:5, createdAt:Date.now()-1e7 }, 100000);
  assert.ok(tiny.fit < fresh.fit);
});
