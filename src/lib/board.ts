// Turns the room's live positions into one row per coin.
import type { RoomTrader } from "../../api/_lib/types";
import { CONFIG } from "../config";
import type { Market, Position } from "./hl";

export type Side = "long" | "short";
export type State = "consensus" | "leaning" | "split" | "thin";

export type Holder = { trader: RoomTrader; position: Position };

export type CoinRow = {
  coin: string;
  market: Market | null;
  holders: number;
  long: number;
  short: number;
  /** Majority side by headcount, or null on a tie. */
  side: Side | null;
  /** Share of holders on the majority side, 0.5–1. */
  share: number;
  /** Share of notional on the long side, 0–1. */
  longBySize: number;
  avgLeverage: number;
  state: State;
  /** Lower bound of the 95% Wilson interval for the majority share: agreement adjusted for sample size. */
  strength: number;
  longs: Holder[];
  shorts: Holder[];
};

export function stateFor(holders: number, share: number): State {
  const r = CONFIG.rules;
  if (holders < r.quorum) return "thin";
  if (share >= r.enter) return "consensus";
  if (share >= r.lean) return "leaning";
  return "split";
}

const ORDER: Record<State, number> = { consensus: 0, leaning: 1, split: 2, thin: 3 };

/** Wilson score lower bound: 9 of 10 agreeing is weaker evidence than 18 of 20. */
export function wilson(k: number, n: number, z = 1.96) {
  if (n === 0) return 0;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (c - m) / d;
}

export function buildBoard(
  traders: RoomTrader[],
  book: Map<string, Position[]>,
  markets: Map<string, Market>,
  minHolders = 3,
): CoinRow[] {
  const byCoin = new Map<string, Holder[]>();
  for (const trader of traders) {
    for (const position of book.get(trader.address) ?? []) {
      const list = byCoin.get(position.coin) ?? [];
      list.push({ trader, position });
      byCoin.set(position.coin, list);
    }
  }

  const rows: CoinRow[] = [];
  for (const [coin, holders] of byCoin) {
    if (holders.length < minHolders) continue;
    const longs = holders.filter((h) => h.position.side === "long").sort((a, b) => a.trader.rank - b.trader.rank);
    const shorts = holders.filter((h) => h.position.side === "short").sort((a, b) => a.trader.rank - b.trader.rank);
    const longNtl = longs.reduce((s, h) => s + h.position.notional, 0);
    const shortNtl = shorts.reduce((s, h) => s + h.position.notional, 0);
    const side: Side | null = longs.length === shorts.length ? null : longs.length > shorts.length ? "long" : "short";
    const share = Math.max(longs.length, shorts.length) / holders.length;
    rows.push({
      coin,
      market: markets.get(coin) ?? null,
      holders: holders.length,
      long: longs.length,
      short: shorts.length,
      side,
      share,
      longBySize: longNtl + shortNtl > 0 ? longNtl / (longNtl + shortNtl) : 0.5,
      avgLeverage: holders.reduce((s, h) => s + h.position.leverage, 0) / holders.length,
      state: side ? stateFor(holders.length, share) : holders.length < CONFIG.rules.quorum ? "thin" : "split",
      strength: wilson(Math.max(longs.length, shorts.length), holders.length),
      longs,
      shorts,
    });
  }

  return rows.sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.strength - a.strength || b.holders - a.holders);
}

export const STATE_LABEL: Record<State, (side: Side | null) => string> = {
  consensus: (s) => `Consensus ${s}`,
  leaning: (s) => `Leaning ${s}`,
  split: () => "Split",
  thin: () => "Too few holders",
};

/** A line ready to paste on X. */
export function postLine(row: CoinRow, roomSize = 50) {
  const pct = Math.round(row.share * 100);
  if (!row.side || row.state === "split") {
    const l = Math.round((row.long / row.holders) * 100);
    return `Hyperliquid's ${roomSize} most consistent traders are split on $${row.coin}: ${l}% long, ${100 - l}% short.`;
  }
  return `${pct}% of Hyperliquid's ${roomSize} most consistent traders holding $${row.coin} are ${row.side} right now (${row.side === "long" ? row.long : row.short} of ${row.holders}).`;
}
