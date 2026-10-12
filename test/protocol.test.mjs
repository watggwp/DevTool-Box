// Modbus, Float / IEEE 754, Struct parser and Serial Plotter line parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importJs } from "./helpers.mjs";

const mb = await importJs("modbus-core.js");
const fl = await importJs("float-core.js");
const st = await importJs("struct-core.js");
const pl = await importJs("plotter-core.js");

test("Modbus CRC16 and request builder", () => {
  assert.equal(mb.toHex(mb.withCrc(mb.parseHex("01 03 00 00 00 0A"))), "01 03 00 00 00 0A C5 CD");
  assert.equal(mb.toHex(mb.withCrc(mb.parseHex("01 03 00 00 00 02"))), "01 03 00 00 00 02 C4 0B");
  assert.equal(mb.toHex(mb.buildRequest({ slave: 1, fc: 3, addr: 0, qty: 10 })), "01 03 00 00 00 0A C5 CD");
  assert.ok(mb.toHex(mb.buildRequest({ slave: 1, fc: 5, addr: 0xac, values: true })).startsWith("01 05 00 AC FF 00"));
  assert.ok(mb.toHex(mb.buildRequest({ slave: 17, fc: 6, addr: 1, values: 3 })).startsWith("11 06 00 01 00 03"));
  assert.ok(mb.toHex(mb.buildRequest({ slave: 17, fc: 15, addr: 19, values: [1, 0, 1, 1, 0, 0, 1, 1, 1, 0] })).startsWith("11 0F 00 13 00 0A 02 CD 01"));
  assert.ok(mb.toHex(mb.buildRequest({ slave: 17, fc: 16, addr: 1, values: [0x000a, 0x0102] })).startsWith("11 10 00 01 00 02 04 00 0A 01 02"));
});

test("Modbus decoder: request, response, exception, bad CRC, coils, 32-bit pairs", () => {
  let d = mb.decodeFrame(mb.parseHex("01 03 00 00 00 0A C5 CD"));
  assert.deepEqual([d.kind, d.crcOk], ["request", true]);
  d = mb.decodeFrame(mb.withCrc(mb.parseHex("01 03 04 3F 80 00 00")));
  assert.deepEqual([d.kind, d.crcOk, d.registers], ["response", true, [0x3f80, 0]]);
  assert.equal(mb.pairRegisters(d.registers, "ABCD")[0].f32, 1);
  assert.equal(mb.pairRegisters([0x0000, 0x3f80], "CDAB")[0].f32, 1);
  d = mb.decodeFrame(mb.withCrc(mb.parseHex("01 83 02")));
  assert.deepEqual([d.kind, d.exception.code], ["exception", 2]);
  assert.equal(mb.decodeFrame(mb.parseHex("01 03 00 00 00 0A C5 CC")).crcOk, false);
  assert.deepEqual(mb.decodeFrame(mb.withCrc(mb.parseHex("01 01 01 05"))).bits.slice(0, 4), [1, 0, 1, 0]);
});

test("Modbus serial helpers: expected length, completion, silence time", () => {
  const read10 = mb.parseHex("01 03 00 00 00 0A");
  assert.equal(mb.expectedResponseLength(read10), 25);
  assert.equal(mb.expectedResponseLength(mb.parseHex("01 01 00 00 00 0A")), 7);
  assert.equal(mb.expectedResponseLength(mb.parseHex("01 06 00 01 00 03")), 8);
  assert.equal(mb.responseComplete(read10, new Array(24).fill(0)), false);
  assert.equal(mb.responseComplete(read10, new Array(25).fill(0)), true);
  assert.equal(mb.responseComplete(read10, [1, 0x83, 2, 0]), false);
  assert.equal(mb.responseComplete(read10, [1, 0x83, 2, 0, 0]), true);
  assert.equal(mb.t35ms(9600).toFixed(2), "4.01");
  assert.equal(mb.t35ms(115200), 1.75);
});

