// Builds the site, then checks every page, every local link, the PWA files and the static server.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT, readText } from "./helpers.mjs";

const DIST = path.join(ROOT, "dist");
const tools = JSON.parse(readText("src/tools.json"));
const site = JSON.parse(readText("src/site.json"));

before(() => {
  execFileSync(process.execPath, ["build.mjs"], { cwd: ROOT, stdio: "pipe" });
});

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test("every tool is registered correctly and has its page and script", () => {
  const slugs = new Set();
  const groups = new Set(site.groups.map((g) => g.id));
  for (const t of tools) {
    assert.match(t.slug, /^[a-z0-9-]+$/, t.slug);
    assert.ok(!slugs.has(t.slug), `duplicate slug ${t.slug}`);
    slugs.add(t.slug);
    assert.ok(groups.has(t.group), `${t.slug}: unknown group ${t.group}`);
    for (const k of ["name", "ico", "desc"]) assert.ok(t[k], `${t.slug}: missing ${k}`);
    assert.ok(existsSync(path.join(ROOT, "src/pages", `${t.slug}.html`)), `${t.slug}: missing page`);
    assert.ok(existsSync(path.join(ROOT, "src/assets/js", `${t.slug}.js`)), `${t.slug}: missing script`);
    assert.ok(existsSync(path.join(DIST, t.slug, "index.html")), `${t.slug}: not built`);
  }
});

test("built pages have the shell: home button, footer credits, single h1, manifest", () => {
  const home = readFileSync(path.join(DIST, "index.html"), "utf8");
  assert.equal((home.match(/class="tool-card"/g) || []).length, tools.length);
  for (const t of tools) {
    const html = readFileSync(path.join(DIST, t.slug, "index.html"), "utf8");
    assert.match(html, /class="home-btn"/, t.slug);
    assert.match(html, /class="foot"/, t.slug);
    assert.ok(html.includes(site.developer.name), `${t.slug}: footer credit`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${t.slug}: h1 count`);
    assert.match(html, /rel="manifest"/, t.slug);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), `${t.slug}: unreplaced placeholder`);
  }
});

test("every local href / src / import in the built site resolves to a file", () => {
  const files = walk(DIST);
  const missing = [];
  const exists = (u) => {
    const p = path.join(DIST, decodeURIComponent(u.split(/[?#]/)[0]));
    return (existsSync(p) && statSync(p).isFile()) || existsSync(path.join(p, "index.html"));
  };
  for (const f of files.filter((x) => /\.(html|js|css)$/.test(x))) {
    const text = readFileSync(f, "utf8");
    const refs = [
      ...text.matchAll(/(?:href|src)="(\/[^"]*)"/g),
      ...text.matchAll(/from\s+"(\/assets\/[^"]+)"/g),
      ...text.matchAll(/import\(\s*"(\/assets\/[^"]+)"\s*\)/g),
      ...text.matchAll(/url\((\/assets\/[^)]+)\)/g),
    ].map((m) => m[1]);
    for (const r of refs) if (!exists(r)) missing.push(`${path.relative(DIST, f)} -> ${r}`);
  }
  assert.deepEqual(missing, []);
});

test("Thai text is valid UTF-8, not mojibake from a wrong-encoding save", () => {
  // Thai read as Windows-874 / Latin-1 and re-saved as UTF-8 shows up as e.g. "เน€เธ..." or "à¸...".
  const bad = /[฀-๿][€‚“”‘’•–—]|à[¸¹]|�/;
  const textFiles = [
    ...walk(path.join(ROOT, "src")),
    ...walk(DIST),
    ...["README.md", "build.mjs", "server.js"].map((f) => path.join(ROOT, f)),
  ].filter((f) => /\.(html|js|mjs|css|json|md|webmanifest)$/.test(f) && !f.includes("vendor"));
  const hits = [];
  for (const f of textFiles) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((l, i) => { if (bad.test(l)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`); });
  }
  assert.deepEqual(hits, []);
});

test("no third-party scripts or styles are loaded", () => {
  for (const f of walk(DIST).filter((x) => x.endsWith(".html"))) {
    const html = readFileSync(f, "utf8");
    assert.ok(!/<script[^>]+src="https?:/.test(html), `${f}: external script`);
    assert.ok(!/<link[^>]+rel="stylesheet"[^>]+href="https?:/.test(html), `${f}: external stylesheet`);
  }
});

test("PWA: manifest is valid and the service worker precaches existing files", () => {
  const m = JSON.parse(readFileSync(path.join(DIST, "manifest.webmanifest"), "utf8"));
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"));
  for (const i of m.icons) assert.ok(existsSync(path.join(DIST, i.src)), i.src);
  const sw = readFileSync(path.join(DIST, "sw.js"), "utf8");
  const list = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
  assert.ok(list.includes("/") && list.includes("/404.html") && list.includes("/flash/"));
  for (const u of list) {
    const p = path.join(DIST, u.endsWith("/") ? u + "index.html" : u);
    assert.ok(existsSync(p), `precache entry missing: ${u}`);
  }
  assert.match(sw, /const VERSION = "[0-9a-f]{12}"/);
});

// ---------- static server ----------
let server, base;
before(async () => {
  const port = 3500 + Math.floor(Math.random() * 400);
  server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(base + "/healthz"); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("server did not start");
});
after(() => server?.kill());

test("server: pages, redirects, 404, headers, no path traversal", async () => {
  let r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("cache-control"), /no-cache/);
  for (const t of tools) assert.equal((await fetch(`${base}/${t.slug}/`)).status, 200, t.slug);
  r = await fetch(base + "/serial", { redirect: "manual" });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "/serial/");
  assert.equal((await fetch(base + "/nope")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e/server.js")).status, 404);
  r = await fetch(base + "/sw.js");
  assert.match(r.headers.get("cache-control"), /no-cache/);
  r = await fetch(base + "/manifest.webmanifest");
  assert.match(r.headers.get("content-type"), /manifest\+json/);
  r = await fetch(base + "/assets/style.css");
  assert.match(r.headers.get("cache-control"), /max-age=3600/);
  const etag = r.headers.get("etag");
  assert.equal((await fetch(base + "/assets/style.css", { headers: { "If-None-Match": etag } })).status, 304);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
});
