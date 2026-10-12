// Builds the static site into dist/ (zero dependencies).
//   src/site.json     site name, credits, tool groups
//   src/tools.json    list of tools (one page each)
//   src/layout.html   shared page shell (bar + main + footer)
//   src/pages/*.html  body of each tool page
//   src/assets/       css, js, icons (copied as-is)
// Output: dist/index.html, dist/<slug>/index.html, dist/404.html, dist/assets/*
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (p) => path.join(root, "src", p);
const DIST = path.join(root, "dist");
const read = (p) => readFileSync(src(p), "utf8");

const site = JSON.parse(read("site.json"));
const tools = JSON.parse(read("tools.json"));
const layout = read("layout.html");
const year = new Date().getFullYear();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (o) => (o?.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>` : esc(o?.name ?? ""));

const ARROW_LEFT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`;
const SEARCH = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;

function brand() {
  return `      <a href="/" class="brand"><img src="/assets/favicon.svg" width="28" height="28" alt=""><span>${esc(site.name)}</span></a>`;
}

function toolBar(t) {
  return `      <a href="/" class="home-btn" title="กลับหน้าหลัก">${ARROW_LEFT}<span>หน้าหลัก</span></a>
      <span class="bar-sep" aria-hidden="true"></span>
      <span class="crumb"><span class="crumb-ico" aria-hidden="true">${esc(t.ico)}</span><span class="crumb-name">${esc(t.name)}</span></span>`;
}

function footer() {
  const org = site.organization?.name ? `<span class="dot" aria-hidden="true"></span>${link(site.organization)}` : "";
  const repo = site.repo ? `<a href="${esc(site.repo)}" target="_blank" rel="noopener">Source code</a>` : "";
  return `  <footer class="foot">
    <div class="foot-in">
      <div class="foot-brand">
        <img src="/assets/favicon.svg" width="32" height="32" alt="">
        <div>
          <strong>${esc(site.name)}</strong>
          <span>ทำงานในเบราว์เซอร์ทั้งหมด ข้อมูลไม่ถูกส่งออกจากเครื่องของคุณ</span>
        </div>
      </div>
      <div class="foot-credit">
        <span>พัฒนาโดย ${link(site.developer)}${org}</span>
        <span class="muted">&copy; ${year} ${esc(site.name)}${site.version ? ` <span class="dot" aria-hidden="true"></span> v${esc(site.version)}` : ""}</span>
      </div>
      <nav class="foot-links" aria-label="ลิงก์ท้ายเว็บ">
        <a href="/">หน้าหลัก</a>
        ${repo}
      </nav>
    </div>
  </footer>`;
}

function render({ title, desc, bar, body, script, bodyClass, extraHead = "" }) {
  return layout
    .replace("{{EXTRA_HEAD}}", () => extraHead)
    .replace("{{TITLE}}", () => esc(title))
    .replace("{{DESC}}", () => esc(desc))
    .replace("{{BODYCLASS}}", () => bodyClass)
    .replace("{{BAR}}", () => bar)
    .replace("{{BODY}}", () => body)
    .replace("{{FOOTER}}", () => footer())
    .replace("{{SCRIPT}}", () => script);
}

// Turn the fragment's leading <h1> + <p class="hint"> into a page header with the tool icon.
function withPageHead(frag, tool) {
  const re = /<h1>([\s\S]*?)<\/h1>\s*(?:<p class="hint">([\s\S]*?)<\/p>)?/;
  const m = frag.match(re);
  if (!m) return frag;
  return frag.replace(re, () => `<div class="page-head">
          <span class="big-ico" aria-hidden="true">${esc(tool.ico)}</span>
          <div>
            <h1>${m[1]}</h1>
            ${m[2] ? `<p class="hint">${m[2]}</p>` : ""}
          </div>
        </div>`);
}

function write(rel, html) {
  const file = path.join(DIST, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ---------- clean + copy assets ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(src("assets"), path.join(DIST, "assets"), { recursive: true });

// ---------- tool pages: each one stands alone at /<slug>/ ----------
let count = 0;
const built = [];
for (const t of tools) {
  if (!existsSync(src(`pages/${t.slug}.html`))) { console.warn(`skip ${t.slug}: no src/pages/${t.slug}.html`); continue; }
  const hasJs = existsSync(src(`assets/js/${t.slug}.js`));
  write(`${t.slug}/index.html`, render({
    title: `${t.name} | ${site.name}`,
    desc: t.desc,
    bar: toolBar(t),
    body: withPageHead(read(`pages/${t.slug}.html`), t),
    // tool scripts import common.js themselves, so only one script tag is needed
    script: hasJs ? `/assets/js/${t.slug}.js` : "/assets/js/common.js",
    bodyClass: `page-tool tool-${t.slug}`,
    // optional per-tool stylesheet: src/assets/css/<slug>.css
    extraHead: existsSync(src(`assets/css/${t.slug}.css`)) ? `  <link rel="stylesheet" href="/assets/css/${t.slug}.css">` : "",
  }));
  count++;
  built.push(t);
}

// ---------- home page ----------
const groupsHtml = site.groups
  .map((g) => {
    const items = built.filter((t) => t.group === g.id);
    if (!items.length) return "";
    const cards = items
      .map((t) => `            <a class="tool-card" href="/${t.slug}/" data-search="${esc((t.name + " " + t.desc + " " + (t.keywords ?? "")).toLowerCase())}">
              <span class="tc-ico" aria-hidden="true">${esc(t.ico)}</span>
              <span class="tc-body"><strong>${esc(t.name)}</strong><span>${esc(t.desc)}</span></span>
              <span class="tc-go" aria-hidden="true">&rsaquo;</span>
            </a>`)
      .join("\n");
    return `        <section class="group" aria-labelledby="g-${g.id}">
          <div class="group-head"><h2 id="g-${g.id}">${esc(g.name)}</h2><span>${esc(g.desc)}</span></div>
          <div class="tool-grid">
${cards}
          </div>
        </section>`;
  })
  .join("\n");

const homeBody = `      <section class="hero">
        <span class="hero-badge">${built.length} เครื่องมือ <span class="dot" aria-hidden="true"></span> ฟรี <span class="dot" aria-hidden="true"></span> ไม่ต้องติดตั้ง</span>
        <h1>${esc(site.name)}</h1>
        <p>${esc(site.tagline)}</p>
        <label class="search">
          ${SEARCH}
          <input id="toolSearch" type="search" placeholder="ค้นหาเครื่องมือ เช่น serial, base64, crc" autocomplete="off" aria-label="ค้นหาเครื่องมือ">
          <kbd>/</kbd>
        </label>
      </section>
${groupsHtml}
      <p class="empty" id="toolEmpty" hidden>ไม่พบเครื่องมือที่ตรงกับคำค้น</p>`;

write("index.html", render({
  title: `${site.name} | เครื่องมือนักพัฒนาออนไลน์`,
  desc: site.tagline,
  bar: brand(),
  body: homeBody,
  script: "/assets/js/common.js",
  bodyClass: "page-home",
}));

// ---------- 404 ----------
write("404.html", render({
  title: `ไม่พบหน้า | ${site.name}`,
  desc: "ไม่พบหน้าที่ต้องการ",
  bar: brand(),
  body: `      <section class="notfound">
        <div class="nf-code">404</div>
        <h1>ไม่พบหน้าที่ต้องการ</h1>
        <p class="hint">ลิงก์อาจไม่ถูกต้องหรือเครื่องมือถูกย้ายไปแล้ว</p>
        <a class="btn primary" href="/">${ARROW_LEFT} กลับหน้าหลัก</a>
      </section>`,
  script: "/assets/js/common.js",
  bodyClass: "page-404",
}));

console.log(`built ${count} tool pages + index.html + 404.html -> dist/`);
