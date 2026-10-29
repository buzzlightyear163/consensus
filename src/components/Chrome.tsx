import { CONFIG } from "../config";
import { ago } from "../lib/format";
import { useNow } from "../lib/hooks";
import { CopyButton } from "./CopyButton";
import { Logo, Mark } from "./Logo";

export function Nav({ updatedAt, failing }: { updatedAt: number | null; failing: boolean }) {
  const now = useNow(5000);
  const stale = updatedAt !== null && now - updatedAt > CONFIG.refreshMs * 3;
  return (
    <header className="nav">
      <div className="nav-inner">
        <Logo />
        <nav aria-label="Sections" className="nav-links">
          <a href="#board">Board</a>
          <a href="#room">Room</a>
          <a href="#method">Method</a>
          <a href="#fees">Fees</a>
          <a href="#check">Check wallet</a>
        </nav>
        <div className="nav-right">
          <span className={`live${updatedAt && !stale && !failing ? " is-live" : ""}`} title={updatedAt ? `Positions read ${ago(now - updatedAt)}` : undefined}>
            <span className="live-dot" aria-hidden="true" />
            {updatedAt ? (stale || failing ? "Reconnecting" : "Live on Hyperliquid") : "Connecting"}
          </span>
          {CONFIG.ca && (
            <a className="btn btn-primary btn-sm" href={`https://pump.fun/coin/${CONFIG.ca}`} target="_blank" rel="noreferrer">
              Buy ${CONFIG.ticker}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Mark size={36} />
          <p>
            Consensus reads public Hyperliquid data and publishes the rules its fee wallet follows. It isn’t financial
            advice. The best traders can be wrong at the same time, which is why the wallet uses low leverage and a stop.
          </p>
        </div>
        <div className="footer-links">
          {CONFIG.ca && (
            <div className="ca">
              <span className="fine">Contract</span>
              <code>{CONFIG.ca}</code>
              <CopyButton text={CONFIG.ca} label="Copy" />
            </div>
          )}
          {CONFIG.x && (
            <a href={CONFIG.x} target="_blank" rel="noreferrer">
              X
            </a>
          )}
          <a href="https://app.hyperliquid.xyz/leaderboard" target="_blank" rel="noreferrer">
            Hyperliquid leaderboard
          </a>
          <a href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api" target="_blank" rel="noreferrer">
            Hyperliquid API
          </a>
        </div>
      </div>
    </footer>
  );
}
