import { useEffect, useRef, useState } from "react";
import type { RoomTrader } from "../../api/_lib/types";
import { CONFIG } from "../config";
import { postLine, type CoinRow } from "../lib/board";
import { ago } from "../lib/format";
import type { Book } from "../lib/hooks";
import { useNow, usePrefersReducedMotion } from "../lib/hooks";
import { Chamber } from "./Chamber";
import { CopyButton } from "./CopyButton";
import { LedText } from "./Dots";
import type { Seat } from "./Hemicycle";
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
      const k = Math.min(1, (t - start) / 700);
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
  const choices = rows.filter((r) => r.state !== "thin").slice(0, 5);
  const loading = !book.updatedAt;
  const size = traders?.length ?? 50;

  const seats: Seat[] = (() => {
    if (!traders) return [];
    if (!row) return traders.map((t) => ({ trader: t, position: null }));
    const holding = new Set([...row.longs, ...row.shorts].map((h) => h.trader.address));
    const flats = traders.filter((t) => !holding.has(t.address)).map((t) => ({ trader: t, position: null }));
    return [...row.longs, ...flats, ...[...row.shorts].reverse()];
  })();

  const share = useTweened(row ? row.share * 100 : 0, reduced);

  return (
    <section className="hero" id="top" aria-labelledby="hero-h">
      <div className="hero-top">
        <h1 id="hero-h">
          <span className="h-dim">Don’t copy a whale.</span>
          <span>Copy the room.</span>
        </h1>
        <div className="hero-side">
          <p className="lede">
            Consensus ranks every trader on Hyperliquid by how steadily they win and seats the {size} most consistent.
            Their open positions are read every minute. The fees behind ${CONFIG.ticker} only trade when the room agrees.
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
      </div>

      <Chamber seats={seats} coin={coin} loading={loading}>
        {roomError && !traders ? (
          <div className="readout readout-msg">
            <p>Couldn’t load the room.</p>
            <button type="button" className="btn btn-quiet btn-sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : loading || !row ? (
          <div className="readout readout-msg" aria-live="polite">
            <p className="readout-title">Reading the room</p>
            <p className="readout-sub">
              {book.total ? `${book.read} of ${book.total} positions` : "Ranking Hyperliquid traders"}
            </p>
          </div>
        ) : (
          <div className={`readout side-${row.side ?? "none"}`}>
            <LedText text={`${Math.round(share)}%`} className="readout-led" />
            <span className="sr-only">{Math.round(row.share * 100)}%</span>
            <p className="readout-sub">{row.side ? `of holders are ${row.side} ${row.coin}` : `split on ${row.coin}`}</p>
          </div>
        )}
      </Chamber>

      <div className="stage-bar">
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
        {row && !loading && (
          <div className="stage-read">
            <p>
              {row.holders} of the {size} hold {row.coin}:{" "}
              <span className="up">{row.long} long</span>, <span className="down">{row.short} short</span>.
            </p>
            <SignalTag row={row} />
            <CopyButton text={postLine(row, size)} label="Copy as post" />
          </div>
        )}
      </div>
      {!loading && (
        <p className="stage-note">
          Positions read from Hyperliquid {book.updatedAt ? ago(now - book.updatedAt) : ""}. Each seat is one trader; hover
          or tap one to see their position.
        </p>
      )}
    </section>
  );
}
