// Renders the Consensus brand images from the same chamber as the site.
// Open brand/render.html?shot=coin|banner|launch with the dev server running;
// brand/render.py screenshots each one at 2x and downsamples.
import "@fontsource-variable/mona-sans/wdth.css";
import * as THREE from "three";

type SeatKind = "long" | "short" | "flat";
type Shot = {
  w: number;
  h: number;
  elev: number; // camera elevation, degrees
  fov: number;
  fit: number; // share of the frame width the chamber spans
  frontY: number; // where the chamber's front edge sits, as a share of frame height
  seats: SeatKind[];
  halo: number;
  seatScale?: number;
  /** A flat LED board instead of the chamber. */
  panel?: () => string;
  /** Runs after the panel is in the page, for canvas drawing. */
  draw?: (root: HTMLElement) => void;
  overlay: (front: { x: number; y: number }, w: number, h: number) => string;
};

const INK = "#031210";
const MINT = "#97fce4";
const CORAL = "#ff8a73";

const run = (spec: Array<[SeatKind, number]>) => spec.flatMap(([k, n]) => Array<SeatKind>(n).fill(k));

// 5×7 LED glyphs.
const G: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#..##", "#...#", "#...#", ".###."],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

type PanelLine = { text: string; scale: number; row: number; col: number; color: string; opacity: number; glow?: boolean };

/** A full LED board: every cell is a dot, and the text is the lit ones. */
function ledPanel(w: number, h: number, cell: number, lines: PanelLine[]) {
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  const ox = (w - cols * cell) / 2;
  const oy = (h - rows * cell) / 2;
  const lit = new Map<string, number>();
  lines.forEach((ln, li) =>
    [...ln.text.toUpperCase()].forEach((ch, gi) =>
      (G[ch] ?? G[" "]).forEach((row, y) =>
        [...row].forEach((bit, x) => {
          if (bit !== "#") return;
          for (let sy = 0; sy < ln.scale; sy++)
            for (let sx = 0; sx < ln.scale; sx++) lit.set(`${ln.col + (gi * 6 + x) * ln.scale + sx},${ln.row + y * ln.scale + sy}`, li);
        }),
      ),
    ),
  );
  const r = cell * 0.36;
  const off: string[] = [];
  const on: string[][] = lines.map(() => []);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const cx = (ox + x * cell + cell / 2).toFixed(1);
      const cy = (oy + y * cell + cell / 2).toFixed(1);
      const li = lit.get(`${x},${y}`);
      if (li === undefined) off.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
      else on[li].push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
    }
  const svg = (body: string, style: string) =>
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;overflow:visible;${style}">${body}</svg>`;
  return (
    svg(`<g fill="${MINT}" opacity="0.06">${off.join("")}</g>`, "") +
    lines
      .map((ln, i) =>
        svg(
          `<g fill="${ln.color}" opacity="${ln.opacity}">${on[i].join("")}</g>`,
          ln.glow ? `filter:drop-shadow(0 0 ${cell * 1.2}px rgba(151,252,228,0.55))` : "",
        ),
      )
      .join("")
  );
}

function led(text: string, cell: number, color: string, glow = 0.55) {
  const chars = [...text.toUpperCase()].filter((c) => G[c]);
  const cols = chars.length * 6 - 1;
  const dots: string[] = [];
  chars.forEach((c, gi) =>
    G[c].forEach((row, y) =>
      [...row].forEach((bit, x) => {
        const cx = (gi * 6 + x) * cell + cell / 2;
        const cy = y * cell + cell / 2;
        dots.push(
          `<circle cx="${cx}" cy="${cy}" r="${cell * 0.38}" fill="${color}" opacity="${bit === "#" ? 1 : 0.05}"/>`,
        );
      }),
    ),
  );
  const w = cols * cell;
  const h = 7 * cell;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible;filter:drop-shadow(0 0 ${cell * 1.1}px rgba(151,252,228,${glow}))">${dots.join("")}</svg>`;
}

