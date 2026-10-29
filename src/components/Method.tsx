import type { RoomRules, RoomSnapshot } from "../../api/_lib/types";
import { CONFIG } from "../config";
import { pct, usd } from "../lib/format";

const FALLBACK: RoomRules = {
  roomSize: 50,
  minAccountValue: 100_000,
  minVolume30: 250_000,
  maxTurnover30: 600,
  returnCap: 0.3,
  drawdownCeiling: 0.35,
  weights: { consistency: 0.35, risk: 0.25, returns: 0.2, record: 0.2 },
};

const fmt = (n: number) => n.toLocaleString("en-US");

export function Method({ room }: { room: RoomSnapshot | null }) {
  const R = room?.rules ?? FALLBACK;
  const r = CONFIG.rules;
  const parts = [
    { key: "consistency", label: "Win rate", note: "Share of profitable one-to-two-week periods over six months.", w: R.weights.consistency },
    { key: "risk", label: "30-day drawdown", note: `Deepest drop from a peak. ${pct(R.drawdownCeiling)} or worse scores zero.`, w: R.weights.risk },
    { key: "returns", label: "30-day return", note: `Capped at ${pct(R.returnCap)}, so one lucky bet can’t buy a seat.`, w: R.weights.returns },
    { key: "record", label: "Track record", note: "All-time profit and account size, on a log scale.", w: R.weights.record },
  ];
  const f = room?.filtered;
  const funnel = room
    ? [
        { n: room.screened, label: "accounts on Hyperliquid’s leaderboard" },
        { n: room.eligible, label: "pass the size, profit and activity filters" },
        { n: room.deepScored, label: "get a full perp history check" },
        { n: room.traders.length, label: "take a seat in the room" },
      ]
    : null;

  return (
    <section className="section method" id="method" aria-labelledby="method-h">
      <header className="section-head">
        <h2 id="method-h">How the room is picked</h2>
        <p>
          A single whale can be lucky, overleveraged or baiting the people who copy him. Fifty consistent traders rarely
          agree by accident. Every step runs on public Hyperliquid data, so anyone can check it.
        </p>
      </header>

      {funnel && (
        <ol className="funnel" aria-label="From the whole leaderboard to the room">
          {funnel.map((s, i) => (
            <li key={i} style={{ "--k": 1 - i * 0.22 } as React.CSSProperties}>
              <span className="funnel-n">{fmt(s.n)}</span>
              <span className="funnel-l">{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="method-grid">
        <ol className="steps">
          <li>
            <h3>Read the whole leaderboard</h3>
            <p>Every account on Hyperliquid’s public leaderboard comes in with its size and results for the day, week, month and all time.</p>
          </li>
          <li>
            <h3>Drop the noise</h3>
            <p>
              Out go accounts under {usd(R.minAccountValue)}, anyone not up both this month and all-time, accounts that traded
              under {usd(R.minVolume30)} in 30 days, and accounts trading over {R.maxTurnover30}× their size a month: market
              makers and bots, not people with a view.
              {f ? ` Right now that removes ${fmt(f.small + f.unprofitable + f.inactive + f.marketMakers)} accounts.` : ""}
            </p>
          </li>
          <li>
            <h3>Keep real perp traders</h3>
            <p>
              The leaderboard also counts spot and vault results. Only accounts with real money on Hyperliquid perps, trading
              this month, can take a seat, because only they can vote.
              {f && f.noPerps > 0 ? ` ${fmt(f.noPerps)} strong candidates were skipped for this today.` : ""}
            </p>
          </li>
          <li>
            <h3>Score consistency, not luck</h3>
            <p>
              The strongest candidates get a full PnL history check and a score out of 100, weighted as shown. The top{" "}
              {R.roomSize} take the seats.
            </p>
          </li>
          <li>
            <h3>Read positions, count votes</h3>
            <p>
              Open positions come straight from Hyperliquid every {Math.round(CONFIG.refreshMs / 1000)} seconds. One trader is
              one vote, whatever the size. A coin signals when {r.quorum}+ of the room hold it and {pct(r.enter)} sit on one
              side; from {pct(r.lean)} it shows as leaning.
            </p>
          </li>
        </ol>

        <div className="weights" aria-labelledby="weights-h">
          <h3 id="weights-h">What the score weighs</h3>
          <div className="weights-bar" aria-hidden="true">
            {parts.map((p, i) => (
              <span key={p.key} className={`wseg wseg-${i}`} style={{ flexGrow: p.w }}>
                {pct(p.w)}
              </span>
            ))}
          </div>
          <dl className="weights-list">
            {parts.map((p, i) => (
              <div key={p.key}>
                <dt>
                  <span className={`wkey wseg-${i}`} aria-hidden="true" />
                  {p.label} <span className="wpct">{pct(p.w)}</span>
                </dt>
                <dd>{p.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
