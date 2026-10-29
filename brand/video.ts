// The 14-second launch video, drawn frame by frame from the same chamber as the site.
// brand/video.py calls window.__frame(t) for every frame and encodes the result.
// Frame 0 is the full launch card, so X shows it before anyone presses play.
import "@fontsource-variable/mona-sans/wdth.css";
import * as THREE from "three";

const W = 1920;
const H = 1080;
export const DURATION = 14;
const INK = "#031210";
const MINT = "#97fce4";
const CORAL = "#ff8a73";
const FOAM = "#eaf6f2";

type Kind = "long" | "short" | "flat";
const run = (spec: Array<[Kind, number]>) => spec.flatMap(([k, n]) => Array<Kind>(n).fill(k));

const LAUNCH = run([
  ["long", 36],
  ["flat", 9],
  ["short", 5],
]);
const ETH = run([
  ["long", 3],
  ["flat", 19],
  ["short", 28],
]);
const HYPE = run([
  ["long", 15],
  ["flat", 21],
  ["short", 14],
]);
const FLAT = run([["flat", 50]]);
const LONG = run([["long", 50]]);

// Seat keyframes: from t0, seat i starts changing at t0 + i * stagger and takes dur seconds.
const KEYS: Array<{ t0: number; seats: Kind[]; stagger: number; dur: number }> = [
  { t0: -10, seats: LAUNCH, stagger: 0, dur: 0.01 },
  { t0: 2.9, seats: FLAT, stagger: 0, dur: 0.25 },
  { t0: 3.15, seats: LONG, stagger: 0.028, dur: 0.22 },
  { t0: 5.2, seats: ETH, stagger: 0.012, dur: 0.45 },
  { t0: 8.6, seats: HYPE, stagger: 0.012, dur: 0.45 },
  { t0: 11.2, seats: LAUNCH, stagger: 0.012, dur: 0.45 },
];

// Moments where the readout and caption change; both dip briefly around them.
const CUTS = [2.9, 5.2, 8.6, 11.2];

const ease = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 5×7 LED glyphs.
const G: Record<string, string[]> = {
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
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
};

function led(text: string, cell: number, color: string) {
  const chars = [...text.toUpperCase()].filter((c) => G[c]);
  const cols = chars.length * 6 - 1;
  const dots: string[] = [];
  chars.forEach((c, gi) =>
    G[c].forEach((row, y) =>
      [...row].forEach((bit, x) => {
        dots.push(
          `<circle cx="${(gi * 6 + x) * cell + cell / 2}" cy="${y * cell + cell / 2}" r="${cell * 0.38}" opacity="${bit === "#" ? 1 : 0.05}"/>`,
        );
      }),
    ),
  );
  const w = cols * cell;
  const h = 7 * cell;
  const glow = color === CORAL ? "255,138,115" : color === MINT ? "151,252,228" : "234,246,242";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${color}" style="display:block;overflow:visible;filter:drop-shadow(0 0 ${cell * 1.1}px rgba(${glow},0.5))">${dots.join("")}</svg>`;
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
  dots.push(`<rect x="9" y="27.5" width="14" height="1.6" rx="0.8" fill="${FOAM}" opacity=".45"/>`);
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32">${dots.join("")}</svg>`;
}

