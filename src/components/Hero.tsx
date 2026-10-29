import { useEffect, useRef, useState } from "react";
import type { RoomTrader } from "../../api/_lib/types";
import { CONFIG } from "../config";
import { postLine, type CoinRow } from "../lib/board";
import { ago } from "../lib/format";
import type { Book } from "../lib/hooks";
import { useNow, usePrefersReducedMotion } from "../lib/hooks";
import { Hemicycle, type Seat } from "./Hemicycle";
import { CopyButton } from "./CopyButton";
import { SignalTag } from "./SignalTag";

function useTweened(target: number, reduced: boolean) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 520);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = a + (target - a) * e;
      setV(cur);
      from.current = cur;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return v;
}

export function Hero({
  traders,
  rows,
  book,
  coin,
  onCoin,
  roomError,
  onRetry,
}: {
  traders: RoomTrader[] | null;
  rows: CoinRow[];
  book: Book;
  coin: string | null;
  onCoin: (c: string) => void;
  roomError: string | null;
  onRetry: () => void;
}) {
  const now = useNow();
  const reduced = usePrefersReducedMotion();
  const row = rows.find((r) => r.coin === coin) ?? null;
  const choices = rows.slice(0, 6);
  const loading = !book.updatedAt;

  const seats: Seat[] = (() => {
    if (!traders) return [];
    if (!row) return traders.map((t) => ({ trader: t, position: null }));
    const holding = new Set([...row.longs, ...row.shorts].map((h) => h.trader.address));
    const flats = traders.filter((t) => !holding.has(t.address)).map((t) => ({ trader: t, position: null }));
    return [...row.longs, ...flats, ...[...row.shorts].reverse()];
  })();

  const share = useTweened(row ? row.share * 100 : 0, reduced);

  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <h1>
          Don’t copy a whale.
          <br />
          Copy the room.
        </h1>
        <p className="lede">
          Consensus ranks every trader on Hyperliquid by how steadily they win, keeps the 50 most consistent, and reads
          their open positions every minute. The fees behind ${CONFIG.ticker} only trade when that room agrees.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#board">
            See the board
          </a>
          <a className="btn btn-quiet" href="#check">
            Check your wallet
          </a>
        </div>
      </div>

      <div className="hero-room">
        {choices.length > 0 && (
          <div className="coin-switch" role="group" aria-label="Show the room for">
            {choices.map((r) => (
              <button
                key={r.coin}
                type="button"
                className={`coin-pill${r.coin === coin ? " is-on" : ""}`}
                aria-pressed={r.coin === coin}
                onClick={() => onCoin(r.coin)}
              >
                {r.coin}
              </button>
            ))}
          </div>
        )}

        <Hemicycle seats={seats} coin={coin} loading={loading}>
          {roomError && !traders ? (
            <div className="center-msg">
              <p>Couldn’t load the room.</p>
              <button type="button" className="btn btn-quiet btn-sm" onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : loading || !row ? (
            <div className="center-msg">
              <p className="center-title">Reading the room</p>
              <p className="center-sub">
                {book.total ? `${book.read} of ${book.total} accounts` : "Ranking Hyperliquid traders"}
              </p>
            </div>
          ) : (
            <div className="center-read">
              <span className={`center-pct side-${row.side ?? "none"}`}>{Math.round(share)}%</span>
              <span className="center-sub">
                {row.side ? `${row.side} ${row.coin}` : `split on ${row.coin}`}
              </span>
            </div>
          )}
        </Hemicycle>

        {row && !loading && (
          <div className="hero-readout">
            <p>
              {row.holders} of the 50 hold {row.coin}.{" "}
              {row.side
                ? `${row.side === "long" ? row.long : row.short} are ${row.side}, ${row.side === "long" ? row.short : row.long} ${row.side === "long" ? "short" : "long"}.`
                : `${row.long} long, ${row.short} short.`}
            </p>
            <div className="readout-row">
              <SignalTag row={row} />
              <CopyButton text={postLine(row)} label="Copy as post" />
            </div>
            <p className="fine">
              Positions read from Hyperliquid {book.updatedAt ? ago(now - book.updatedAt) : ""}. Hover or tap a seat to see
              the trader.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
