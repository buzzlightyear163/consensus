import { Fragment, useState } from "react";
import { CONFIG } from "../config";
import { postLine, type CoinRow, type Holder } from "../lib/board";
import { ago, explorer, pct, price, traderName, usd } from "../lib/format";
import type { Book } from "../lib/hooks";
import { useNow } from "../lib/hooks";
import { CopyButton } from "./CopyButton";
import { VoteStrip } from "./Dots";
import { SignalTag } from "./SignalTag";

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

export function Board({
  rows,
  book,
  size,
  onPick,
}: {
  rows: CoinRow[];
  book: Book;
  size: number;
  onPick: (coin: string) => void;
}) {
  const now = useNow();
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const r = CONFIG.rules;

  // The board shows coins enough of the room hold to vote on. Everything else folds away.
  let main = rows.filter((x) => x.state !== "thin");
  if (main.length < 3) main = rows.slice(0, 3);
  const rest = rows.filter((x) => !main.includes(x));

  return (
    <section className="section" id="board" aria-labelledby="board-h">
      <header className="section-head">
        <h2 id="board-h">The board</h2>
        <p>
          Coins at least {r.quorum} of the room hold, strongest agreement first. Every dot is a seat: mint is long, coral
          is short. A coin signals when {pct(r.enter)} of its holders sit on one side.
        </p>
        <p className="status" aria-live="polite">
          {book.updatedAt
            ? `Updated ${ago(now - book.updatedAt)}. Next read in ${Math.max(0, Math.ceil((CONFIG.refreshMs - (now - book.updatedAt)) / 1000))}s.`
            : book.total
              ? `Reading positions: ${book.read} of ${book.total} accounts.`
              : "Waiting for the room."}
          {book.error && <span className="status-warn"> {book.error}</span>}
        </p>
      </header>

      <div className="board" role="table" aria-label="Where the room stands, by coin">
        <div className="board-head" role="row">
          <span role="columnheader">Coin</span>
          <span role="columnheader">The room</span>
          <span role="columnheader" className="hide-sm">
            Holders
          </span>
          <span role="columnheader" className="hide-md num">
            Long by size
          </span>
          <span role="columnheader" className="hide-md num">
            Leverage
          </span>
          <span role="columnheader">Signal</span>
          <span role="columnheader">
            <span className="sr-only">Details</span>
          </span>
        </div>

        {main.length === 0 && (
          <p className="board-empty">{book.updatedAt ? "None of the room hold a shared coin right now." : "Reading the room’s positions…"}</p>
        )}

        {main.map((row) => {
          const isOpen = open === row.coin;
          const m = row.market;
          const l = Math.round((row.long / row.holders) * 100);
          return (
            <Fragment key={row.coin}>
              <div className={`board-row state-${row.state} side-${row.side ?? "none"}${isOpen ? " is-open" : ""}`} role="row">
                <div className="b-coin" role="cell">
                  <button type="button" className="coin-name" onClick={() => onPick(row.coin)} title={`Show ${row.coin} in the chamber`}>
                    {row.coin}
                  </button>
                  {m && (
                    <span className="b-px">
                      {price(m.mark)} <span className={m.change24h >= 0 ? "up" : "down"}>{pct(m.change24h, 1, true)}</span>
                    </span>
                  )}
                </div>
                <div className="b-vote" role="cell">
                  <span className="b-pct up">{l}%</span>
                  <VoteStrip long={row.long} short={row.short} seats={size} />
                  <span className="b-pct down">{100 - l}%</span>
                  <span className="sr-only">
                    {row.long} long and {row.short} short out of {size}
                  </span>
                </div>
                <div className="b-holders hide-sm" role="cell">
                  {row.holders}
                  <span className="of"> of {size}</span>
                </div>
                <div className="hide-md num" role="cell">
                  {pct(row.longBySize)}
                </div>
                <div className="hide-md num" role="cell">
                  {row.avgLeverage.toFixed(1)}x
                </div>
                <div role="cell">
                  <SignalTag row={row} />
                </div>
                <div className="b-expand" role="cell">
                  <button
                    type="button"
                    className="expand-btn"
                    aria-expanded={isOpen}
                    aria-controls={`detail-${row.coin}`}
                    onClick={() => setOpen(isOpen ? null : row.coin)}
                  >
                    <span className="sr-only">
                      {isOpen ? "Hide" : "Show"} who holds {row.coin}
                    </span>
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="detail" id={`detail-${row.coin}`} role="row">
                  <div role="cell">
                    <dl className="detail-stats">
                      <div>
                        <dt>Holders</dt>
                        <dd>
                          {row.holders} of {size}
                        </dd>
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
                        <dt>Funding, yearly</dt>
                        <dd>{m ? pct(m.fundingApr, 1, true) : "–"}</dd>
                      </div>
                    </dl>
                    <div className="holders-grid">
                      <HolderList title="Long" list={row.longs} side="long" />
                      <HolderList title="Short" list={row.shorts} side="short" />
                    </div>
                    <div className="detail-foot">
                      <p>{postLine(row, size)}</p>
                      <CopyButton text={postLine(row, size)} label="Copy as post" />
                    </div>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="more">
          <button type="button" className="more-btn" aria-expanded={more} aria-controls="more-list" onClick={() => setMore((v) => !v)}>
            {more ? "Hide" : "Show"} {rest.length} more coin{rest.length === 1 ? "" : "s"} with fewer than {r.quorum} holders
          </button>
          {more && (
            <ul className="more-list" id="more-list">
              {rest.map((x) => (
                <li key={x.coin}>
                  <span className="more-coin">{x.coin}</span>
                  <span className="up">{x.long} long</span>
                  <span className="down">{x.short} short</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