// ---- page ----
document.documentElement.style.cssText = `margin:0;background:${INK}`;
document.body.style.cssText = `margin:0;background:${INK}`;
const frame = document.getElementById("frame")!;
frame.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden;background:
  radial-gradient(ellipse 60% 55% at 50% 50%, rgba(151,252,228,0.11), transparent 70%), ${INK}`;
const canvas = document.getElementById("gl") as HTMLCanvasElement;
canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
const overlay = document.getElementById("overlay")!;
overlay.style.cssText = "position:absolute;inset:0";

// ---- the chamber ----
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
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
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

{
  const grid: number[] = [];
  const col: number[] = [];
  for (let gx = -6.5; gx <= 6.5; gx += 0.26) {
    for (let gz = -4.2; gz <= 4.2; gz += 0.26) {
      const d = Math.hypot(gx, gz + 0.6);
      if (d > 6.4) continue;
      grid.push(gx, 0, gz);
      const k = Math.max(0, 1 - d / 6.4) * 0.6;
      col.push(0.59 * k, 0.99 * k, 0.89 * k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  scene.add(
    new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false })),
  );
}
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
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity }));
};
const stepMat = new THREE.MeshStandardMaterial({ color: 0x0b2723, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide });
const riserMat = new THREE.MeshStandardMaterial({ color: 0x07201c, roughness: 0.95, side: THREE.DoubleSide });
TIERS.forEach(({ r }, t) => {
  const y = (t + 1) * STEP;
  const inner = r - DEPTH / 2;
  const top = new THREE.Mesh(new THREE.RingGeometry(inner, r + DEPTH / 2, 160, 1, 0, Math.PI), stepMat);
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

type P = { x: number; y: number; z: number; a: number; t: number };
const pts: P[] = [];
TIERS.forEach(({ r, n }, t) => {
  for (let j = 0; j < n; j++) {
    const a = Math.PI - PAD - (j * (Math.PI - 2 * PAD)) / (n - 1);
    pts.push({ x: r * Math.cos(a), y: (t + 1) * STEP, z: -r * Math.sin(a), a, t });
  }
});
pts.sort((p, q) => q.a - p.a || p.t - q.t);
const N = pts.length;

const COLOR: Record<Kind, THREE.Color> = { long: new THREE.Color(MINT), short: new THREE.Color(CORAL), flat: new THREE.Color("#1d3d36") };
const seatH = SEAT_LEN / 2 + SEAT_R;
const seats = new THREE.InstancedMesh(new THREE.CapsuleGeometry(SEAT_R, SEAT_LEN, 8, 20), new THREE.MeshBasicMaterial(), N);
const halos = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.72, 0.72),
  new THREE.MeshBasicMaterial({
    map: radial(
      [
        [0, "rgba(255,255,255,0.9)"],
        [0.18, "rgba(255,255,255,0.42)"],
        [0.5, "rgba(255,255,255,0.08)"],
        [1, "rgba(255,255,255,0)"],
      ],
      128,
    ),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
  N,
);
scene.add(seats, halos);

// ---- camera ----
const target = new THREE.Vector3(0, 0.1, -1.0);
const ELEV = THREE.MathUtils.degToRad(30);
const FIT = 0.6;
const FRONT_Y = 0.55;
let dist = 8;
const place = (az: number) => {
  camera.clearViewOffset();
  camera.position.set(
    target.x + dist * Math.sin(az) * Math.cos(ELEV),
    target.y + dist * Math.sin(ELEV),
    target.z + dist * Math.cos(az) * Math.cos(ELEV),
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
};
for (let i = 0; i < 12; i++) {
  place(0);
  const l = new THREE.Vector3(-3.05, 0, 0).project(camera);
  const r = new THREE.Vector3(3.05, 0, 0).project(camera);
  dist *= (r.x - l.x) / 2 / FIT;
}
place(0);
const f0 = new THREE.Vector3(0, 0, 0).project(camera);
const SHIFT = ((1 - f0.y) / 2) * H - FRONT_Y * H;

// ---- timeline ----
function kindAt(i: number, t: number) {
  let from: Kind = KEYS[0].seats[i];
  let to: Kind = from;
  let p = 1;
  for (let k = 1; k < KEYS.length; k++) {
    const start = KEYS[k].t0 + i * KEYS[k].stagger;
    if (t < start) break;
    from = KEYS[k - 1].seats[i];
    to = KEYS[k].seats[i];
    p = clamp01((t - start) / KEYS[k].dur);
  }
  return { from, to, p };
}

function cutFade(t: number) {
  let o = 1;
  for (const c of CUTS) {
    const d = Math.abs(t - c);
    if (d < 0.18) o = Math.min(o, d / 0.18);
  }
  return ease(o);
}

function readout(t: number): { text: string; color: string; sub: string } {
  if (t < 2.9) return { text: "$CONSENSUS", color: MINT, sub: "" };
  if (t < 5.2) {
    const n = Math.max(0, Math.min(50, Math.floor((t - 3.15) / 0.028) + 1));
    return { text: String(n), color: MINT, sub: "seats, one per trader" };
  }
  if (t < 8.6) {
    const v = Math.round(ease(clamp01((t - 5.3) / 1.0)) * 90);
    return { text: `${v}%`, color: CORAL, sub: "of the room’s ETH holders are short" };
  }
  if (t < 11.2) {
    const v = Math.round(90 - ease(clamp01((t - 8.7) / 1.0)) * 38);
    return { text: `${v}%`, color: FOAM, sub: "long on HYPE. The room is split." };
  }
  return { text: "$CONSENSUS", color: MINT, sub: "" };
}

function caption(t: number) {
  if (t < 2.9) return "One whale can be wrong. Fifty rarely are.";
  if (t < 5.2) return "Hyperliquid’s 50 most consistent traders, one seat each.";
  if (t < 8.6) return "Their real positions, read every minute. One trader, one vote.";
  if (t < 11.2) return "No agreement, no trade.";
  return "One whale can be wrong. Fifty rarely are.";
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();
const c3 = new THREE.Color();

function frameAt(t: number) {
  const az = 0.07 * Math.sin((2 * Math.PI * t) / DURATION);
  place(az);
  camera.setViewOffset(W, H, 0, SHIFT, W, H);
  camera.updateProjectionMatrix();
  camera.getWorldQuaternion(q);

  for (let i = 0; i < N; i++) {
    const { from, to, p } = kindAt(i, t);
    const e = ease(p);
    c3.copy(COLOR[from]).lerp(COLOR[to], e);
    const pop = from !== to && to !== "flat" ? 1 + Math.sin(Math.PI * p) * 0.32 : 1;
    const pt = pts[i];
    v3.set(pt.x, pt.y + seatH * pop, pt.z);
    s3.set(pop, pop, pop);
    m.compose(v3, new THREE.Quaternion(), s3);
    seats.setMatrixAt(i, m);
    seats.setColorAt(i, c3);
    m.compose(v3, q, s3);
    halos.setMatrixAt(i, m);
    const lit = Math.max(0, (c3.r + c3.g + c3.b - 0.55) / 1.9);
    halos.setColorAt(i, new THREE.Color(c3.r * lit * 0.5, c3.g * lit * 0.5, c3.b * lit * 0.5));
  }
  seats.instanceMatrix.needsUpdate = true;
  halos.instanceMatrix.needsUpdate = true;
  if (seats.instanceColor) seats.instanceColor.needsUpdate = true;
  if (halos.instanceColor) halos.instanceColor.needsUpdate = true;

  const front = new THREE.Vector3(0, 0, 0.1).project(camera);
  const fx = ((front.x + 1) / 2) * W;
  const fy = ((1 - front.y) / 2) * H;
  const r = readout(t);
  const o = cutFade(t);
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.4);

  overlay.innerHTML = `
    <div style="position:absolute;left:76px;top:66px;display:flex;align-items:center;gap:16px">
      ${mark(52)}
      <span style="font:640 36px/1 'Mona Sans Variable';font-stretch:125%;letter-spacing:-0.02em;color:${FOAM}">Consensus</span>
    </div>
    <div style="position:absolute;right:76px;top:68px;display:flex;align-items:center;gap:14px;height:50px;padding:0 22px;border:1px solid rgba(151,252,228,.22);border-radius:9px;font:500 21px/1 'Mona Sans Variable';color:#cfe7e0;background:rgba(7,28,25,.6)">
      <span style="width:12px;height:12px;border-radius:50%;background:${MINT};box-shadow:0 0 0 ${4 + pulse * 5}px rgba(151,252,228,${0.22 - pulse * 0.14}),0 0 16px ${MINT}"></span>Live on Hyperliquid
    </div>
    <div style="position:absolute;left:${fx}px;top:${fy + 44}px;transform:translateX(-50%);opacity:${o};display:flex;flex-direction:column;align-items:center">
      ${led(r.text, 13, r.color)}
      <div style="margin-top:20px;height:28px;font:450 24px/1.2 'Mona Sans Variable';color:#94aea7;white-space:nowrap">${r.sub}</div>
    </div>
    <p style="position:absolute;left:0;right:0;bottom:70px;margin:0;text-align:center;opacity:${o};font:560 34px/1.2 'Mona Sans Variable';font-stretch:112%;letter-spacing:-0.01em;color:${FOAM}">
      ${caption(t)}
    </p>`;

  renderer.render(scene, camera);
}

const w = window as unknown as { __frame: (t: number) => void; __ready: boolean; __duration: number };
w.__frame = frameAt;
w.__duration = DURATION;
frameAt(0);
document.fonts.ready.then(() => {
  frameAt(0);
  requestAnimationFrame(() => {
    w.__ready = true;
  });
});
