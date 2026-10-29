// Server-side access to Hyperliquid's public data. No keys needed.

export const INFO_URL = "https://api.hyperliquid.xyz/info";
export const LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** POST to the public /info endpoint, retrying on rate limits and network errors. */
export async function info<T>(body: Record<string, unknown>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        INFO_URL,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        10_000,
      );
      if (res.status === 429) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Hyperliquid /info ${body.type} returned ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Hyperliquid /info ${body.type} failed`);
}

export type RawWindow = [string, { pnl: string; roi: string; vlm: string }];
export type RawLeaderboardRow = {
  ethAddress: string;
  accountValue: string;
  displayName: string | null;
  windowPerformances: RawWindow[];
};

export async function fetchLeaderboard(): Promise<RawLeaderboardRow[]> {
  const res = await fetchWithTimeout(LEADERBOARD_URL, { headers: { Accept: "application/json" } }, 45_000);
  if (!res.ok) throw new Error(`Hyperliquid leaderboard returned ${res.status}`);
  const json = (await res.json()) as { leaderboardRows?: RawLeaderboardRow[] };
  if (!Array.isArray(json.leaderboardRows)) throw new Error("Hyperliquid leaderboard had no rows");
  return json.leaderboardRows;
}

export type RawPortfolio = Array<
  [string, { accountValueHistory: Array<[number, string]>; pnlHistory: Array<[number, string]>; vlm: string }]
>;

export function fetchPortfolio(user: string) {
  return info<RawPortfolio>({ type: "portfolio", user });
}

/** Run async work over items with a fixed number of workers. */
export async function pool<T, R>(items: T[], workers: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
