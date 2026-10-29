# Consensus ($CONSENSUS)

"One whale can be wrong. Fifty rarely are."

Rankar alla traders på Hyperliquid på hur jämnt de vinner, plockar ut de 50 mest konsekventa ("rummet") och läser deras öppna positioner varje minut. En coin signalerar när minst 10 av dem håller den och 70 % står på samma sida.

## Köra lokalt

```bash
npm install
npm run dev
```

Öppna http://localhost:5173. All data är live från Hyperliquids publika API, inga nycklar behövs.

## Innan launch

Allt som ska ändras ligger i `src/config.ts`:

- `ca`: pump.fun-adressen. Då visas en köpknapp i menyn och adressen i footern.
- `x`: länken till X-kontot.
- `feeWallet`: fee-walletens Hyperliquid-adress. När den är satt läser sajten dess saldo och positioner live, och ordrarna räknas i dollar i stället för procent.
- `rules`: tröskelvärdena (10 holders, 70 %, stängning under 55 %, 3x, 6 % stop, 15 % per signal). Texten på sajten läser härifrån, så den stämmer alltid.

## Deploy

Pusha till GitHub och importera i Vercel (framework: Vite). Funktionerna i `api/` följer med automatiskt:

- `api/room.ts` bygger rummet från hela leaderboarden. Cachas 15 min i Vercels edge.
- `api/hl.ts` är en reserv om en webbläsare inte får prata direkt med Hyperliquid.

Positionerna hämtas direkt från besökarens webbläsare, så de använder besökarens egen rate limit hos Hyperliquid.

## Vad som är riktigt

- Riktigt: rankningen, filtren, poängen, konsensus-tavlan, rummets positioner, plånbokskollen och "Copy as post".
- Beta: själva exekveringen. Tills fee-walleten är kopplad visar sajten de ordrar den skulle lägga just nu.

## Justera rankningen

`api/_lib/engine.ts` → `RULES`: minsta konto, min volym, market maker-filter (600x omsättning), returtak (30 %), drawdown-tak (35 %) och vikterna (35/25/20/20).

## Bilder

`brand/` innehåller coin-bilden (1000×1000, även X-profilbild), X-bannern (1500×500) och launch-bilden (1600×900). De renderas från samma 3D-kammare som sajten: kör `npm run dev` och sedan `python3 brand/render.py 5173` för att göra om dem.
