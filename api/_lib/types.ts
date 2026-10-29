// Shapes shared by the server functions and the site.

export type ScoreParts = {
  /** Share of profitable periods over six months (or of profitable leaderboard windows when history is thin), 0–1. */
  consistency: number;
  /** 1 minus 30-day drawdown scaled against a 35% ceiling, 0–1. */
  risk: number;
  /** 30-day return, capped so one lucky bet can't dominate, 0–1. */
  returns: number;
  /** All-time profit and account size on a log scale, 0–1. */
  record: number;
};

export type RoomTrader = {
  rank: number;
  address: string;
  name: string | null;
  /** 0–100 */
  score: number;
  accountValue: number;
  roi30: number;
  pnl30: number;
  pnlAllTime: number;
  volume30: number;
  /** Profitable periods / periods counted over six months of perp PnL history. Periods are one or two weeks. */
  winRate: number | null;
  periodsCounted: number;
  /** Largest peak-to-trough PnL drop over 30 days, as a share of account value. */
  drawdown30: number | null;
  parts: ScoreParts;
};

export type RoomSnapshot = {
  computedAt: number;
  /** Accounts read from the Hyperliquid leaderboard. */
  screened: number;
  /** Accounts that passed every filter. */
  eligible: number;
  filtered: { small: number; unprofitable: number; inactive: number; marketMakers: number; noPerps: number };
  /** Eligible accounts that got a full history check before the final cut. */
  deepScored: number;
  traders: RoomTrader[];
  rules: RoomRules;
};

export type RoomRules = {
  roomSize: number;
  minAccountValue: number;
  minVolume30: number;
  maxTurnover30: number;
  returnCap: number;
  drawdownCeiling: number;
  weights: ScoreParts;
};
