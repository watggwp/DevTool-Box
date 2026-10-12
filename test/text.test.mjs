// Text Diff (Myers) and Cron parser / next-run calculation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importJs } from "./helpers.mjs";

const { diffLines, unified, stats, charDiff, pairRows } = await importJs("diff-core.js");
const { parseCron, nextRuns } = await importJs("cron-core.js");

function applyUnified(aText, patch) {
  const A = aText === "" ? [] : aText.split("\n");
  const lines = patch.split("\n");
  const out = [];
  let ai = 0;
  for (let i = 2; i < lines.length; i++) {
    const h = lines[i].match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
    if (!h) continue;
    const aStart = Number(h[2]) ? Number(h[1]) - 1 : Number(h[1]);
    while (ai < aStart) out.push(A[ai++]);
    i++;
    while (i < lines.length && !lines[i].startsWith("@@") && lines[i] !== "") {
      const c = lines[i][0], s = lines[i].slice(1);
      if (c === " ") out.push(A[ai++]); else if (c === "-") ai++; else if (c === "+") out.push(s);
      i++;
    }
    i--;
  }
  while (ai < A.length) out.push(A[ai++]);
  return out.join("\n");
}

test("diff reconstructs both sides and unified patches apply (300 random cases)", () => {
  let s = 42;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 0; t < 300; t++) {
    const A = Array.from({ length: Math.floor(rnd() * 40) }, () => "L" + Math.floor(rnd() * 8));
    const B = A.filter(() => rnd() > 0.3).flatMap((x) => (rnd() > 0.8 ? [x, "N" + Math.floor(rnd() * 5)] : [x]));
    if (rnd() > 0.5) B.unshift("X");
    const a = A.join("\n"), b = B.join("\n");
    const res = diffLines(a, b);
    assert.equal(res.ops.filter((o) => o.t !== "+").map((o) => res.A[o.a]).join("\n"), a);
    assert.equal(res.ops.filter((o) => o.t !== "-").map((o) => res.B[o.b]).join("\n"), b);
    const patch = unified(res, 3);
    if (a !== b) assert.equal(applyUnified(a, patch), b); else assert.equal(patch, "");
    assert.equal(pairRows(res.ops).filter((x) => x.t !== "+").length, res.A.length);
  }
});

test("diff is minimal, honours options, and is fast on 5000 lines", () => {
  const st = stats(diffLines("A\nB\nC\nA\nB\nB\nA", "C\nB\nA\nB\nA\nC").ops);
  assert.equal(st.add + st.del, 5);
  assert.ok(diffLines("a  b\nX", "a b\nx", { ignoreWs: true, ignoreCase: true }).ops.every((o) => o.t === "="));
  assert.ok(charDiff("hello world", "hello there world").right.some((x) => x.t === "+" && x.s.includes("there")));
  const big = Array.from({ length: 5000 }, (_, i) => "line " + i);
  const big2 = big.slice();
  big2[100] = "changed"; big2.splice(2500, 3); big2.splice(4000, 0, "ins1", "ins2");
  const t0 = Date.now();
  const bs = stats(diffLines(big.join("\n"), big2.join("\n")).ops);
  assert.deepEqual([bs.add, bs.del], [3, 4]);
  assert.ok(Date.now() - t0 < 2000);
});

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} d${d.getDay()}`;
const from = new Date(2026, 9, 12, 19, 53, 20); // Monday 12 Oct 2026, local time

test("cron next runs: ranges, steps, names, OR rule, seconds, macros", () => {
  assert.deepEqual(nextRuns(parseCron("*/15 9-17 * * MON-FRI"), from, 2).map(fmt), ["2026-10-13 09:00:00 d2", "2026-10-13 09:15:00 d2"]);
  assert.equal(nextRuns(parseCron("*/15 9-17 * * MON-FRI"), new Date(2026, 9, 16, 17, 50), 1).map(fmt)[0], "2026-10-19 09:00:00 d1");
  assert.deepEqual(nextRuns(parseCron("0 0 1 * *"), from, 3).map(fmt), ["2026-11-01 00:00:00 d0", "2026-12-01 00:00:00 d2", "2027-01-01 00:00:00 d5"]);
  assert.deepEqual(nextRuns(parseCron("0 12 13 * 5"), from, 4).map(fmt),
    ["2026-10-13 12:00:00 d2", "2026-10-16 12:00:00 d5", "2026-10-23 12:00:00 d5", "2026-10-30 12:00:00 d5"]);
  assert.ok(nextRuns(parseCron("0 12 */2 * 5"), from, 3).map(fmt).every((x) => x.endsWith("d5") && Number(x.slice(8, 10)) % 2 === 1));
  assert.deepEqual(nextRuns(parseCron("30 */10 * * * *"), from, 2).map(fmt), ["2026-10-12 20:00:30 d1", "2026-10-12 20:10:30 d1"]);
  assert.equal(nextRuns(parseCron("@weekly"), from, 1).map(fmt)[0], "2026-10-18 00:00:00 d0");
  assert.ok(parseCron("@reboot").reboot);
  assert.equal(nextRuns(parseCron("0 0 30 2 *"), from, 1).length, 0);
  assert.equal(nextRuns(parseCron("0 0 29 2 *"), from, 1).map(fmt)[0], "2028-02-29 00:00:00 d2");
  assert.ok(parseCron("0 0 * * 7").sets.dow.has(0));
});

test("cron rejects invalid expressions", () => {
  for (const bad of ["* * * *", "60 * * * *", "* * 0 * *", "* * * 13 *", "5-1 * * * *", "*/0 * * * *", "* * L * *", "@foo", "a b c d e", "1,,2 * * * *"]) {
    assert.throws(() => parseCron(bad), undefined, bad);
  }
});
