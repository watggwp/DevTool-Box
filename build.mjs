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

// Tool pages
let count = 0;
for (const t of tools) {
  const frag = path.join(root, "src/pages", `${t.slug}.html`);
  if (!existsSync(frag)) { console.warn(`skip ${t.slug}: no fragment`); continue; }
  const body = readFileSync(frag, "utf8");
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
    (t) => `        <a class="tool-card" href="/${t.slug}">
          <span class="ico">${esc(t.ico)}</span>
          <strong>${esc(t.name)}</strong>
          <span class="muted">${esc(t.desc)}</span>
        </a>`
  )
  .join("\n");
const homeBody = `      <section class="tool">
        <h1>DevTools Box</h1>
        <p class="hint">รวมเครื่องมือสำหรับนักพัฒนาและงาน embedded แต่ละเครื่องมือแยกเป็นหน้าของตัวเอง ทำงานในเบราว์เซอร์ทั้งหมด ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์</p>
        <div class="tool-grid">
${cards}
        </div>
      </section>`;
writeFileSync(
  path.join(root, "public/index.html"),
  render({ slug: "", title: "DevTools Box", desc: "เครื่องมือนักพัฒนาออนไลน์: Serial Monitor, Base64, URL, Hex, JSON, JWT, Hash, Timestamp, Number base, UUID", body: homeBody, script: "" })
);
console.log(`built ${count} tool pages + index.html`);