function mark(size: number) {
  const dots: string[] = [];
  for (let j = 0; j < 7; j++) {
    const a = Math.PI - (j * Math.PI) / 6;
    dots.push(`<circle cx="${16 + 13 * Math.cos(a)}" cy="${25 - 13 * Math.sin(a)}" r="2.1" fill="${j < 5 ? MINT : "#2c5249"}"/>`);
  }
  for (let j = 0; j < 4; j++) {
    const a = Math.PI - (j * Math.PI) / 3;
    dots.push(`<circle cx="${16 + 7 * Math.cos(a)}" cy="${25 - 7 * Math.sin(a)}" r="2.1" fill="${j < 3 ? MINT : "#2c5249"}"/>`);
  }
  dots.push(`<rect x="9" y="27.5" width="14" height="1.6" rx="0.8" fill="#eaf6f2" opacity=".45"/>`);
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32">${dots.join("")}</svg>`;
}

/**
 * One faint dot per account on Hyperliquid's leaderboard (about 48,000), with the
 * fifty seats lit where they fall in the crowd, in the shape of the chamber.
 */
function drawField(root: HTMLElement, w: number, h: number) {
  const c = root.querySelector("canvas") as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.cssText = `position:absolute;inset:0;width:${w}px;height:${h}px`;
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  const cols = 293;
  const rows = 165; // 48,345 dots
  const sx = w / cols;
  const sy = h / rows;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // The chamber, snapped to the grid.
  const cx = w * 0.655;
  const cy = h * 0.79;
  const lit = new Set<string>();
  [
    { r: 158, n: 9 },
    { r: 206, n: 11 },
    { r: 254, n: 14 },
    { r: 302, n: 16 },
  ].forEach(({ r, n }) => {
    for (let j = 0; j < n; j++) {
      const a = Math.PI - 0.05 - (j * (Math.PI - 0.1)) / (n - 1);
      const gx = Math.round((cx + r * Math.cos(a)) / sx - 0.5);
      const gy = Math.round((cy - r * Math.sin(a)) / sy - 0.5);
      lit.add(`${gx},${gy}`);
    }
  });

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (lit.has(`${x},${y}`)) continue;
      const px = (x + 0.5) * sx;
      const py = (y + 0.5) * sy;
      // Dimmer toward the edges, brighter near the room.
      const d = Math.hypot((px - cx) / w, (py - cy + 60) / h);
      const a = (0.13 + rnd() * 0.13) * Math.max(0.45, 1.2 - d * 1.3);
      g.fillStyle = `rgba(151,252,228,${a.toFixed(3)})`;
      g.beginPath();
      g.arc(px, py, 1.25, 0, Math.PI * 2);
      g.fill();
    }
  }
  // The floor line under the chamber.
  const fy = Math.round(cy / sy - 0.5);
  for (let x = Math.round((cx - 350) / sx); x <= Math.round((cx + 350) / sx); x++) {
    const px = (x + 0.5) * sx;
    const f = 1 - Math.abs(px - cx) / 350;
    g.fillStyle = `rgba(151,252,228,${(0.12 + f * 0.3).toFixed(3)})`;
    g.beginPath();
    g.arc(px, (fy + 0.5) * sy, 1.15, 0, Math.PI * 2);
    g.fill();
  }
  // The fifty.
  g.shadowColor = "rgba(151,252,228,0.9)";
  for (const key of lit) {
    const [x, y] = key.split(",").map(Number);
    const px = (x + 0.5) * sx;
    const py = (y + 0.5) * sy;
    g.shadowBlur = 22;
    g.fillStyle = MINT;
    g.beginPath();
    g.arc(px, py, 4.2, 0, Math.PI * 2);
    g.fill();
    g.fill();
  }
  g.shadowBlur = 0;
}

