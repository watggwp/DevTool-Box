// QR encoder compared module-for-module with matrices from qrcode@1.5.4 (stored as SHA-256 in fixtures).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { importJs, readText } from "./helpers.mjs";

const { encodeQR } = await importJs("qr-encoder.js");
const { cases } = JSON.parse(readText("test/fixtures/qr-reference.json"));
const enc = new TextEncoder();

test(`QR matrices match the reference library (${cases.length} cases, versions 1-40, ECC L/M/Q/H, all masks)`, () => {
  for (const c of cases) {
    const q = encodeQR(enc.encode(c.text), c.ecl, c.mask);
    const label = `${c.ecl} mask ${c.mask} v${c.version} "${c.text.slice(0, 16)}"`;
    assert.equal(q.version, c.version, label);
    assert.equal(q.size, c.size, label);
    const bits = q.modules.map((row) => row.map((m) => (m ? "1" : "0")).join("")).join("");
    assert.equal(createHash("sha256").update(bits).digest("hex"), c.sha256, label);
  }
});

test("QR picks a mask automatically and rejects data that is too long", () => {
  const q = encodeQR(enc.encode("auto mask"), "M");
  assert.ok(q.mask >= 0 && q.mask <= 7);
  assert.throws(() => encodeQR(new Uint8Array(3000), "H"));
});
