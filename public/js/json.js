import { $, showErr, enc } from "/js/common.js";

const area = $("#jsonArea"), info = $("#jsonInfo");

function parse() {
  showErr("#jsonErr");
  try { return JSON.parse(area.value); }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    let where = "";
    if (m) {
      const pos = Number(m[1]);
      const before = area.value.slice(0, pos);
      const line = before.split("\n").length, col = pos - before.lastIndexOf("\n");
      where = ` (บรรทัด ${line}, คอลัมน์ ${col})`;
      area.focus(); area.setSelectionRange(pos, pos + 1);
    }
    showErr("#jsonErr", "JSON ไม่ถูกต้อง" + where + "\n" + e.message);
    return undefined;
  }
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]));
  return v;
}

function describe(v) {
  const bytes = enc.encode(area.value).length;
  const type = Array.isArray(v) ? `array[${v.length}]` : v === null ? "null" : typeof v === "object" ? `object (${Object.keys(v).length} keys)` : typeof v;
  info.textContent = `ถูกต้อง: ${type}, ${area.value.length} ตัวอักษร, ${bytes} bytes`;
}

function apply(fn) {
  const v = parse();
  if (v === undefined) return;
  area.value = fn(v);
  describe(v);
}

$("#jsonFormat").addEventListener("click", () => apply((v) => JSON.stringify(v, null, 2)));
$("#jsonFormat4").addEventListener("click", () => apply((v) => JSON.stringify(v, null, 4)));
$("#jsonMinify").addEventListener("click", () => apply((v) => JSON.stringify(v)));
$("#jsonSortKeys").addEventListener("click", () => apply((v) => JSON.stringify(sortDeep(v), null, 2)));
$("#jsonEscape").addEventListener("click", () => { showErr("#jsonErr"); area.value = JSON.stringify(area.value); info.textContent = ""; });
$("#jsonUnescape").addEventListener("click", () => {
  showErr("#jsonErr");
  try { const s = JSON.parse(area.value); if (typeof s !== "string") throw new Error("ไม่ใช่ escaped string"); area.value = s; info.textContent = ""; }
  catch (e) { showErr("#jsonErr", e.message); }
});
area.addEventListener("input", () => { info.textContent = ""; });