const SHOTS: Record<string, Shot> = {
  prelaunch: {
    w: 1600,
    h: 900,
    elev: 0,
    fov: 0,
    fit: 0,
    frontY: 0,
    seats: [],
    halo: 0,
    overlay: () => "",
    panel: () => `
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse 55% 60% at 66% 62%, rgba(151,252,228,0.09), transparent 70%)"></div>
      <canvas></canvas>
      <div style="position:absolute;left:84px;top:96px;font:640 64px/0.98 'Mona Sans Variable';font-stretch:125%;letter-spacing:-0.045em">
        <div style="color:rgba(234,246,242,0.4)">48,000+ traders<br>on Hyperliquid.</div>
        <div style="color:#eaf6f2;margin-top:8px">Fifty seats.</div>
      </div>
      <div style="position:absolute;left:84px;bottom:72px;display:flex;align-items:center;gap:12px">
        ${mark(34)}<span style="font:640 23px/1 'Mona Sans Variable';font-stretch:125%;letter-spacing:-0.02em;color:#eaf6f2">Consensus</span>
      </div>`,
    draw: (root) => drawField(root, 1600, 900),
  },
  coin: {
    w: 1000,
    h: 1000,
    elev: 74,
    fov: 26,
    fit: 0.84,
    frontY: 0.69,
    seats: run([
      ["long", 41],
      ["flat", 9],
    ]),
    halo: 1.1,
    seatScale: 1.45,
    overlay: () => "",
  },
  banner: {
    w: 1500,
    h: 500,
    elev: 24,
    fov: 26,
    fit: 0.5,
    frontY: 0.6,
    seats: run([
      ["long", 33],
      ["flat", 10],
      ["short", 7],
    ]),
    halo: 0.85,
    overlay: () => "",
    // One whale in dim white, fifty in lit mint, on a board the size of the banner.
    panel: () =>
      ledPanel(1500, 500, 7, [
        { text: "One whale can be wrong.", scale: 1, row: 19, col: 6, color: "#eaf6f2", opacity: 0.5 },
        { text: "Fifty rarely are.", scale: 2, row: 31, col: 6, color: MINT, opacity: 1, glow: true },
      ]) +
      `<div style="position:absolute;right:42px;bottom:34px;display:flex;align-items:center;gap:10px;padding:8px 12px 8px 10px;background:${INK};border-radius:8px">
        ${mark(28)}<span style="font:640 19px/1 'Mona Sans Variable';font-stretch:125%;letter-spacing:-0.02em;color:#eaf6f2">Consensus</span>
      </div>`,
  },
  launch: {
    w: 1600,
    h: 900,
    elev: 30,
    fov: 28,
    fit: 0.64,
    frontY: 0.6,
    seats: run([
      ["long", 36],
      ["flat", 9],
      ["short", 5],
    ]),
    halo: 0.9,
    overlay: (f) => `
      <div style="position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:14px">
        ${mark(44)}
        <span style="font:640 30px/1 'Mona Sans Variable';font-stretch:125%;letter-spacing:-0.02em;color:#eaf6f2">Consensus</span>
      </div>
      <div style="position:absolute;right:64px;top:58px;display:flex;align-items:center;gap:12px;height:42px;padding:0 18px;border:1px solid rgba(151,252,228,.22);border-radius:8px;font:500 18px/1 'Mona Sans Variable';color:#cfe7e0;background:rgba(7,28,25,.6)">
        <span style="width:10px;height:10px;border-radius:50%;background:${MINT};box-shadow:0 0 0 5px rgba(151,252,228,.16),0 0 14px ${MINT}"></span>Live on Hyperliquid
      </div>
      <div style="position:absolute;left:${f.x}px;top:${f.y + 40}px;transform:translateX(-50%)">${led("$Consensus", 11, MINT)}</div>
      <p style="position:absolute;left:0;right:0;top:${f.y + 40 + 77 + 34}px;margin:0;text-align:center;font:450 22px/1.4 'Mona Sans Variable';color:#94aea7">
        Hyperliquid’s 50 most consistent traders. The fees only trade when they agree.
      </p>`,
  },
};

const shot = SHOTS[new URLSearchParams(location.search).get("shot") ?? "coin"] ?? SHOTS.coin;

