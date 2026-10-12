// Tiny zero-dependency static server for dist/ (uses only Node built-ins).
// Low memory, no framework. Used for local dev and as an optional Render "Web Service".
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "serial=(self), usb=(self)",
};

function statFile(p) {
  try { const s = statSync(p); return s.isFile() ? s : null; } catch { return null; }
}

// Map a URL path to a file inside ROOT; /serial and /serial/ both -> /serial/index.html
function resolve(urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return null; }
  const abs = path.normalize(path.join(ROOT, rel));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  for (const candidate of [abs, path.join(abs, "index.html"), abs + ".html"]) {
    const s = statFile(candidate);
    if (s) return { file: candidate, stat: s };
  }
  return null;
}

function send(req, res, status, file, stat) {
  const ext = path.extname(file);
  const etag = `W/"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const headers = {
    ...HEADERS,
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    ETag: etag,
  };
  if (status === 200 && req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  headers["Content-Length"] = stat.size;
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  const { pathname } = new URL(req.url, "http://x");
  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end('{"ok":true}');
  }
  // canonical trailing slash for tool pages: /serial -> /serial/
  if (!path.extname(pathname) && !pathname.endsWith("/")) {
    const dirIndex = statFile(path.join(ROOT, pathname, "index.html"));
    if (dirIndex) {
      res.writeHead(301, { Location: pathname + "/" });
      return res.end();
    }
  }
  const hit = resolve(pathname);
  if (hit) return send(req, res, 200, hit.file, hit.stat);
  const nf = path.join(ROOT, "404.html");
  const s = statFile(nf);
  if (s) return send(req, res, 404, nf, s);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

server.keepAliveTimeout = 5000;
server.listen(PORT, () => console.log(`DevTools Box on http://localhost:${PORT}`));
