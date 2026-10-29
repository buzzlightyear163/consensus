// Browser access to Hyperliquid's public /info endpoint.
// Calls go straight to Hyperliquid from the visitor's browser (their own rate budget).
// If the browser blocks that, the site switches to its /api/hl relay for the session.

const DIRECT = "https://api.hyperliquid.xyz/info";
const RELAY = "/api/hl";
let useRelay = false;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid answered ${res.status}`);
  return (await res.json()) as T;
}

export async function info<T>(body: Record<string, unknown>): Promise<T> {
  if (!useRelay) {
    try {
      return await post<T>(DIRECT, body);
    } catch (err) {
      // A TypeError here means the request never got a readable answer (blocked or offline).
      if (!(err instanceof TypeError)) throw err;
      useRelay = true;
    }
  }
  return post<T>(RELAY, body);
}

export type RawPosition = {
  coin: string;
  entryPx: string | null;
  leverage: { type: string; value: number };
  liquidationPx: string | null;
  positionValue: string;
  szi: string;
  unrealizedPnl: string;
};

export type RawClearinghouse = {
  assetPositions: Array<{ position: RawPosition; type: string }>;
  marginSummary: { accountValue: string };
};

export type RawMeta = [
  { universe: Array<{ name: string; isDelisted?: boolean }> },
  Array<{ markPx: string; prevDayPx: string; funding: string; openInterest: string; dayNtlVlm: string }>,
];

export type Position = {
  coin: string;
  side: "long" | "short";
  size: number;
  notional: number;
  entry: number;
  leverage: number;
  upnl: number;
  liquidation: number | null;
};

export type Market = {
  coin: string;
  mark: number;
  change24h: number;
  /** Hourly funding annualised, as a fraction. */
  fundingApr: number;
  openInterestUsd: number;
};

const n = (v: unknown) => {
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

export function parsePositions(ch: RawClearinghouse): Position[] {
  return (ch.assetPositions ?? [])
    .map(({ position: p }) => {
      const szi = n(p.szi);
      const liq = n(p.liquidationPx);
      return {
        coin: p.coin,
        side: szi >= 0 ? "long" : "short",
        size: Math.abs(szi),
        notional: Math.abs(n(p.positionValue)),
        entry: n(p.entryPx),
        leverage: n(p.leverage?.value),
        upnl: n(p.unrealizedPnl),
        liquidation: liq > 0 ? liq : null,
      } satisfies Position;
    })
    .filter((p) => p.size > 0);
}

export async function fetchPositions(user: string) {
  const ch = await info<RawClearinghouse>({ type: "clearinghouseState", user });
  return { positions: parsePositions(ch), accountValue: n(ch.marginSummary?.accountValue) };
}

export async function fetchMarkets(): Promise<Map<string, Market>> {
  const [meta, ctxs] = await info<RawMeta>({ type: "metaAndAssetCtxs" });
  const out = new Map<string, Market>();
  meta.universe.forEach((u, i) => {
    const c = ctxs[i];
    if (!c || u.isDelisted) return;
    const mark = n(c.markPx);
    const prev = n(c.prevDayPx);
    out.set(u.name, {
      coin: u.name,
      mark,
      change24h: prev > 0 ? mark / prev - 1 : 0,
      fundingApr: n(c.funding) * 24 * 365,
      openInterestUsd: n(c.openInterest) * mark,
    });
  });
  return out;
}

export const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());
