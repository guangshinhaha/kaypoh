import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../fixtures/site");

/** Local test site. Every request is counted so tests can prove nothing was submitted. */
export async function startSite(): Promise<{ url: string; posts: string[]; close: () => Promise<void> }> {
  const posts: string[] = [];
  const server: Server = createServer(async (req, res) => {
    const p = (req.url ?? "/").split("?")[0]!;
    if (req.method === "POST") posts.push(p);
    if (p === "/blocked") {
      res.writeHead(403, { "content-type": "text/html" }).end("<p>Forbidden</p>");
      return;
    }
    const file = p === "/" ? "index.html" : p.slice(1);
    try {
      res.writeHead(200, { "content-type": "text/html" }).end(await readFile(path.join(dir, file)));
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, posts, close: () => new Promise((r) => server.close(() => r())) };
}
