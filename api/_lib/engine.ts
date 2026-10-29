// Picks "the room": the 50 Hyperliquid traders with the most consistent records.
// Stage 1 screens every leaderboard account (free, no rate limit).
// Stage 2 drops candidates without real money on Hyperliquid perps.
// Stage 3 pulls perp PnL history for the strongest candidates to measure
// six-month win rate and 30-day drawdown, then makes the final cut.

import { fetchLeaderboard, fetchPortfolio, info, pool, type RawLeaderboardRow, type RawPortfolio } from "./hyperliquid.js";
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

// Hyperliquid allows 1200 request weight per minute per IP.
// A perp balance check costs 2, a full PnL history costs 20: 70 × 2 + 52 × 20 = 1180.
/** How many stage-1 leaders get their perp balance checked. */
const PRECHECK = 70;
/** How many of those get a full PnL history check. */
const DEEP_SCORE = 52;
const HISTORY_WINDOW = 183 * 24 * 60 * 60 * 1000;

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

/**
 * Share of profitable periods over the last six months. Hyperliquid reports
 * all-time PnL roughly weekly for newer accounts and every two weeks for older
 * ones, so each step between two points is one period. Flat periods don't count.
 */
export function periodWinRate(pnlHistory: Array<[number, string]>, accountValue: number, now = Date.now()) {
  const pts = pnlHistory.map(([t, v]) => [t, num(v)] as const).sort((a, b) => a[0] - b[0]);
  let first = pts.findIndex((p) => p[0] >= now - HISTORY_WINDOW);
  if (first < 0) return { rate: null, counted: 0 };
  if (first > 0) first -= 1; // the last point before the window is the baseline
  const flat = Math.max(accountValue * 0.0005, 50);
  let wins = 0;
  let counted = 0;
  for (let k = first + 1; k < pts.length; k++) {
    const d = pts[k][1] - pts[k - 1][1];
    if (Math.abs(d) < flat) continue;
    counted++;
    if (d > 0) wins++;
  }
  return { rate: counted ? wins / counted : null, counted };
}

/** True when the 30-day perp PnL barely moved, i.e. the account isn't trading perps. */
function idle(pnlHistory: Array<[number, string]>, accountValue: number) {
  if (!pnlHistory.length) return true;
  const vals = pnlHistory.map(([, v]) => num(v));
  return Math.max(...vals) - Math.min(...vals) < Math.max(accountValue * 0.01, 1000);
}

const lastValue = (h: Array<[number, string]> | undefined) => (h && h.length ? num(h[h.length - 1][1]) : 0);

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
  let noPerps = 0;

  // Stage 2: the leaderboard counts spot and vault results too. Seats go to
  // accounts that actually hold money on Hyperliquid perps, since only they can vote.
  const pre = candidates.slice(0, PRECHECK);
  const perpBalances = await pool(pre, 5, async (c) => {
    try {
      const ch = await info<{ marginSummary?: { accountValue?: string } }>({ type: "clearinghouseState", user: c.address });
      return num(ch.marginSummary?.accountValue);
    } catch {
      return null; // unknown: keep the candidate
    }
  });
  const withPerps = pre.filter((_, i) => {
    const bal = perpBalances[i];
    if (bal !== null && bal < RULES.minAccountValue / 2) {
      noPerps++;
      return false;
    }
    return true;
  });

  // Stage 3: full PnL history for the strongest remaining candidates.
  const deep = withPerps.slice(0, DEEP_SCORE);
  const portfolios = await pool(deep, 4, async (c) => {
    try {
      return await fetchPortfolio(c.address);
    } catch {
      return null;
    }
  });

  const scored: RoomTrader[] = [];
  deep.forEach((c, i) => {
    const p = portfolios[i];
    let winRate: number | null = null;
    let periodsCounted = 0;
    let dd: number | null = null;
    if (p) {
      const all = pickPeriod(p, ["perpAllTime", "allTime"]);
      const month = pickPeriod(p, ["perpMonth", "month"]);
      const perpValue = lastValue(month?.accountValueHistory) || lastValue(all?.accountValueHistory);
      if (!month || perpValue < RULES.minAccountValue / 2 || idle(month.pnlHistory, perpValue)) {
        noPerps++;
        return;
      }
      if (all) {
        const w = periodWinRate(all.pnlHistory, perpValue);
        winRate = w.rate;
        periodsCounted = w.counted;
      }
      dd = drawdown(month.pnlHistory, month.accountValueHistory, perpValue);
    }
    // Real history replaces the coarse window check as it gets long enough to trust.
    // Without it, consistency can score at most 0.6.
    const trust = winRate === null ? 0 : Math.min(1, periodsCounted / 10);
    const consistency = trust * (winRate ?? 0) + (1 - trust) * 0.6 * c.windowConsistency;
    const risk = dd === null ? 0.5 : 1 - clamp01(dd / RULES.drawdownCeiling);
    const parts: ScoreParts = { consistency, risk, returns: c.returns, record: c.record };
    scored.push({
      rank: 0,
      address: c.address,
      name: c.name,
      score: Math.round(combine(parts) * 10) / 10,
      accountValue: c.accountValue,
      roi30: c.perf.month.roi,
      pnl30: c.perf.month.pnl,
      pnlAllTime: c.perf.allTime.pnl,
      volume30: c.perf.month.vlm,
      winRate,
      periodsCounted,
      drawdown30: dd,
      parts,
    });
  });

  scored.sort((a, b) => b.score - a.score || b.pnlAllTime - a.pnlAllTime);
  const traders = scored.slice(0, RULES.roomSize).map((t, i) => ({ ...t, rank: i + 1 }));

  return {
    computedAt: Date.now(),
    screened,
    eligible: candidates.length,
    filtered: { ...filtered, noPerps },
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
