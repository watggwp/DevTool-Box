// Assembles public/*.html from src/layout.html + src/pages/*.html + src/tools.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(path.join(root, "src/layout.html"), "utf8");
const tools = JSON.parse(readFileSync(path.join(root, "src/tools.json"), "utf8"));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function nav(active) {
  const home = `      <a href="/" class="${active === "" ? "active" : ""}"><span class="ico">&#8962;</span>หน้าแรก</a>`;
  const items = tools.map(
    (t) => `      <a href="/${t.slug}" class="${t.slug === active ? "active" : ""}"><span class="ico">${esc(t.ico)}</span>${esc(t.name)}</a>`
  );
  return [home, ...items].join("\n");
}

function render({ slug, title, desc, body, script }) {
  return layout
    .replace("{{TITLE}}", esc(title))
    .replace("{{DESC}}", esc(desc))
    .replace("{{NAV}}", nav(slug))
    .replace("{{BODY}}", body)
    .replace("{{SCRIPT}}", script ? `  <script type="module" src="${script}"></script>` : "");
}

// Turn the fragment's leading <h1> + <p class="hint"> into a page header with the tool icon.
function withPageHead(frag, tool) {
  const re = /<h1>([\s\S]*?)<\/h1>\s*(?:<p class="hint">([\s\S]*?)<\/p>)?/;
  const m = frag.match(re);
  if (!m) return frag;
  const head = `<div class="page-head">
          <span class="big-ico" aria-hidden="true">${esc(tool.ico)}</span>
          <div>
            <h1>${m[1]}</h1>
            ${m[2] ? `<p class="hint">${m[2]}</p>` : ""}
          </div>
        </div>`;
  return frag.replace(re, head);
}

// Tool pages
let count = 0;
for (const t of tools) {
  const fragPath = path.join(root, "src/pages", `${t.slug}.html`);
  if (!existsSync(fragPath)) { console.warn(`skip ${t.slug}: no fragment`); continue; }
  const body = withPageHead(readFileSync(fragPath, "utf8"), t);
  const html = render({
    slug: t.slug,
    title: `${t.name} | DevTools Box`,
    desc: t.desc,
    body,
    script: existsSync(path.join(root, "public/js", `${t.slug}.js`)) ? `/js/${t.slug}.js` : "",
  });
  writeFileSync(path.join(root, "public", `${t.slug}.html`), html);
  count++;
}

// Home page
const cards = tools
  .map(
    (t) => `        <a class="tool-card" href="/${t.slug}" data-search="${esc((t.name + " " + t.desc + " " + (t.keywords ?? "")).toLowerCase())}">
          <span class="ico">${esc(t.ico)}</span>
          <strong>${esc(t.name)}</strong>
          <span class="muted">${esc(t.desc)}</span>
          <span class="go">เปิดเครื่องมือ &rarr;</span>
        </a>`
  )
  .join("\n");
const homeBody = `      <section class="tool">
        <div class="hero">
          <h1>DevTools Box</h1>
          <p>รวมเครื่องมือสำหรับนักพัฒนาและงาน embedded แต่ละเครื่องมือแยกเป็นหน้าของตัวเอง ทำงานในเบราว์เซอร์ทั้งหมด ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์</p>
          <div class="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input id="toolSearch" type="search" placeholder="ค้นหาเครื่องมือ เช่น base64, serial, crc" autocomplete="off" aria-label="ค้นหาเครื่องมือ">
            <kbd>/</kbd>
          </div>
        </div>
        <div class="tool-grid" id="toolGrid">
${cards}
        </div>
        <p class="empty" id="toolEmpty" hidden>ไม่พบเครื่องมือที่ตรงกับคำค้น</p>
      </section>`;
writeFileSync(
  path.join(root, "public/index.html"),
  render({ slug: "", title: "DevTools Box", desc: "เครื่องมือนักพัฒนาออนไลน์: Serial Monitor, Base64, URL, Hex, JSON, JWT, Hash, Timestamp, Number base, UUID", body: homeBody, script: "" })
);
console.log(`built ${count} tool pages + index.html`);
