import { Fragment, useState } from "react";
import { CONFIG } from "../config";
import { postLine, type CoinRow, type Holder } from "../lib/board";
import { ago, explorer, pct, price, traderName, usd } from "../lib/format";
import type { Book } from "../lib/hooks";
import { useNow } from "../lib/hooks";
import { CopyButton } from "./CopyButton";
import { SignalTag, SplitBar } from "./SignalTag";

function HolderList({ title, list, side }: { title: string; list: Holder[]; side: "long" | "short" }) {
  return (
    <div className={`holders side-${side}`}>
      <h4>
        {title} <span className="count">{list.length}</span>
      </h4>
      {list.length === 0 ? (
        <p className="fine">Nobody in the room.</p>
      ) : (
        <ol>
          {list.map(({ trader, position: p }) => (
            <li key={trader.address}>
              <span className="h-rank">#{trader.rank}</span>
              <a className="h-name" href={explorer(trader.address)} target="_blank" rel="noreferrer">
                {traderName(trader)}
              </a>
              <span className="h-size">{usd(p.notional)}</span>
              <span className="h-entry">at {price(p.entry)}</span>
              <span className="h-lev">{p.leverage}x</span>
              <span className={`h-pnl ${p.upnl >= 0 ? "up" : "down"}`}>{usd(p.upnl, { sign: true })}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Board({ rows, book, onPick }: { rows: CoinRow[]; book: Book; onPick: (coin: string) => void }) {
  const now = useNow();
  const [open, setOpen] = useState<string | null>(null);
  const r = CONFIG.rules;

  return (
    <section className="section" id="board" aria-labelledby="board-h">
      <header className="section-head">
        <h2 id="board-h">The board</h2>
        <p>
          Every coin at least three of the room hold right now, ordered by how strongly they agree. A coin signals when{" "}
          {r.quorum} or more of them hold it and {pct(r.enter)} sit on the same side.
        </p>
        <p className="status" aria-live="polite">
          {book.updatedAt
            ? `Updated ${ago(now - book.updatedAt)}, next read in ${Math.max(0, Math.ceil((CONFIG.refreshMs - (now - book.updatedAt)) / 1000))}s.`
            : book.total
              ? `Reading positions: ${book.read} of ${book.total} accounts.`
              : "Waiting for the room."}
          {book.error && <span className="status-warn"> {book.error}</span>}
        </p>
      </header>

      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr>
              <th scope="col">Coin</th>
              <th scope="col" className="hide-sm num">
                Price
              </th>
              <th scope="col">The room, by headcount</th>
              <th scope="col" className="num hide-sm">
                Holders
              </th>
              <th scope="col" className="hide-md num">
                Long by size
              </th>
              <th scope="col" className="hide-md num">
                Avg leverage
              </th>
              <th scope="col" className="hide-md num">
                Funding APR
              </th>
              <th scope="col" className="hide-sm">
                Signal
              </th>
              <th scope="col">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  {book.updatedAt ? "None of the room hold a shared coin right now." : "Reading the room’s positions…"}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isOpen = open === row.coin;
              const m = row.market;
              return (
                <Fragment key={row.coin}>
                  <tr className={`board-row state-${row.state}${isOpen ? " is-open" : ""}`}>
                    <th scope="row" className="coin">
                      <button type="button" className="coin-name" onClick={() => onPick(row.coin)} title={`Show ${row.coin} in the room`}>
                        {row.coin}
                      </button>
                    </th>
                    <td className="hide-sm num">
                      <span className="px">{m ? price(m.mark) : "–"}</span>
                      {m && <span className={`chg ${m.change24h >= 0 ? "up" : "down"}`}>{pct(m.change24h, 1, true)}</span>}
                    </td>
                    <td className="split-cell">
                      <SplitBar long={row.long} short={row.short} />
                      <span className="show-sm-inline sm-meta">
                        <SignalTag row={row} />
                        <span className="fine">{row.holders} of 50 hold it</span>
                      </span>
                    </td>
                    <td className="num hide-sm">
                      {row.holders}
                      <span className="of">/50</span>
                    </td>
                    <td className="hide-md num">{pct(row.longBySize)}</td>
                    <td className="hide-md num">{row.avgLeverage.toFixed(1)}x</td>
                    <td className="hide-md num">{m ? pct(m.fundingApr, 1, true) : "–"}</td>
                    <td className="hide-sm">
                      <SignalTag row={row} />
                    </td>
                    <td className="expand">
                      <button
                        type="button"
                        className="expand-btn"
                        aria-expanded={isOpen}
                        aria-controls={`detail-${row.coin}`}
                        onClick={() => setOpen(isOpen ? null : row.coin)}
                      >
                        <span className="sr-only">{isOpen ? "Hide" : "Show"} who holds {row.coin}</span>
                        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="detail-row" id={`detail-${row.coin}`}>
                      <td colSpan={9}>
                        <div className="detail">
                          <dl className="detail-stats show-md">
                            <div>
                              <dt>Price</dt>
                              <dd>{m ? price(m.mark) : "–"}</dd>
                            </div>
                            <div>
                              <dt>Long by size</dt>
                              <dd>{pct(row.longBySize)}</dd>
                            </div>
                            <div>
                              <dt>Avg leverage</dt>
                              <dd>{row.avgLeverage.toFixed(1)}x</dd>
                            </div>
                            <div>
                              <dt>Funding APR</dt>
                              <dd>{m ? pct(m.fundingApr, 1, true) : "–"}</dd>
                            </div>
                          </dl>
                          <div className="holders-grid">
                            <HolderList title="Long" list={row.longs} side="long" />
                            <HolderList title="Short" list={row.shorts} side="short" />
                          </div>
                          <div className="detail-foot">
                            <p className="fine">{postLine(row)}</p>
                            <CopyButton text={postLine(row)} label="Copy as post" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
