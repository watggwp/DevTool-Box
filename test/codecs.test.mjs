// Base64 / hex helpers from common.js and the hashes from hash.js, checked against Node's crypto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { extract } from "./helpers.mjs";

const c = extract("common.js", ["bytesToHex", "hexToBytes", "bytesToBase64", "base64ToBytes"]);
const h = extract("hash.js", ["MD5_K", "MD5_S", "md5", "CRC_TABLE", "crc32", "crc16Modbus"], ["md5", "crc32", "crc16Modbus"]);
// hash.js uses bytesToHex from common.js
globalThis.bytesToHex = c.bytesToHex;

const enc = new TextEncoder();
const samples = ["", "a", "abc", "The quick brown fox jumps over the lazy dog", "สวัสดี \u{1F642}", "x".repeat(1000), "y".repeat(55), "z".repeat(56), "w".repeat(64)];

test("MD5 matches node:crypto", () => {
  for (const s of samples) {
    const b = enc.encode(s);
    assert.equal(h.md5(b), createHash("md5").update(b).digest("hex"), JSON.stringify(s.slice(0, 20)));
  }
});

test("Base64 and URL-safe Base64 round-trip and match Buffer", () => {
  for (const s of samples) {
    const b = enc.encode(s);
    assert.equal(c.bytesToBase64(b), Buffer.from(b).toString("base64"));
    assert.equal(c.bytesToBase64(b, true), Buffer.from(b).toString("base64url"));
    assert.deepEqual([...c.base64ToBytes(c.bytesToBase64(b))], [...b]);
    assert.deepEqual([...c.base64ToBytes(c.bytesToBase64(b, true))], [...b]);
  }
});

test("hex parse accepts 0x, \\x, spaces and round-trips", () => {
  assert.deepEqual([...c.hexToBytes("0x01 0xA0 \\xFF")], [1, 160, 255]);
  for (const s of samples) {
    const b = enc.encode(s);
    assert.deepEqual([...c.hexToBytes(c.bytesToHex(b))], [...b]);
  }
  assert.throws(() => c.hexToBytes("ABC"));
});

test("CRC32 and CRC16 Modbus check values", () => {
  const t = enc.encode("123456789");
  assert.equal(h.crc32(t), "CBF43926");
  assert.ok(h.crc16Modbus(t).startsWith("4B37"));
});
