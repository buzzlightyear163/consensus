import { useState } from "react";
import type { RoomTrader } from "../../api/_lib/types";
import { CONFIG } from "../config";
import type { CoinRow } from "../lib/board";
import { pct, usd } from "../lib/format";
import { fetchPositions, isAddress, type Position } from "../lib/hl";

type Verdict = { tone: "with" | "against" | "split" | "none"; text: string };

function verdict(p: Position, row: CoinRow | undefined): Verdict {
  if (!row || row.holders < 3) return { tone: "none", text: `Too few of the room hold ${p.coin} to compare.` };
  if (row.holders < CONFIG.rules.quorum)
    return { tone: "none", text: `Only ${row.holders} of the room hold ${p.coin}: ${row.long} long, ${row.short} short.` };
  const mine = p.side === "long" ? row.long : row.short;
  const share = mine / row.holders;
  if (row.side && row.share >= CONFIG.rules.lean) {
    return row.side === p.side
      ? { tone: "with", text: `With the room. ${pct(share)} of its ${row.holders} ${p.coin} holders are ${p.side} too.` }
      : { tone: "against", text: `Against the room. ${pct(row.share)} of its ${row.holders} ${p.coin} holders are ${row.side}.` };
  }
  return { tone: "split", text: `The room is split on ${p.coin}: ${row.long} long, ${row.short} short.` };
}

export function WalletCheck({ rows, traders }: { rows: CoinRow[]; traders: RoomTrader[] }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "done"; address: string; positions: Position[]; accountValue: number }
  >({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = value.trim().toLowerCase();
    if (!isAddress(address)) {
      setState({ kind: "error", message: "Enter a Hyperliquid address: 0x followed by 40 characters." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const { positions, accountValue } = await fetchPositions(address);
      setState({ kind: "done", address, positions, accountValue });
    } catch {
      setState({ kind: "error", message: "Hyperliquid didn’t answer. Check the address and try again." });
    }
  };

  const member = state.kind === "done" ? traders.find((t) => t.address === state.address) : undefined;
  const results = state.kind === "done" ? state.positions.map((p) => ({ p, v: verdict(p, rows.find((r) => r.coin === p.coin)) })) : [];
  const withCount = results.filter((r) => r.v.tone === "with").length;
  const againstCount = results.filter((r) => r.v.tone === "against").length;

  return (
    <section className="section check" id="check" aria-labelledby="check-h">
      <header className="section-head">
        <h2 id="check-h">Are you with the room?</h2>
        <p>Paste any Hyperliquid address to see where its open positions stand against the 50. Nothing is signed or stored.</p>
      </header>

      <form className="check-form" onSubmit={submit} noValidate>
        <label htmlFor="addr" className="sr-only">
          Hyperliquid address
        </label>
        <input
          id="addr"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={state.kind === "error"}
          aria-describedby="addr-msg"
        />
        <button type="submit" className="btn btn-primary" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "Checking…" : "Check wallet"}
        </button>
      </form>
      <p id="addr-msg" className={state.kind === "error" ? "status-warn" : "sr-only"} aria-live="polite">
        {state.kind === "error" ? state.message : ""}
      </p>

      {state.kind === "done" && (
        <div className="check-result" aria-live="polite">
          <p className="check-summary">
            {member && `This account is #${member.rank} in the room. `}
            {results.length === 0
              ? `No open positions on an account worth ${usd(state.accountValue)}.`
              : `${results.length} open position${results.length === 1 ? "" : "s"}: ${withCount} with the room, ${againstCount} against.`}
          </p>
          {results.length > 0 && (
            <ul className="check-list">
              {results
                .sort((a, b) => b.p.notional - a.p.notional)
                .map(({ p, v }) => (
                  <li key={p.coin} className={`tone-${v.tone}`}>
                    <span className={`chip side-${p.side}`}>{p.coin}</span>
                    <span className="check-pos">
                      {p.side === "long" ? "Long" : "Short"} {usd(p.notional)}
                    </span>
                    <span className="check-verdict">{v.text}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
