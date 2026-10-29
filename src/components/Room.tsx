import { useState } from "react";
import type { RoomSnapshot } from "../../api/_lib/types";
import { ago, explorer, pct, traderName, usd } from "../lib/format";
import type { Book } from "../lib/hooks";
import { useNow } from "../lib/hooks";

export function Room({ room, book, error }: { room: RoomSnapshot | null; book: Book; error: string | null }) {
  const now = useNow(15_000);
  const [all, setAll] = useState(false);
  const traders = room?.traders ?? [];
  const shown = all ? traders : traders.slice(0, 15);

  return (
    <section className="section" id="room" aria-labelledby="room-h">
      <header className="section-head">
        <h2 id="room-h">The room</h2>
        <p>The 50 most consistent accounts on Hyperliquid, re-ranked every 15 minutes from the full leaderboard.</p>
        {room && (
          <p className="funnel">
            Ranked from {room.screened.toLocaleString("en-US")} accounts {ago(now - room.computedAt)}.{" "}
            {room.eligible.toLocaleString("en-US")} passed the filters. {room.filtered.small.toLocaleString("en-US")} were
            under {usd(room.rules.minAccountValue)}, {room.filtered.unprofitable.toLocaleString("en-US")} weren’t up both
            this month and all-time, {room.filtered.inactive.toLocaleString("en-US")} barely traded and{" "}
            {room.filtered.marketMakers.toLocaleString("en-US")} trade like market makers.
          </p>
        )}
        {error && !room && <p className="status status-warn">{error}</p>}
      </header>

      <div className="table-wrap">
        <table className="room">
          <thead>
            <tr>
              <th scope="col" className="num">
                #
              </th>
              <th scope="col">Trader</th>
              <th scope="col">Score</th>
              <th scope="col" className="hide-sm num">
                Profitable weeks
              </th>
              <th scope="col" className="hide-sm num">
                30d drawdown
              </th>
              <th scope="col" className="hide-md num">
                30d return
              </th>
              <th scope="col" className="hide-md num">
                All-time PnL
              </th>
              <th scope="col" className="hide-md num">
                Account
              </th>
              <th scope="col">Holding now</th>
            </tr>
          </thead>
          <tbody>
            {!room &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="skeleton-row" aria-hidden="true">
                  <td colSpan={9}>
                    <span className="skeleton" />
                  </td>
                </tr>
              ))}
            {shown.map((t) => {
              const pos = book.positions.get(t.address);
              return (
                <tr key={t.address}>
                  <td className="num rank">{t.rank}</td>
                  <th scope="row" className="trader">
                    <a href={explorer(t.address)} target="_blank" rel="noreferrer">
                      {traderName(t)}
                    </a>
                  </th>
                  <td>
                    <span className="score">
                      <span className="score-num">{t.score.toFixed(1)}</span>
                      <span className="score-track" aria-hidden="true">
                        <span style={{ width: `${t.score}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="hide-sm num">
                    {t.weekWinRate === null ? "–" : `${Math.round(t.weekWinRate * t.weeksCounted)} of ${t.weeksCounted}`}
                  </td>
                  <td className="hide-sm num">{t.drawdown30 === null ? "–" : pct(t.drawdown30, 1)}</td>
                  <td className="hide-md num">{pct(t.roi30, 1, true)}</td>
                  <td className="hide-md num">{usd(t.pnlAllTime)}</td>
                  <td className="hide-md num">{usd(t.accountValue)}</td>
                  <td className="holding">
                    {pos === undefined ? (
                      <span className="fine">{book.updatedAt ? "–" : "Reading…"}</span>
                    ) : pos.length === 0 ? (
                      <span className="fine">Flat</span>
                    ) : (
                      <span className="chips">
                        {[...pos]
                          .sort((a, b) => b.notional - a.notional)
                          .slice(0, 4)
                          .map((p) => (
                            <span
                              key={p.coin}
                              className={`chip side-${p.side}`}
                              title={`${p.side === "long" ? "Long" : "Short"} ${usd(p.notional)} ${p.coin}, ${p.leverage}x`}
                            >
                              <span className="sr-only">{p.side} </span>
                              {p.coin}
                            </span>
                          ))}
                        {pos.length > 4 && <span className="chip chip-more">+{pos.length - 4}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {traders.length > 15 && (
        <div className="table-foot">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Show the top 15" : `Show all ${traders.length}`}
          </button>
          <p className="fine legend">
            <span className="chip side-long">Long</span> <span className="chip side-short">Short</span> Coins are coloured
            by side. Names link to the account on Hyperliquid.
          </p>
        </div>
      )}
    </section>
  );
}
