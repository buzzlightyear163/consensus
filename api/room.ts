// GET /api/room — the current top 50, re-ranked at most every 15 minutes per edge region.
import { getRoom } from "./_lib/engine.js";

export const maxDuration = 60;

export async function GET(): Promise<Response> {
  try {
    const room = await getRoom();
    return Response.json(room, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Couldn't build the room from Hyperliquid: ${message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
