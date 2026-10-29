// Picks "the room": the 50 Hyperliquid traders with the most consistent records.
// Stage 1 screens every leaderboard account (free, no rate limit).
// Stage 2 pulls PnL history for the strongest candidates to measure weekly
// consistency and 30-day drawdown, then makes the final cut.

import { fetchLeaderboard, fetchPortfolio, pool, type RawLeaderboardRow, type RawPortfolio } from "./hyperliquid.js";
import type { RoomRules, RoomSnapshot, RoomTrader, ScoreParts } from "./types.js";

export const RULES: RoomRules = {
  roomSize: 50,
  minAccountValue: 100_000,
  minVolume30: 250_000,
  // 30-day volume above 600x the account is market-making or HFT, not a directional view.
  maxTurnover30: 600,
  returnCap: 0.3,
  drawdownCeiling: 0.35,
  weights: { consistency: 0.35, risk: 0.25, returns: 0.2, record: 0.2 },
};

/** How many stage-1 leaders get a full history check (portfolio calls cost 20 weight each). */
const DEEP_SCORE = 56;
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Protocol vaults that appear like traders but aren't. */
const EXCLUDED = new Set<string>([
  "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303", // HLP
]);

type Window = "day" | "week" | "month" | "allTime";
type Perf = { pnl: number; roi: number; vlm: number };
type Candidate = {
  address: string;
  name: string | null;
  accountValue: number;
  perf: Record<Window, Perf>;
  windowConsistency: number;
  returns: number;
  record: number;
  prelim: number;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lin = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));
const log10 = (v: number) => (v > 0 ? Math.log10(v) : 0);

function parseRow(row: RawLeaderboardRow) {
  const perf = { day: { pnl: 0, roi: 0, vlm: 0 }, week: { pnl: 0, roi: 0, vlm: 0 }, month: { pnl: 0, roi: 0, vlm: 0 }, allTime: { pnl: 0, roi: 0, vlm: 0 } } as Record<Window, Perf>;
  for (const [w, p] of row.windowPerformances ?? []) {
    if (w in perf) perf[w as Window] = { pnl: num(p?.pnl), roi: num(p?.roi), vlm: num(p?.vlm) };
  }
  return {
    address: String(row.ethAddress ?? "").toLowerCase(),
    name: row.displayName ? String(row.displayName).slice(0, 32) : null,
    accountValue: num(row.accountValue),
    perf,
  };
}

function returnsPart(roi30: number) {
  // -2% maps to 0, the cap maps to 1. Anything above the cap earns nothing extra.
  return lin(roi30, -0.02, RULES.returnCap);
}

function recordPart(pnlAllTime: number, accountValue: number) {
  return 0.6 * lin(log10(pnlAllTime), 5, 7.5) + 0.4 * lin(log10(accountValue), 5, 8);
}

function combine(parts: ScoreParts) {
  const w = RULES.weights;
  return 100 * (w.consistency * parts.consistency + w.risk * parts.risk + w.returns * parts.returns + w.record * parts.record);
}

export function screen(rows: RawLeaderboardRow[]) {
  const filtered = { small: 0, unprofitable: 0, inactive: 0, marketMakers: 0 };
  const candidates: Candidate[] = [];

  for (const raw of rows) {
    const r = parseRow(raw);
    if (!r.address || EXCLUDED.has(r.address)) continue;
    if (r.accountValue < RULES.minAccountValue) { filtered.small++; continue; }
    if (r.perf.allTime.pnl <= 0 || r.perf.month.pnl <= 0) { filtered.unprofitable++; continue; }
    if (r.perf.month.vlm < RULES.minVolume30) { filtered.inactive++; continue; }
    if (r.perf.month.vlm / r.accountValue > RULES.maxTurnover30) { filtered.marketMakers++; continue; }

    const windowConsistency =
      ((r.perf.day.pnl >= 0 ? 1 : 0) + (r.perf.week.pnl > 0 ? 1 : 0) + (r.perf.month.pnl > 0 ? 1 : 0) + (r.perf.allTime.pnl > 0 ? 1 : 0)) / 4;
    const returns = returnsPart(r.perf.month.roi);
    const record = recordPart(r.perf.allTime.pnl, r.accountValue);
    // Before history is known, risk is scored neutral.
    const prelim = combine({ consistency: windowConsistency, risk: 0.5, returns, record });
    candidates.push({ ...r, windowConsistency, returns, record, prelim });
  }

  candidates.sort((a, b) => b.prelim - a.prelim);
  return { candidates, filtered, screened: rows.length };
}

function pickPeriod(p: RawPortfolio, names: string[]) {
  for (const n of names) {
    const hit = p.find(([k]) => k === n);
    if (hit && hit[1]?.pnlHistory?.length) return hit[1];
  }
  return null;
}

