import { useMemo, useState } from "react";
import type { RoomTrader } from "../../api/_lib/types";
import type { Position } from "../lib/hl";
import { price, traderName, usd } from "../lib/format";

export type Seat = { trader: RoomTrader; position: Position | null };

const W = 600;
const H = 318;
const CX = W / 2;
const CY = 300;
const ROWS = [
  { r: 286, n: 16 },
  { r: 245, n: 14 },
  { r: 204, n: 11 },
  { r: 163, n: 9 },
];
const DOT = 13.5;

type Point = { x: number; y: number; angle: number; row: number };

/** Seat positions ordered left to right, so consecutive seats form wedges like a parliament chart. */
function layout(): Point[] {
  const pts: Point[] = [];
  ROWS.forEach(({ r, n }, row) => {
    for (let j = 0; j < n; j++) {
      const angle = Math.PI - (j * Math.PI) / (n - 1);
      pts.push({ x: CX + r * Math.cos(angle), y: CY - r * Math.sin(angle), angle, row });
    }
  });
  return pts.sort((a, b) => b.angle - a.angle || a.row - b.row);
}

export function Hemicycle({
  seats,
  coin,
  loading,
  children,
}: {
  seats: Seat[];
  coin: string | null;
  loading: boolean;
  children?: React.ReactNode;
}) {
  const points = useMemo(layout, []);
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover !== null ? seats[hover] : null;
  const hp = hover !== null ? points[hover] : null;

  const label = coin
    ? `${seats.filter((s) => s.position?.side === "long").length} long, ${seats.filter((s) => s.position?.side === "short").length} short and ${seats.filter((s) => !s.position).length} without a ${coin} position, out of ${seats.length} traders in the room.`
    : "The room's 50 seats.";

  return (
    <figure className={`hemi${loading ? " is-loading" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        {points.map((p, i) => {
          const seat = seats[i];
          const side = seat?.position?.side ?? (seat ? "flat" : "empty");
          return (
            <circle
              key={i}
              className={`seat seat-${side}${hover === i ? " is-hover" : ""}`}
              cx={p.x}
              cy={p.y}
              r={DOT}
              style={{ "--i": i } as React.CSSProperties}
              onPointerEnter={() => seat && setHover(i)}
            />
          );
        })}
      </svg>
      <div className="hemi-center">{children}</div>
      {hovered && hp && (
        <div
          className={`hemi-tip tip-${hp.x / W < 0.32 ? "left" : hp.x / W > 0.68 ? "right" : "center"}`}
          style={{ left: `${(hp.x / W) * 100}%`, top: `${(hp.y / H) * 100}%` }}
          role="status"
        >
          <span className="tip-who">
            #{hovered.trader.rank} {traderName(hovered.trader)}
          </span>
          {hovered.position ? (
            <span className={`tip-pos side-${hovered.position.side}`}>
              {hovered.position.side === "long" ? "Long" : "Short"} {usd(hovered.position.notional)} {coin} at {price(hovered.position.entry)}, {hovered.position.leverage}x
            </span>
          ) : (
            <span className="tip-pos">No {coin} position</span>
          )}
        </div>
      )}
    </figure>
  );
}