test("Float / IEEE 754 conversions and byte orders", () => {
  assert.equal(fl.toHex(fl.toBytesBE(1, 32), ""), "3F800000");
  assert.equal(fl.toHex(fl.toBytesBE(-2.5, 32), ""), "C0200000");
  assert.equal(fl.toHex(fl.toBytesBE(1, 64), ""), "3FF0000000000000");
  const be = fl.toBytesBE(1, 32);
  assert.equal(fl.toHex(fl.toOrder(be, "DCBA"), ""), "0000803F");
  assert.equal(fl.toHex(fl.toOrder(be, "CDAB"), ""), "00003F80");
  assert.equal(fl.toHex(fl.toOrder(be, "BADC"), ""), "803F0000");
  for (const o of ["ABCD", "DCBA", "CDAB", "BADC"]) assert.equal(fl.fromBytesBE(fl.fromOrder(fl.toOrder(be, o), o)), 1, o);
  assert.equal(fl.fromBytesBE(fl.fromOrder(fl.toOrder(fl.toBytesBE(Math.PI, 64), "LE"), "LE")), Math.PI);
  assert.equal(fl.fields(fl.parseHex("7FC00000")).cls, "nan");
  assert.equal(fl.fields(fl.parseHex("7F800000")).cls, "infinity");
  assert.equal(fl.fields(fl.parseHex("00000001")).cls, "subnormal");
  assert.equal(fl.fields(fl.parseHex("80000000")).cls, "zero");
  assert.equal(fl.registersToFloat(0x41c8, 0x0000, "ABCD").f32, 25);
  assert.equal(fl.registersToFloat(0x0000, 0x41c8, "CDAB").f32, 25);
  assert.equal(fl.formatFloat(fl.fromBytesBE(fl.toBytesBE(0.1, 32)), 32), "0.100000001");
});

test("Struct parser: types, arrays, endian override, leftovers, errors", () => {
  let r = st.parseStruct(st.parseHex("AA 55 01 0A CD CC 0C 42 00 00 70 42 E8 03 00 00 4F 4B"),
    st.parseSpec("header:u16be id:u8 flags:u8 temp:f32 hum:f32 uptime:u32 status:str2"), "le");
  assert.deepEqual(r.rows.map((x) => x.value), [0xaa55, 1, 10, 35.2, 60, 1000, "OK"]);
  assert.deepEqual([r.used, r.leftover.length, r.error], [18, 0, null]);
  r = st.parseStruct(st.parseHex("01 00 02 00 03 00 04 00 DE AD 00 00 FF 99"), st.parseSpec("u16[4] hex2 skip2 i8"), "le");
  assert.deepEqual(r.rows.map((x) => st.formatValue(x.value)), ["[1, 2, 3, 4]", "DE AD", "(ข้าม)", "-1"]);
  assert.equal(st.toHex(r.leftover), "99");
  r = st.parseStruct(st.parseHex("01 02"), st.parseSpec("u32"), "le");
  assert.equal(r.rows.length, 0);
  assert.ok(r.error);
  assert.throws(() => st.parseSpec("u24"));
  assert.equal(st.formatValue(st.parseStruct(st.parseHex("FF FF FF FF FF FF FF FF"), st.parseSpec("i64"), "le").rows[0].value), "-1");
});

test("Serial Plotter line parser", () => {
  assert.deepEqual(pl.parseLine("1.2 3.4\t5"), { values: [{ label: null, value: 1.2 }, { label: null, value: 3.4 }, { label: null, value: 5 }] });
  assert.deepEqual(pl.parseLine("temp:25.3,hum:60"), { values: [{ label: "temp", value: 25.3 }, { label: "hum", value: 60 }] });
  assert.deepEqual(pl.parseLine("temp: 25.3 hum: 60"), { values: [{ label: "temp", value: 25.3 }, { label: "hum", value: 60 }] });
  assert.deepEqual(pl.parseLine("temp hum"), { header: ["temp", "hum"] });
  assert.equal(pl.parseLine("   "), null);
  assert.deepEqual([pl.niceStep(10), pl.niceStep(0.7), pl.niceStep(230)], [2, 0.1, 50]);
});
