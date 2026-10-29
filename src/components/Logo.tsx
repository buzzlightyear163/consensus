// The mark: a small chamber where most seats have already turned the same way.
export function Mark({ size = 30 }: { size?: number }) {
  const outer = 7;
  const inner = 4;
  const dots: Array<{ x: number; y: number; on: boolean }> = [];
  for (let j = 0; j < outer; j++) {
    const a = Math.PI - (j * Math.PI) / (outer - 1);
    dots.push({ x: 16 + 13 * Math.cos(a), y: 25 - 13 * Math.sin(a), on: j < 5 });
  }
  for (let j = 0; j < inner; j++) {
    const a = Math.PI - (j * Math.PI) / (inner - 1);
    dots.push({ x: 16 + 7 * Math.cos(a), y: 25 - 7 * Math.sin(a), on: j < 3 });
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={2.1} className={d.on ? "mark-on" : "mark-off"} />
      ))}
      <rect x="9" y="27.5" width="14" height="1.6" rx="0.8" className="mark-floor" />
    </svg>
  );
}

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="Consensus, back to top">
      <Mark />
      <span className="logo-word">Consensus</span>
    </a>
  );
}
