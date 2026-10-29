import { useEffect, useState } from "react";
import { CONFIG } from "../config";
import type { CoinRow } from "../lib/board";
import { explorer, pct, price, shortAddr, usd } from "../lib/format";
import { fetchPositions, type Position } from "../lib/hl";

type Wallet = { accountValue: number; positions: Position[] } | null;

function useFeeWallet(): { wallet: Wallet; error: string | null } {
  const [wallet, setWallet] = useState<Wallet>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!CONFIG.feeWallet) return;
    let alive = true;
    const load = () =>
      fetchPositions(CONFIG.feeWallet)
        .then((w) => alive && (setWallet(w), setError(null)))
        .catch(() => alive && setError("The fee wallet couldn’t be read from Hyperliquid. Retrying in a minute."));
    load();
    const id = setInterval(load, CONFIG.refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return { wallet, error };
}

export function Fees({ rows }: { rows: CoinRow[] }) {
  const r = CONFIG.rules;
  const { wallet, error } = useFeeWallet();
  const live = rows.filter((row) => row.state === "consensus" && row.side && row.market);
  const t = CONFIG.ticker;

  return (
    <section className="section fees" id="fees" aria-labelledby="fees-h">
      <header className="section-head">
        <h2 id="fees-h">What the fees do</h2>
        <p>
          Creator fees from ${t} go to a public wallet on Hyperliquid. It opens a position only when a coin reaches
          consensus, closes it when the room stops agreeing, and uses the profit to buy back ${t}.
        </p>
      </header>

      <ol className="flow" aria-label="Where the fees go">
        <li>
          <strong>Creator fees</strong>
          <span>Collected in SOL on pump.fun</span>
        </li>
        <li>
          <strong>Hyperliquid wallet</strong>
          <span>Bridged to USDC, public address</span>
        </li>
        <li>
          <strong>Trades on consensus</strong>
          <span>Only when the room agrees</span>
        </li>
        <li>
          <strong>Buys back ${t}</strong>
          <span>With realised profit</span>
        </li>
      </ol>

      <div className="fees-grid">
        <dl className="rules">
          <div>
            <dt>Opens</dt>
            <dd>
              When {r.quorum}+ of the room hold a coin and {pct(r.enter)} are on one side
            </dd>
          </div>
          <div>
            <dt>Closes</dt>
            <dd>
              When agreement falls under {pct(r.exit)}, or price moves {pct(r.stop)} against entry
            </dd>
          </div>
          <div>
            <dt>Leverage</dt>
            <dd>{r.maxLeverage}x at most</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{pct(r.sizePerSignal)} of the wallet per signal</dd>
          </div>
          <div>
            <dt>Profit</dt>
            <dd>Buys back ${t}</dd>
          </div>
        </dl>

        <div className="orders">
          <h3>{wallet ? "Orders the room calls for now" : "Paper orders from the live board"}</h3>
          <p className="fine">
            {wallet
              ? "Built from the board every minute, sized from the fee wallet’s current balance."
              : "Execution is in beta. Until the fee wallet is connected, these are the orders it would place right now."}
          </p>
          {live.length === 0 ? (
            <p className="empty-note">No coin has reached consensus. The wallet stays flat until one does.</p>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th scope="col">Coin</th>
                  <th scope="col">Side</th>
                  <th scope="col" className="num">
                    Entry
                  </th>
                  <th scope="col" className="num">
                    Stop
                  </th>
                  <th scope="col" className="num">
                    {wallet ? "Notional" : "Margin"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => {
                  const px = row.market!.mark;
                  const stop = row.side === "long" ? px * (1 - r.stop) : px * (1 + r.stop);
                  return (
                    <tr key={row.coin}>
                      <th scope="row">{row.coin}</th>
                      <td className={`side-${row.side}`}>{row.side === "long" ? "Long" : "Short"}</td>
                      <td className="num">{price(px)}</td>
                      <td className="num">{price(stop)}</td>
                      <td className="num">
                        {wallet
                          ? usd(wallet.accountValue * r.sizePerSignal * r.maxLeverage)
                          : `${pct(r.sizePerSignal)} at ${r.maxLeverage}x`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="wallet-card">
          <h3>Fee wallet</h3>
          {!CONFIG.feeWallet ? (
            <p className="fine">
              Not connected yet. Once it is, its balance and every open position appear here, read live from
              Hyperliquid, so anyone can check each trade.
            </p>
          ) : (
            <>
              <a className="addr" href={explorer(CONFIG.feeWallet)} target="_blank" rel="noreferrer">
                {shortAddr(CONFIG.feeWallet)}
              </a>
              {error && <p className="status-warn">{error}</p>}
              {wallet && (
                <>
                  <p className="wallet-av">{usd(wallet.accountValue)}</p>
                  {wallet.positions.length === 0 ? (
                    <p className="fine">Flat. No open positions.</p>
                  ) : (
                    <ul className="wallet-pos">
                      {wallet.positions.map((p) => {
                        const row = rows.find((x) => x.coin === p.coin);
                        const agrees = row && row.side === p.side && row.share >= r.exit;
                        return (
                          <li key={p.coin}>
                            <span className={`chip side-${p.side}`}>{p.coin}</span>
                            <span>{usd(p.notional)}</span>
                            <span className={p.upnl >= 0 ? "up" : "down"}>{usd(p.upnl, { sign: true })}</span>
                            <span className="fine">{agrees ? "Room still agrees" : "Room no longer agrees"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
