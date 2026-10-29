import { STATE_LABEL, type CoinRow } from "../lib/board";

export function SignalTag({ row }: { row: Pick<CoinRow, "state" | "side"> }) {
  return (
    <span className={`signal signal-${row.state} side-${row.side ?? "none"}`}>
      <span className="signal-dot" aria-hidden="true" />
      {STATE_LABEL[row.state](row.side)}
    </span>
  );
}

/** Long/short headcount as a split bar with both shares labelled. */
export function SplitBar({ long, short }: { long: number; short: number }) {
  const total = long + short || 1;
  const l = Math.round((long / total) * 100);
  return (
    <div className="split" aria-label={`${l}% long, ${100 - l}% short`}>
      <span className="split-num split-l">{l}%</span>
      <div className="split-track" aria-hidden="true">
        <span className="split-long" style={{ width: `${l}%` }} />
        <span className="split-short" style={{ width: `${100 - l}%` }} />
      </div>
      <span className="split-num split-s">{100 - l}%</span>
    </div>
  );
}
