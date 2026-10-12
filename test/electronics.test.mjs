// Resistor value parsing, E-series rounding and colour bands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { JS } from "./helpers.mjs";

// resistor.js mixes data, helpers and DOM wiring; evaluate only the pure sections.
const src = readFileSync(path.join(JS, "resistor.js"), "utf8").replace(/\r\n/g, "\n");
const cut = (start, end) => { const a = src.indexOf(start); assert.ok(a >= 0, start); return src.slice(a, src.indexOf(end, a)); };
const f = new Function([
  cut("const COLORS =", "// ---------- helpers"),
  cut("function fmtOhm", "// ---------- band -> value"),
  cut("function bandsFor", "const chips"),
].join("\n").replace(/export /g, "") + "\nreturn { parseOhm, nearest, nextUp, bandsFor, E12, E24, E96 };")();

const close = (got, want, msg) => assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)), `${msg}: ${got} != ${want}`);

test("parse resistor notation", () => {
  for (const [s, v] of [["4.7k", 4700], ["4k7", 4700], ["0R47", 0.47], ["220", 220], ["1M", 1e6], ["2.2meg", 2.2e6], ["10 ohm", 10]]) close(f.parseOhm(s), v, s);
});

test("nearest standard values and rounding up for LED resistors", () => {
  close(f.nearest(4700, f.E12), 4700, "E12 4700");
  close(f.nearest(5000, f.E12), 4700, "E12 5000");
  close(f.nearest(5000, f.E24), 5100, "E24 5000");
  close(f.nearest(4700, f.E96), 4750, "E96 4700");
  close(f.nearest(0.5, f.E12), 0.47, "E12 0.5");
  close(f.nextUp(300, f.E12), 330, "up E12 300");
  close(f.nextUp(300, f.E24), 300, "up E24 300");
  close(f.nextUp(82.1, f.E12), 100, "up E12 82.1");
  assert.deepEqual([f.E12.length, f.E24.length, f.E96.length], [12, 24, 96]);
});

test("colour bands", () => {
  assert.equal(f.bandsFor(4700, 2).cols.map((c) => c.k).join(), "yellow,violet,red");
  assert.equal(f.bandsFor(0.47, 2).cols.map((c) => c.k).join(), "yellow,violet,silver");
  assert.equal(f.bandsFor(10e3, 3).cols.map((c) => c.k).join(), "brown,black,black,red");
});
