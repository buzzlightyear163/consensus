import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { price, traderName, usd } from "../lib/format";
import { usePrefersReducedMotion } from "../lib/hooks";
import { Hemicycle, type Seat } from "./Hemicycle";

// A four-tier chamber with one seat per trader in the room, seen from the floor.
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

const C_LONG = new THREE.Color("#97fce4");
const C_SHORT = new THREE.Color("#ff8a73");
const C_FLAT = new THREE.Color("#1d3d36");
const C_EMPTY = new THREE.Color("#0c211d");
const C_WAIT = new THREE.Color("#2a5a50");
const BLACK = new THREE.Color(0, 0, 0);

type SeatPoint = { x: number; y: number; z: number; a: number; tier: number };

/** Seats ordered left to right across the chamber, so consecutive seats form wedges. */
function seatPoints(): SeatPoint[] {
  const pts: SeatPoint[] = [];
  TIERS.forEach(({ r, n }, tier) => {
    for (let j = 0; j < n; j++) {
      const a = Math.PI - PAD - (j * (Math.PI - 2 * PAD)) / (n - 1);
      pts.push({ x: r * Math.cos(a), y: (tier + 1) * STEP, z: -r * Math.sin(a), a, tier });
    }
  });
  return pts.sort((p, q) => q.a - p.a || p.tier - q.tier);
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.42)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(151,252,228,0.20)");
  grd.addColorStop(0.45, "rgba(151,252,228,0.06)");
  grd.addColorStop(1, "rgba(151,252,228,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function arc(radius: number, y: number, color: THREE.Color, opacity: number) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI;
    pts.push(new THREE.Vector3(radius * Math.cos(a), y, -radius * Math.sin(a)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function seatColor(seat: Seat | undefined, loading: boolean) {
  if (!seat) return C_EMPTY;
  if (loading) return C_FLAT;
  if (!seat.position) return C_FLAT;
  return seat.position.side === "long" ? C_LONG : C_SHORT;
}

type Anim = { from: THREE.Color; to: THREE.Color; cur: THREE.Color; t0: number; pop: boolean };

type Scene = {
  setSeats: (seats: Seat[], loading: boolean) => void;
  dispose: () => void;
};

const supportsWebGL = () => {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};

export function Chamber({
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
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const seatsRef = useRef<Seat[]>(seats);
  const reduced = usePrefersReducedMotion();
  const [fallback, setFallback] = useState(() => typeof window !== "undefined" && !supportsWebGL());
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const [wellY, setWellY] = useState<number | null>(null);
  seatsRef.current = seats;

  useEffect(() => {
    if (fallback || !host.current || !canvasRef.current) return;
    const el = host.current;
    const canvas = canvasRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
    const target = new THREE.Vector3(0, 0.05, -0.75);

    scene.add(new THREE.HemisphereLight(0xc8fff2, 0x020f0c, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1.5, 6, 6);
    scene.add(key);

    // Floor: a soft pool of light where the readout sits, and a faint dot grid.
    const glow = glowTexture();
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 64),
      new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.001, -0.5);
    scene.add(pool);

    const grid: number[] = [];
    const gridColors: number[] = [];
    for (let gx = -5.2; gx <= 5.2; gx += 0.26) {
      for (let gz = -4.2; gz <= 3.4; gz += 0.26) {
        const d = Math.hypot(gx, gz + 0.6);
        if (d > 5.4) continue;
        grid.push(gx, 0, gz);
        const k = Math.max(0, 1 - d / 5.4) * 0.55;
        gridColors.push(0.59 * k, 0.99 * k, 0.89 * k);
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
    gridGeo.setAttribute("color", new THREE.Float32BufferAttribute(gridColors, 3));
    const gridPts = new THREE.Points(
      gridGeo,
      new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    scene.add(gridPts);

    // The floor's front edge, fading out at both ends.
    {
      const pts: number[] = [];
      const cols: number[] = [];
      for (let k = 0; k <= 40; k++) {
        const x = -3.4 + (k / 40) * 6.8;
        pts.push(x, 0.002, 0);
        const f = Math.max(0, 1 - Math.pow(Math.abs(x) / 3.4, 2)) * 0.5;
        cols.push(0.59 * f, 0.99 * f, 0.89 * f);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true })));
    }

    // Tiers: matte steps with a lit front edge.
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x0b2723, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide });
    const riserMat = new THREE.MeshStandardMaterial({ color: 0x07201c, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    TIERS.forEach(({ r }, t) => {
      const y = (t + 1) * STEP;
      const inner = r - DEPTH / 2;
      const outer = r + DEPTH / 2;
      const top = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1, 0, Math.PI), stepMat);
      top.rotation.x = -Math.PI / 2;
      top.position.y = y;
      scene.add(top);
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, STEP, 128, 1, true, Math.PI / 2, Math.PI), riserMat);
      riser.position.y = y - STEP / 2;
      scene.add(riser);
      scene.add(arc(inner, y + 0.002, C_LONG, 0.34 - t * 0.04));
    });
    // Back wall behind the last tier.
    {
      const r = TIERS[TIERS.length - 1].r + DEPTH / 2;
      const h = TIERS.length * STEP + 0.32;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 128, 1, true, Math.PI / 2, Math.PI), riserMat);
      wall.position.y = h / 2;
      scene.add(wall);
      scene.add(arc(r, h + 0.002, C_LONG, 0.12));
    }

    // Seats, their glow, and larger invisible targets for hovering.
    const points = seatPoints();
    const N = points.length;
    const seatGeo = new THREE.CapsuleGeometry(SEAT_R, SEAT_LEN, 6, 16);
    const seatMesh = new THREE.InstancedMesh(seatGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    const haloMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.66, 0.66),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      N,
    );
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    hitMat.colorWrite = false;
    const hitMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 8), hitMat, N);
    scene.add(seatMesh, haloMesh, hitMesh);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const seatH = SEAT_LEN / 2 + SEAT_R;
    points.forEach((pt, i) => {
      m.makeTranslation(pt.x, pt.y + seatH + 0.02, pt.z);
      hitMesh.setMatrixAt(i, m);
      seatMesh.setColorAt(i, C_EMPTY);
      haloMesh.setColorAt(i, BLACK);
    });
    hitMesh.instanceMatrix.needsUpdate = true;

    const anims: Anim[] = points.map(() => ({ from: C_EMPTY.clone(), to: C_EMPTY.clone(), cur: C_EMPTY.clone(), t0: 0, pop: false }));
    const scaleOf = new Float32Array(N).fill(1);
    let hovered = -1;
    let loadingNow = true;
    let dirty = true;

    const writeSeat = (i: number) => {
      const pt = points[i];
      const pop = scaleOf[i] * (i === hovered ? 1.25 : 1);
      s.set(pop, pop, pop);
      p.set(pt.x, pt.y + seatH * pop, pt.z);
      m.compose(p, q.identity(), s);
      seatMesh.setMatrixAt(i, m);
      seatMesh.setColorAt(i, anims[i].cur);
      const lit = anims[i].cur.r + anims[i].cur.g + anims[i].cur.b;
      const k = Math.max(0, (lit - 0.55) / 1.9);
      haloMesh.setColorAt(i, new THREE.Color(anims[i].cur.r * k, anims[i].cur.g * k, anims[i].cur.b * k));
    };

    const writeHalos = () => {
      camera.getWorldQuaternion(q);
      points.forEach((pt, i) => {
        const pop = scaleOf[i] * (i === hovered ? 1.3 : 1);
        s.set(pop, pop, pop);
        p.set(pt.x, pt.y + seatH * pop, pt.z);
        m.compose(p, q, s);
        haloMesh.setMatrixAt(i, m);
      });
      haloMesh.instanceMatrix.needsUpdate = true;
    };

    // Camera: framed to fit the chamber; follows the pointer a little and rises as you scroll past.
    let az = 0;
    let azTarget = 0;
    let lift = 0;
    let liftTarget = 0;
    let width = 1;
    let height = 1;
    let dist = 7;

    const place = () => {
      const elev = THREE.MathUtils.degToRad(27 + lift * 26);
      camera.position.set(
        target.x + dist * Math.sin(az) * Math.cos(elev),
        target.y + dist * Math.sin(elev),
        target.z + dist * Math.cos(az) * Math.cos(elev),
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
    };

    // The readout hangs just in front of the chamber, like a board at the speaker's desk.
    const projectWell = () => {
      const v = new THREE.Vector3(0, 0, 0.2).project(camera);
      setWellY(((1 - v.y) / 2) * height);
    };

    const resize = () => {
      width = el.clientWidth || 1;
      height = el.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const halfW = halfH * camera.aspect;
      // Fit the chamber's width, and leave room under the floor line for the readout.
      dist = Math.max(5.6, 3.3 / (0.95 * halfW), 1.7 / halfH);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      place();
      // Centre the chamber plus the readout under it vertically in the stage.
      const backTop = new THREE.Vector3(0, TIERS.length * STEP + 0.32, -(TIERS[TIERS.length - 1].r + DEPTH / 2)).project(camera);
      const front = new THREE.Vector3(0, 0, 0.2).project(camera);
      const topPx = ((1 - backTop.y) / 2) * height;
      const readoutH = width < 640 ? 96 : Math.min(140, Math.max(100, window.innerWidth * 0.064 + 48));
      const bottomPx = ((1 - front.y) / 2) * height + readoutH;
      const shift = topPx - (height - (bottomPx - topPx)) / 2;
      camera.setViewOffset(width, height, 0, shift, width, height);
      camera.updateProjectionMatrix();
      writeHalos();
      projectWell();
      dirty = true;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      liftTarget = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      dirty = true;
    };
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      azTarget = nx * 0.1;
      dirty = true;
      // Hover a seat.
      const ndc = new THREE.Vector2(nx, -(((e.clientY - r.top) / r.height) * 2 - 1));
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(hitMesh, false)[0];
      const idx = hit?.instanceId ?? -1;
      const valid = idx >= 0 && idx < seatsRef.current.length && !loadingNow ? idx : -1;
      if (valid !== hovered) {
        const prev = hovered;
        hovered = valid;
        if (prev >= 0) writeSeat(prev);
        if (valid >= 0) writeSeat(valid);
        seatMesh.instanceMatrix.needsUpdate = true;
        if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
        writeHalos();
      }
      if (valid >= 0) {
        const pt = points[valid];
        const v = new THREE.Vector3(pt.x, pt.y + seatH * 2 + 0.05, pt.z).project(camera);
        setTip({ i: valid, x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height });
      } else {
        setTip(null);
      }
    };
    const onLeave = () => {
      azTarget = 0;
      if (hovered >= 0) {
        const prev = hovered;
        hovered = -1;
        writeSeat(prev);
        seatMesh.instanceMatrix.needsUpdate = true;
        writeHalos();
      }
      setTip(null);
      dirty = true;
    };
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motion) window.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointermove", onPointer);
    el.addEventListener("pointerdown", onPointer);
    el.addEventListener("pointerleave", onLeave);

    const DUR = 460;
    const STAGGER = motion ? 13 : 0;

    const setSeats = (next: Seat[], loading: boolean) => {
      const now = performance.now();
      loadingNow = loading;
      for (let i = 0; i < N; i++) {
        const target = seatColor(next[i], loading);
        const a = anims[i];
        if (a.to.equals(target)) continue;
        a.from.copy(a.cur);
        a.to.copy(target);
        a.t0 = now + i * STAGGER;
        a.pop = motion && !loading && target !== C_FLAT && target !== C_EMPTY;
      }
      dirty = true;
    };

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        dirty = true;
        loop();
      }
    });
    io.observe(el);

    const loop = () => {
      cancelAnimationFrame(raf);
      if (!visible) return;
      raf = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      let busy = false;
      // Seat colours and pops.
      let colorsChanged = false;
      for (let i = 0; i < N; i++) {
        const a = anims[i];
        if (a.cur.equals(a.to) && scaleOf[i] === 1) continue;
        const k = Math.min(1, Math.max(0, (now - a.t0) / (motion ? DUR : 1)));
        if (k <= 0) {
          busy = true;
          continue;
        }
        const e = 1 - Math.pow(1 - k, 3);
        a.cur.copy(a.from).lerp(a.to, e);
        scaleOf[i] = a.pop ? 1 + Math.sin(Math.PI * k) * 0.32 : 1;
        if (k >= 1) {
          a.cur.copy(a.to);
          scaleOf[i] = 1;
        } else busy = true;
        writeSeat(i);
        colorsChanged = true;
      }
      // While positions load, a dim pulse travels across the seats.
      if (loadingNow && motion) {
        for (let i = 0; i < N; i++) {
          if (!seatsRef.current[i]) continue;
          const w = Math.max(0, Math.sin(now / 520 - i * 0.16));
          anims[i].cur.copy(C_FLAT).lerp(C_WAIT, w * w);
          writeSeat(i);
        }
        colorsChanged = true;
        busy = true;
      }
      if (colorsChanged) {
        seatMesh.instanceMatrix.needsUpdate = true;
        if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
        if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true;
      }
      // Camera easing.
      if (motion) {
        const dAz = azTarget - az;
        const dLift = liftTarget - lift;
        if (Math.abs(dAz) > 0.0005 || Math.abs(dLift) > 0.0005) {
          az += dAz * 0.08;
          lift += dLift * 0.12;
          place();
          writeHalos();
          busy = true;
        }
      }
      if (busy || dirty || colorsChanged) {
        renderer.render(scene, camera);
        dirty = false;
      }
      raf = requestAnimationFrame(tick);
    };

    sceneRef.current = {
      setSeats,
      dispose: () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener("scroll", onScroll);
        el.removeEventListener("pointermove", onPointer);
        el.removeEventListener("pointerdown", onPointer);
        el.removeEventListener("pointerleave", onLeave);
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose?.();
        });
        glow.dispose();
        renderer.dispose();
      },
    };
    setSeats(seatsRef.current, true);
    loop();

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [fallback, reduced]);

  useEffect(() => {
    sceneRef.current?.setSeats(seats, loading);
  }, [seats, loading]);

  if (fallback) {
    return (
      <div className="stage stage-flat">
        <Hemicycle seats={seats} coin={coin} loading={loading}>
          {children}
        </Hemicycle>
      </div>
    );
  }

  const hoveredSeat = tip ? seats[tip.i] : undefined;
  const longs = seats.filter((x) => x.position?.side === "long").length;
  const shorts = seats.filter((x) => x.position?.side === "short").length;
  const label = coin
    ? `The room: ${longs} long, ${shorts} short and ${seats.length - longs - shorts} without a ${coin} position, out of ${seats.length} traders.`
    : `The room's ${seats.length} seats.`;

  return (
    <div className="stage" ref={host} style={wellY !== null ? ({ "--well-y": `${wellY}px` } as React.CSSProperties) : undefined}>
      <canvas ref={canvasRef} className="stage-canvas" role="img" aria-label={label} />
      <div className="stage-overlay">{children}</div>
      {tip && hoveredSeat && (
        <div
          className={`seat-tip tip-${tip.x < width3(host) * 0.3 ? "left" : tip.x > width3(host) * 0.7 ? "right" : "center"}`}
          style={{ left: tip.x, top: tip.y }}
          role="status"
        >
          <span className="tip-who">
            #{hoveredSeat.trader.rank} {traderName(hoveredSeat.trader)}
          </span>
          {hoveredSeat.position ? (
            <span className={`tip-pos side-${hoveredSeat.position.side}`}>
              {hoveredSeat.position.side === "long" ? "Long" : "Short"} {usd(hoveredSeat.position.notional)} {coin} at{" "}
              {price(hoveredSeat.position.entry)}, {hoveredSeat.position.leverage}x
            </span>
          ) : (
            <span className="tip-pos">No {coin} position</span>
          )}
        </div>
      )}
    </div>
  );
}

const width3 = (ref: React.RefObject<HTMLDivElement>) => ref.current?.clientWidth ?? 1;
