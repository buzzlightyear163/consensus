export function usd(v: number, opts: { sign?: boolean } = {}) {
  const sign = opts.sign && v > 0 ? "+" : v < 0 ? "−" : "";
  const a = Math.abs(v);
  let body: string;
  if (a >= 1e9) body = `${(a / 1e9).toFixed(2)}B`;
  else if (a >= 1e6) body = `${(a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)}M`;
  else if (a >= 1e3) body = `${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  else body = a.toFixed(0);
  return `${sign}$${body}`;
}

export function price(v: number) {
  if (!v) return "–";
  if (v >= 10_000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return v.toPrecision(4);
}

export function pct(v: number, digits = 0, sign = false) {
  const s = sign && v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${Math.abs(v * 100).toFixed(digits)}%`;
}

export function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function traderName(t: { name: string | null; address: string }) {
  return t.name ?? shortAddr(t.address);
}

export function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

export const explorer = (a: string) => `https://app.hyperliquid.xyz/explorer/address/${a}`;
