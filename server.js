import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const app = express();
const PORT = process.env.PORT || 3000;

// Security headers. Web Serial needs a secure context (Render serves HTTPS).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "serial=(self), usb=(self), clipboard-write=(self)");
  next();
});

app.get("/healthz", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Each tool is its own page: /serial -> public/serial.html, /base64 -> public/base64.html, ...
app.use(express.static(PUBLIC, { extensions: ["html"], maxAge: "1h", etag: true }));

app.use((req, res) => {
  const notFound = path.join(PUBLIC, "404.html");
  res.status(404);
  if (existsSync(notFound)) res.sendFile(notFound); else res.type("text").send("404 Not Found");
});

app.listen(PORT, () => {
  console.log(`DevTools web listening on http://localhost:${PORT}`);
});
