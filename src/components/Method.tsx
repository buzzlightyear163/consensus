import type { RoomRules } from "../../api/_lib/types";
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

export function Method({ rules, screened }: { rules: RoomRules | null; screened: number | null }) {
  const R = rules ?? FALLBACK;
  const r = CONFIG.rules;
  const parts = [
    { key: "consistency", label: "Profitable weeks", note: "Share of winning weeks over the last six months.", w: R.weights.consistency },
    { key: "risk", label: "30-day drawdown", note: `Deepest drop from a peak. ${pct(R.drawdownCeiling)} or worse scores zero.`, w: R.weights.risk },
    { key: "returns", label: "30-day return", note: `Capped at ${pct(R.returnCap)}, so one lucky bet can’t buy a seat.`, w: R.weights.returns },
    { key: "record", label: "Track record", note: "All-time profit and account size, on a log scale.", w: R.weights.record },
  ];

  return (
    <section className="section method" id="method" aria-labelledby="method-h">
      <header className="section-head">
        <h2 id="method-h">How the room is picked</h2>
        <p>
          A single whale can be lucky, overleveraged or baiting the people who copy him. Fifty consistent traders rarely
          agree by accident. Every step below runs on public Hyperliquid data and can be checked.
        </p>
      </header>

      <div className="method-grid">
        <ol className="steps">
          <li>
            <h3>Read the whole leaderboard</h3>
            <p>
              Every account on Hyperliquid’s public leaderboard
              {screened ? `, ${screened.toLocaleString("en-US")} right now,` : ""} is pulled in with its account size and
              results for the day, week, month and all time.
            </p>
          </li>
          <li>
            <h3>Drop the noise</h3>
            <p>
              Out go accounts under {usd(R.minAccountValue)}, anyone not up both this month and all-time, accounts that
              traded less than {usd(R.minVolume30)} in 30 days, and accounts trading over {R.maxTurnover30}× their size a
              month. That last group is market makers and bots, not people with a view.
            </p>
          </li>
          <li>
            <h3>Score consistency, not luck</h3>
            <p>
              The strongest candidates get a full PnL history check and a score out of 100, weighted as shown. The top{" "}
              {R.roomSize} become the room.
            </p>
          </li>
          <li>
            <h3>Read their positions every minute</h3>
            <p>
              Open positions come straight from Hyperliquid every {Math.round(CONFIG.refreshMs / 1000)} seconds. One
              trader is one vote, whatever the size, so a single giant account can’t swing the room.
            </p>
          </li>
          <li>
            <h3>Signal only on agreement</h3>
            <p>
              A coin signals when at least {r.quorum} of the {R.roomSize} hold it and {pct(r.enter)} of those holders are
              on the same side. Between {pct(r.lean)} and {pct(r.enter)} it shows as leaning, and nothing trades.
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
