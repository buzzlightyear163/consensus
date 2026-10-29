// POST /api/hl — fallback relay to Hyperliquid's public /info endpoint for browsers
// that can't call it directly. Only the read-only queries the site uses are allowed.
import { INFO_URL } from "./_lib/hyperliquid.js";

const ALLOWED = new Set(["clearinghouseState", "metaAndAssetCtxs", "allMids", "portfolio"]);

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!ALLOWED.has(String(body.type))) {
    return Response.json({ error: `Query type ${String(body.type)} isn't relayed.` }, { status: 400 });
  }
  if ("user" in body && !/^0x[0-9a-fA-F]{40}$/.test(String(body.user))) {
    return Response.json({ error: "user must be a 0x address." }, { status: 400 });
  }
  const upstream = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
