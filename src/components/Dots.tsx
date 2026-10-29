// The dot language: LED numerals and vote strips, built from the same seats as the chamber.

const GLYPHS: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "%": ["##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
};

/** Text drawn as a 5×7 LED matrix. Unlit cells stay faintly visible, like a real panel. */
export function LedText({ text, className = "" }: { text: string; className?: string }) {
  const chars = [...text].filter((c) => GLYPHS[c]);
  const cols = chars.length * 6 - 1;
  const cell = 10;
  return (
    <svg className={`led ${className}`} viewBox={`0 0 ${cols * cell} ${7 * cell}`} aria-hidden="true">
      {chars.map((c, gi) =>
        GLYPHS[c].flatMap((row, y) =>
          [...row].map((bit, x) => (
            <circle
              key={`${gi}-${x}-${y}`}
              cx={(gi * 6 + x) * cell + cell / 2}
              cy={y * cell + cell / 2}
              r={cell * 0.38}
              className={bit === "#" ? "led-on" : "led-off"}
            />
          )),
        ),
      )}
    </svg>
  );
}

/**
 * One slot per seat in the room. Longs fill from the left, shorts from the right,
 * and seats without a position stay as faint rings in between.
 */
export function VoteStrip({ long, short, seats }: { long: number; short: number; seats: number }) {
  const step = 12;
  return (
    <svg className="strip" viewBox={`0 0 ${seats * step} ${step}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {Array.from({ length: seats }, (_, i) => {
        const side = i < long ? "long" : i >= seats - short ? "short" : "flat";
        return <circle key={i} cx={i * step + step / 2} cy={step / 2} r={side === "flat" ? 2.6 : 4.4} className={`strip-${side}`} />;
      })}
    </svg>
  );
}