document.documentElement.style.cssText = `margin:0;background:${INK}`;
document.body.style.cssText = `margin:0;background:${INK}`;
const frame = document.getElementById("frame")!;
frame.style.cssText = `position:relative;width:${shot.w}px;height:${shot.h}px;overflow:hidden;background:
  radial-gradient(ellipse 60% 55% at 50% ${shot.frontY * 100 - 8}%, rgba(151,252,228,0.11), transparent 70%), ${INK}`;
const canvas = document.getElementById("gl") as HTMLCanvasElement;
canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
const overlayEl = document.getElementById("overlay")!;
overlayEl.style.cssText = "position:absolute;inset:0";

if (shot.panel) {
  canvas.style.display = "none";
  frame.style.background = INK;
  overlayEl.innerHTML = shot.panel();
  shot.draw?.(overlayEl);
  document.fonts.ready.then(() =>
    requestAnimationFrame(() => {
      (window as unknown as { __done: boolean }).__done = true;
    }),
  );
} else {
  renderChamber();
}

function renderChamber() {
// --- the chamber, same geometry as the site ---
const TIERS = [
  { r: 1.62, n: 9 },
  { r: 2.02, n: 11 },
  { r: 2.42, n: 14 },
  { r: 2.82, n: 16 },
];
const STEP = 0.17;
const DEPTH = 0.4;
const PAD = 0.05;
const SEAT_R = 0.064;
const SEAT_LEN = 0.1;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(shot.w, shot.h, false);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(shot.fov, shot.w / shot.h, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xc8fff2, 0x020f0c, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(1.5, 6, 6);
scene.add(key);

function radial(stops: Array<[number, string]>, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const pool = new THREE.Mesh(
  new THREE.CircleGeometry(3.1, 64),
  new THREE.MeshBasicMaterial({
    map: radial([
      [0, "rgba(151,252,228,0.22)"],
      [0.45, "rgba(151,252,228,0.06)"],
      [1, "rgba(151,252,228,0)"],
    ]),
    transparent: true,
    depthWrite: false,
  }),
);
pool.rotation.x = -Math.PI / 2;
pool.position.set(0, 0.001, -0.5);
scene.add(pool);

const grid: number[] = [];
const gridCol: number[] = [];
for (let gx = -6.5; gx <= 6.5; gx += 0.26) {
  for (let gz = -4.2; gz <= 4.2; gz += 0.26) {
    const d = Math.hypot(gx, gz + 0.6);
    if (d > 6.4) continue;
    grid.push(gx, 0, gz);
    const k = Math.max(0, 1 - d / 6.4) * 0.6;
    gridCol.push(0.59 * k, 0.99 * k, 0.89 * k);
  }
}
const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
gridGeo.setAttribute("color", new THREE.Float32BufferAttribute(gridCol, 3));
scene.add(
  new THREE.Points(
    gridGeo,
    new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }),
  ),
);

{
  const pts: number[] = [];
  const cols: number[] = [];
  for (let k = 0; k <= 60; k++) {
    const x = -3.6 + (k / 60) * 7.2;
    pts.push(x, 0.002, 0);
    const f = Math.max(0, 1 - Math.pow(Math.abs(x) / 3.6, 2)) * 0.7;
    cols.push(0.59 * f, 0.99 * f, 0.89 * f);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true })));
}

const arc = (radius: number, y: number, opacity: number) => {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 128; k++) {
    const a = (k / 128) * Math.PI;
    pts.push(new THREE.Vector3(radius * Math.cos(a), y, -radius * Math.sin(a)));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity }),
  );
};

const stepMat = new THREE.MeshStandardMaterial({ color: 0x0b2723, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide });
const riserMat = new THREE.MeshStandardMaterial({ color: 0x07201c, roughness: 0.95, side: THREE.DoubleSide });
TIERS.forEach(({ r }, t) => {
  const y = (t + 1) * STEP;
  const inner = r - DEPTH / 2;
  const outer = r + DEPTH / 2;
  const top = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 160, 1, 0, Math.PI), stepMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = y;
  scene.add(top);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, STEP, 160, 1, true, Math.PI / 2, Math.PI), riserMat);
  riser.position.y = y - STEP / 2;
  scene.add(riser);
  scene.add(arc(inner, y + 0.002, 0.5 - t * 0.06));
});
{
  const r = TIERS[TIERS.length - 1].r + DEPTH / 2;
  const h = TIERS.length * STEP + 0.32;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 160, 1, true, Math.PI / 2, Math.PI), riserMat);
  wall.position.y = h / 2;
  scene.add(wall);
  scene.add(arc(r, h + 0.002, 0.2));
}

