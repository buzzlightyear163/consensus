import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

// Runs the same /api functions Vercel deploys, so `npm run dev` works with live data locally.
function localApi(): Plugin {
  const routes = new Set(["room", "hl"]);
  let server: ViteDevServer | undefined;

  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? "").split("?")[0];
    const name = path.startsWith("/api/") ? path.slice(5) : "";
    if (!routes.has(name) || !server) return next();
    try {
      const mod = await server.ssrLoadModule(`/api/${name}.ts`);
      const handler = mod[req.method ?? "GET"];
      if (typeof handler !== "function") {
        res.statusCode = 405;
        return res.end();
      }
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: { "content-type": String(req.headers["content-type"] ?? "application/json") },
        body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
      });
      const response: Response = await handler(request);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  };

  return {
    name: "local-api",
    configureServer(s) {
      server = s;
      s.middlewares.use(handle);
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
});
