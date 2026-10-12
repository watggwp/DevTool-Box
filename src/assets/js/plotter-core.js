// Serial Plotter pure logic (no DOM) — used by plotter.js and unit tests.
//
// Accepts Arduino Serial Plotter style lines:
//   "1.2 3.4 5"          -> unlabelled series
//   "temp:25.3,hum:60"   -> labelled series
//   "temp: 25.3 hum: 60" -> label followed by a space
//   "temp hum"           -> header line (names for unlabelled series)
// Returns { values: [{label, value}] } or { header: [names] } or null.
export function parseLine(line) {
  const t = String(line).trim();
  if (!t) return null;
  const tokens = t.split(/[\s,;\t]+/).filter(Boolean);
  const values = [];
  const words = [];
  let pending = null;
  for (const tok of tokens) {
    const m = tok.match(/^([^:=]+)[:=](.*)$/);
    let label = pending, raw = tok;
    if (m) { label = m[1]; raw = m[2]; }
    if (raw === "") { pending = label; continue; } // "temp:" then value in next token
    pending = null;
    const num = Number(raw);
    if (Number.isFinite(num)) values.push({ label, value: num });
    else if (!m) words.push(tok);
  }
  if (values.length) return { values };
  if (words.length) return { header: words };
  return null;
}

export function toCsv(names, columns, count) {
  // columns: array of arrays (same length = count), NaN for missing
  const lines = ["sample," + names.map((n) => `"${String(n).replace(/"/g, '""')}"`).join(",")];
  for (let i = 0; i < count; i++) {
    lines.push(i + "," + columns.map((c) => (Number.isNaN(c[i]) ? "" : c[i])).join(","));
  }
  return lines.join("\n");
}

// "nice" tick step for an axis range
export function niceStep(range, targetTicks = 5) {
  if (!(range > 0)) return 1;
  const rough = range / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}