// Seats, ordered left to right so runs of the same kind form wedges.
type P = { x: number; y: number; z: number; a: number; t: number };
const pts: P[] = [];
TIERS.forEach(({ r, n }, t) => {
  for (let j = 0; j < n; j++) {
    const a = Math.PI - PAD - (j * (Math.PI - 2 * PAD)) / (n - 1);
    pts.push({ x: r * Math.cos(a), y: (t + 1) * STEP, z: -r * Math.sin(a), a, t });
  }
});
pts.sort((p, q) => q.a - p.a || p.t - q.t);

const COLORS: Record<SeatKind, THREE.Color> = {
  long: new THREE.Color(MINT),
  short: new THREE.Color(CORAL),
  flat: new THREE.Color("#1d3d36"),
};
const seatH = SEAT_LEN / 2 + SEAT_R;
const seats = new THREE.InstancedMesh(new THREE.CapsuleGeometry(SEAT_R, SEAT_LEN, 8, 20), new THREE.MeshBasicMaterial(), pts.length);
const haloTex = radial(
  [
    [0, "rgba(255,255,255,0.9)"],
    [0.18, "rgba(255,255,255,0.42)"],
    [0.5, "rgba(255,255,255,0.08)"],
    [1, "rgba(255,255,255,0)"],
  ],
  128,
);
const halos = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.72, 0.72),
  new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  pts.length,
);
scene.add(seats, halos);

// --- camera: fit the width, then place the front edge ---
const target = new THREE.Vector3(0, 0.1, -1.0);
const elev = THREE.MathUtils.degToRad(shot.elev);
const place = (d: number) => {
  camera.position.set(0, target.y + d * Math.sin(elev), target.z + d * Math.cos(elev));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
};
let dist = 8;
for (let i = 0; i < 12; i++) {
  place(dist);
  const l = new THREE.Vector3(-3.05, 0, 0).project(camera);
  const r = new THREE.Vector3(3.05, 0, 0).project(camera);
  const spanned = (r.x - l.x) / 2;
  dist *= spanned / shot.fit;
}
place(dist);
const f0 = new THREE.Vector3(0, 0, 0).project(camera);
const frontPx = ((1 - f0.y) / 2) * shot.h;
camera.setViewOffset(shot.w, shot.h, 0, frontPx - shot.frontY * shot.h, shot.w, shot.h);
camera.updateProjectionMatrix();

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
camera.getWorldQuaternion(q);
pts.forEach((p, i) => {
  const kind = shot.seats[i] ?? "flat";
  const k = shot.seatScale ?? 1;
  m.compose(new THREE.Vector3(p.x, p.y + seatH * k, p.z), new THREE.Quaternion(), new THREE.Vector3(k, k, k));
  seats.setMatrixAt(i, m);
  seats.setColorAt(i, COLORS[kind]);
  m.compose(new THREE.Vector3(p.x, p.y + seatH * k, p.z), q, new THREE.Vector3(k, k, k));
  halos.setMatrixAt(i, m);
  const c = kind === "flat" ? new THREE.Color(0, 0, 0) : COLORS[kind].clone().multiplyScalar(0.55 * shot.halo);
  halos.setColorAt(i, c);
});

const front = new THREE.Vector3(0, 0, 0.1).project(camera);
overlayEl.innerHTML = shot.overlay({ x: ((front.x + 1) / 2) * shot.w, y: ((1 - front.y) / 2) * shot.h }, shot.w, shot.h);

document.fonts.ready.then(() => {
  renderer.render(scene, camera);
  requestAnimationFrame(() => {
    (window as unknown as { __done: boolean }).__done = true;
  });
});
}