/** Profitable weeks over (up to) the last 26 weeks of all-time PnL history. */
export function weeklyWinRate(pnlHistory: Array<[number, string]>) {
  const lastByWeek = new Map<number, number>();
  for (const [ts, v] of pnlHistory) lastByWeek.set(Math.floor(ts / WEEK), num(v));
  const weeks = [...lastByWeek.keys()].sort((a, b) => a - b).slice(-27);
  let wins = 0;
  let counted = 0;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] - weeks[i - 1] !== 1) continue;
    const d = lastByWeek.get(weeks[i])! - lastByWeek.get(weeks[i - 1])!;
    counted++;
    if (d > 0) wins++;
  }
  return { rate: counted ? wins / counted : null, counted };
}

/** Largest peak-to-trough drop in cumulative PnL, relative to account value at the peak. */
export function drawdown(pnlHistory: Array<[number, string]>, avHistory: Array<[number, string]>, fallbackAV: number) {
  if (pnlHistory.length < 2) return null;
  const avAt = (ts: number) => {
    let best = fallbackAV;
    let bestGap = Infinity;
    for (const [t, v] of avHistory) {
      const gap = Math.abs(t - ts);
      if (gap < bestGap) { bestGap = gap; best = num(v); }
    }
    return best > 0 ? best : fallbackAV;
  };
  let peak = -Infinity;
  let peakTs = pnlHistory[0][0];
  let worst = 0;
  for (const [ts, v] of pnlHistory) {
    const pnl = num(v);
    if (pnl > peak) { peak = pnl; peakTs = ts; }
    const drop = (peak - pnl) / Math.max(avAt(peakTs), 1);
    if (drop > worst) worst = drop;
  }
  return clamp01(worst);
}

export async function buildRoom(): Promise<RoomSnapshot> {
  const rows = await fetchLeaderboard();
  const { candidates, filtered, screened } = screen(rows);
  const deep = candidates.slice(0, DEEP_SCORE);

  const portfolios = await pool(deep, 4, async (c) => {
    try {
      return await fetchPortfolio(c.address);
    } catch {
      return null;
    }
  });

  const scored = deep.map((c, i) => {
    const p = portfolios[i];
    let weekWinRate: number | null = null;
    let weeksCounted = 0;
    let dd: number | null = null;
    if (p) {
      const all = pickPeriod(p, ["perpAllTime", "allTime"]);
      const month = pickPeriod(p, ["perpMonth", "month"]);
      if (all) {
        const w = weeklyWinRate(all.pnlHistory);
        weekWinRate = w.rate;
        weeksCounted = w.counted;
      }
      if (month) dd = drawdown(month.pnlHistory, month.accountValueHistory, c.accountValue);
    }
    // Weekly history replaces the window check as it gets long enough to trust.
    const trust = weekWinRate === null ? 0 : Math.min(1, weeksCounted / 12);
    const consistency = trust * (weekWinRate ?? 0) + (1 - trust) * c.windowConsistency;
    const risk = dd === null ? 0.5 : 1 - clamp01(dd / RULES.drawdownCeiling);
    const parts: ScoreParts = { consistency, risk, returns: c.returns, record: c.record };
    const trader: RoomTrader = {
      rank: 0,
      address: c.address,
      name: c.name,
      score: Math.round(combine(parts) * 10) / 10,
      accountValue: c.accountValue,
      roi30: c.perf.month.roi,
      pnl30: c.perf.month.pnl,
      pnlAllTime: c.perf.allTime.pnl,
      volume30: c.perf.month.vlm,
      weekWinRate,
      weeksCounted,
      drawdown30: dd,
      parts,
    };
    return trader;
  });

  scored.sort((a, b) => b.score - a.score || b.pnlAllTime - a.pnlAllTime);
  const traders = scored.slice(0, RULES.roomSize).map((t, i) => ({ ...t, rank: i + 1 }));

  return {
    computedAt: Date.now(),
    screened,
    eligible: candidates.length,
    filtered,
    deepScored: deep.length,
    traders,
    rules: RULES,
  };
}

// Warm instances reuse the last room for a while; concurrent requests share one build.
let cached: { at: number; snapshot: RoomSnapshot } | null = null;
let inflight: Promise<RoomSnapshot> | null = null;
const TTL = 10 * 60 * 1000;

export async function getRoom(): Promise<RoomSnapshot> {
  if (cached && Date.now() - cached.at < TTL) return cached.snapshot;
  if (!inflight) {
    inflight = buildRoom()
      .then((snapshot) => {
        cached = { at: Date.now(), snapshot };
        return snapshot;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return await inflight;
  } catch (err) {
    if (cached) return cached.snapshot;
    throw err;
  }
}
