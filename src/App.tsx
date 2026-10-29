import { useEffect, useMemo, useState } from "react";
import { buildBoard } from "./lib/board";
import { useLiveBook, usePrefersReducedMotion, useRoom } from "./lib/hooks";
import { Board } from "./components/Board";
import { Footer, Nav } from "./components/Chrome";
import { Fees } from "./components/Fees";
import { Hero } from "./components/Hero";
import { Method } from "./components/Method";
import { Room } from "./components/Room";
import { WalletCheck } from "./components/WalletCheck";

export default function App() {
  const room = useRoom();
  const traders = room.data?.traders ?? null;
  const addresses = useMemo(() => traders?.map((t) => t.address) ?? null, [traders]);
  const book = useLiveBook(addresses);
  const rows = useMemo(
    () => (traders ? buildBoard(traders, book.positions, book.markets) : []),
    [traders, book.positions, book.markets],
  );
  const [coin, setCoin] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();

  // Open on the strongest signal; keep the visitor's pick while it stays on the board.
  useEffect(() => {
    if (rows.length && (!coin || !rows.some((r) => r.coin === coin && r.state !== "thin"))) setCoin(rows[0].coin);
  }, [rows, coin]);

  const pick = (c: string) => {
    setCoin(c);
    document.getElementById("top")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <>
      <a className="skip" href="#board">
        Skip to the board
      </a>
      <Nav updatedAt={book.updatedAt} failing={Boolean(book.error && !book.positions.size)} />
      <main>
        <Hero
          traders={traders}
          rows={rows}
          book={book}
          coin={coin}
          onCoin={setCoin}
          roomError={room.error}
          onRetry={room.retry}
        />
        <Board rows={rows} book={book} size={traders?.length ?? 50} onPick={pick} />
        <Room room={room.data} book={book} error={room.error} />
        <Method room={room.data} />
        <Fees rows={rows} />
        <WalletCheck rows={rows} traders={traders ?? []} />
      </main>
      <Footer />
    </>
  );
}
