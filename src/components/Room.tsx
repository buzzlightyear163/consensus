import { useState } from "react";
import type { RoomSnapshot } from "../../api/_lib/types";
import { ago, explorer, pct, traderName, usd } from "../lib/format";
import type { Book } from "../lib/hooks";
import { useNow } from "../lib/hooks";

export function Room({ room, book, error }: { room: RoomSnapshot | null; book: Book; error: string | null }) {
  const now = useNow(15_000);
  const [all, setAll] = useState(false);
  const traders = room?.traders ?? [];
  const shown = all ? traders : traders.slice(0, 10);

  return (
    <section className="section" id="room" aria-labelledby="room-h">
      <header className="section-head">
        <h2 id="room-h">The room</h2>
        <p>
          The {traders.length || 50} most consistent perp traders on Hyperliquid, re-ranked every 15 minutes
          {room ? `, last ${ago(now - room.computedAt)}` : ""}. Names link to each account on Hyperliquid.
        </p>
        {error && !room && <p className="status status-warn">{error}</p>}
      </header>

      <div className="table-wrap">
        <table className="room">
          <thead>
            <tr>
              <th scope="col" className="num">
                Seat
              </th>
              <th scope="col">Trader</th>
              <th scope="col">Score</th>
              <th scope="col" className="hide-sm num">
                Win rate, 6 mo
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
              <th scope="col">Holding now</th>
            </tr>
          </thead>
          <tbody>
            {!room &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="skeleton-row" aria-hidden="true">
                  <td colSpan={8}>
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
                  <td className="hide-sm num" title={t.winRate === null ? undefined : `${Math.round(t.winRate * t.periodsCounted)} of ${t.periodsCounted} periods profitable`}>
                    {t.winRate === null ? "–" : pct(t.winRate)}
                  </td>
                  <td className="hide-sm num">{t.drawdown30 === null ? "–" : pct(t.drawdown30, 1)}</td>
                  <td className="hide-md num">{pct(t.roi30, 1, true)}</td>
                  <td className="hide-md num">{usd(t.pnlAllTime)}</td>
                  <td className="holding">
                    {pos === undefined ? (
                      <span className="fine">{book.updatedAt ? "–" : "Reading…"}</span>
                    ) : pos.length === 0 ? (
                      <span className="fine">Flat</span>
                    ) : (
                      <span className="chips">
                        {[...pos]
                          .sort((a, b) => b.notional - a.notional)
                          .slice(0, 3)
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
                        {pos.length > 3 && <span className="chip chip-more">+{pos.length - 3}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {traders.length > 10 && (
        <div className="table-foot">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Show the top 10" : `Show all ${traders.length} seats`}
          </button>
          <p className="fine legend">
            <span className="chip side-long">Long</span> <span className="chip side-short">Short</span> Largest positions first.
          </p>
        </div>
      )}
    </section>
  );
}
