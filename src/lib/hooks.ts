import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "../../api/_lib/types";
import { CONFIG } from "../config";
import { fetchMarkets, fetchPositions, type Market, type Position } from "./hl";

type Room = { data: RoomSnapshot | null; error: string | null; retry: () => void };

export function useRoom(): Room {
  const [data, setData] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/room");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `The room service answered ${res.status}`);
        if (alive) {
          setData(json as RoomSnapshot);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "The room couldn't be loaded.");
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tick]);

  return { data, error, retry: () => setTick((t) => t + 1) };
}

export type Book = {
  positions: Map<string, Position[]>;
  markets: Map<string, Market>;
  read: number;
  total: number;
  updatedAt: number | null;
  error: string | null;
};

/** Reads every room member's open positions, then repeats every refreshMs. */
export function useLiveBook(addresses: string[] | null): Book {
  const [book, setBook] = useState<Book>({ positions: new Map(), markets: new Map(), read: 0, total: 0, updatedAt: null, error: null });
  const key = addresses?.join(",") ?? "";
  const running = useRef(false);

  useEffect(() => {
    if (!addresses?.length) return;
    let alive = true;

    const cycle = async () => {
      if (running.current) return;
      running.current = true;
      const fresh = new Map<string, Position[]>();
      let read = 0;
      let failed = 0;
      setBook((b) => ({ ...b, total: addresses.length }));
      try {
        const marketsP = fetchMarkets().catch(() => null);
        let next = 0;
        await Promise.all(
          Array.from({ length: 5 }, async () => {
            while (next < addresses.length && alive) {
              const a = addresses[next++];
              try {
                const { positions } = await fetchPositions(a);
                fresh.set(a, positions);
              } catch {
                failed++;
              }
              read++;
              if (alive) setBook((b) => (b.updatedAt ? b : { ...b, read }));
            }
          }),
        );
        const markets = await marketsP;
        if (!alive) return;
        if (failed === addresses.length) throw new Error("Hyperliquid didn't return any positions.");
        setBook((b) => {
          // Accounts that didn't answer this round keep their last known positions.
          for (const a of addresses) if (!fresh.has(a) && b.positions.has(a)) fresh.set(a, b.positions.get(a)!);
          return {
            positions: fresh,
            markets: markets ?? b.markets,
            read,
            total: addresses.length,
            updatedAt: Date.now(),
            error: failed > 0 ? `${failed} of ${addresses.length} accounts didn't answer this round. Showing their last known positions.` : null,
          };
        });
      } catch (err) {
        if (alive) setBook((b) => ({ ...b, error: err instanceof Error ? err.message : "Positions couldn't be read." }));
      } finally {
        running.current = false;
      }
    };

    cycle();
    const id = setInterval(cycle, CONFIG.refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return book;
}

export function useNow(every = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
