// PandaOS action system: autonomous scanners on intervals -> alerts + recommendations.
import { byName } from "./tools.js";
export type Row = { id: string; kind: "alert" | "rec"; title: string; detail: string; imperative?: string; at: number };
export type Scanner = { id: string; label: string; every: number; run: () => Promise<Row[]> };

export const SCANNERS: Scanner[] = [
  { id: "fresh", label: "fresh launches", every: 120, run: async () => {
    const r = await byName("scan_new")!.run({ capital: 1000 }); const acts = (r.data || []).filter((a: any) => a.fit >= 70).slice(0, 4);
    return acts.map((a: any) => ({ id: "fresh-" + a.address, kind: "rec", title: a.title + " · signal " + a.fit, detail: a.why?.join(", ") || "fresh Base launch with momentum", imperative: "inspect " + a.address + " and tell me if it is safe to take a small starter position", at: Date.now() }));
  } },
  { id: "yields", label: "top yields", every: 600, run: async () => {
    const r = await byName("yields")!.run({}); const y = (r.data || [])[0]; if (!y) return [];
    return [{ id: "yield-top", kind: "rec", title: "top Base yield: " + y.title + " " + y.apy.toFixed(1) + "%", detail: y.name + " · safe-ish parking for idle stables if TVL holds", imperative: "draft moving some idle USDC into " + y.title + " on " + y.name, at: Date.now() }];
  } },
  { id: "gas", label: "gas watch", every: 180, run: async () => {
    const r = await byName("network_stats")!.run({}); const g = r.data?.gas_prices?.average; if (g == null) return [];
    if (g <= 0.004) return [{ id: "gas-low", kind: "alert", title: "Base gas is cheap (" + Number(g).toFixed(4) + " gwei)", detail: "good window to batch moves or rebalance.", at: Date.now() }];
    return [];
  } }
];
