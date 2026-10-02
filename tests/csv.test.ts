import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { cleanCsv, decodeCsv, detectIssues, exportCsv, NO_FIXES, parseCsv } from "../src/lib/csv";

const fixturePath = resolve("tests/fixtures/mixed.csv");
const originalBytes = readFileSync(fixturePath);
const mixed = () => parseCsv(originalBytes.toString("utf8"));

test("parse quoted values, Arabic, physical blank lines, and the final newline", () => {
  const data = mixed();
  assert.deepEqual(data.columns, ["name", "city", "amount", "note"]);
  assert.equal(data.rows.length, 10);
  assert.deepEqual(data.rows[4], ["", "", "", ""]);
  assert.equal(data.rows[6][3], 'قال "مرحبا", ثم عاد');
  assert.equal(data.rows[9][0], "   ");
});

test("all five original issue counts are exact", () => {
  assert.deepEqual(detectIssues(mixed()), { duplicates: 2, emptyRows: 3, whitespace: 5, missing: 14, placeholders: 7 });
});

test("no selected fixes preserves every value and creates an independent copy", () => {
  const data = mixed();
  const copy = cleanCsv(data, NO_FIXES);
  assert.deepEqual(copy, data);
  assert.notEqual(copy.columns, data.columns);
  assert.notEqual(copy.rows[0], data.rows[0]);
});

test("duplicate removal alone keeps first occurrences and leaves other issues intact", () => {
  const rows = cleanCsv(mixed(), { ...NO_FIXES, duplicates: true }).rows;
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[1], [" Alice ", " جدة ", " 20 ", " N/A "]);
  assert.equal(detectIssues({ columns: mixed().columns, rows }).emptyRows, 2);
});

test("empty-row removal alone preserves duplicates and placeholders", () => {
  const result = cleanCsv(mixed(), { ...NO_FIXES, emptyRows: true });
  assert.equal(result.rows.length, 7);
  assert.deepEqual(result.rows[0], result.rows[1]);
  assert.equal(result.rows[2][3], " N/A ");
});

test("trimming alone does not normalize placeholders, fill blanks, or remove rows", () => {
  const result = cleanCsv(mixed(), { ...NO_FIXES, whitespace: true });
  assert.equal(result.rows.length, 10);
  assert.deepEqual(result.rows[2], ["Alice", "جدة", "20", "N/A"]);
  assert.equal(result.rows[5][1], "");
});

test("placeholder normalization alone preserves ordinary whitespace and missing values", () => {
  const result = cleanCsv(mixed(), { ...NO_FIXES, placeholders: true });
  assert.equal(result.rows.length, 10);
  assert.deepEqual(result.rows[2], [" Alice ", " جدة ", " 20 ", ""]);
  assert.deepEqual(result.rows[8], ["Zed", "", "", ""]);
  assert.equal(result.rows[5][1], "");
});

test("all fixes give the expected six rows without mutating source or original file", () => {
  const data = mixed();
  const snapshot = structuredClone(data);
  const result = cleanCsv(data, { duplicates: true, emptyRows: true, whitespace: true, placeholders: true });
  assert.deepEqual(result.rows, [
    ["Alice", "Riyadh", "10", "ok"], ["Alice", "جدة", "20", ""],
    ["Bob", "", "30", ""], ["سارة", "الرياض", "40", 'قال "مرحبا", ثم عاد'],
    ["سارة", "", "", ""], ["Zed", "", "", ""],
  ]);
  assert.deepEqual(data, snapshot);
  assert.deepEqual(readFileSync(fixturePath), originalBytes);
});

test("row removal compares originals, not rows made equal or empty by cleaning", () => {
  const data = parseCsv("name,value\nx, value\nx,value\nNA,null\n");
  const result = cleanCsv(data, { duplicates: true, emptyRows: true, whitespace: true, placeholders: true });
  assert.deepEqual(result.rows, [["x", "value"], ["x", "value"], ["", ""]]);
});

test("UTF-8 BOM export round-trips Arabic, commas, quotes, newlines, and exact text", () => {
  const data = parseCsv(readFileSync(resolve("tests/fixtures/edge-cases.csv"), "utf8"));
  const output = exportCsv(cleanCsv(data, NO_FIXES));
  assert.deepEqual([...Buffer.from(output).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.deepEqual(parseCsv(output), data);
  assert.equal(data.rows[0][0], "001");
  assert.equal(data.rows[0][2], "0007");
  assert.equal(data.rows[2][1], "line one\nline two");
  assert.equal(data.rows[4][1], "=1+2");
  assert.equal(data.rows[5][2], "false");
  assert.ok(output.includes("العربية"));
});

test("blank rows survive export when their removal is unselected", () => {
  assert.deepEqual(parseCsv(exportCsv(mixed())), mixed());
});

test("headers and column order are preserved, including duplicate names", () => {
  const data = parseCsv(" code ,code,العنوان\n001,002,جدة\n");
  const result = cleanCsv(data, { ...NO_FIXES, whitespace: true });
  assert.deepEqual(result.columns, [" code ", "code", "العنوان"]);
  assert.deepEqual(parseCsv(exportCsv(result)), result);
});

test("single-column, header-only, BOM, CRLF, and real trailing blank rows work", () => {
  assert.deepEqual(parseCsv("\uFEFFname\r\nAlice\r\n\r\n").rows, [["Alice"], [""]]);
  assert.deepEqual(parseCsv("name\n").rows, []);
  assert.deepEqual(parseCsv("name\nAlice").rows, [["Alice"]]);
});

test("malformed quoting, uneven non-empty records, blank headers and bad encodings fail clearly", () => {
  assert.throws(() => parseCsv(readFileSync(resolve("tests/fixtures/malformed.csv"), "utf8")), /Invalid CSV/);
  assert.throws(() => parseCsv("a,b\none,two,three\n"), /expected 2/);
  assert.throws(() => parseCsv("a,b\none\n"), /expected 2/);
  assert.throws(() => parseCsv("a,\n1,2\n"), /non-empty name/);
  assert.throws(() => parseCsv("\n"), /empty/);
  assert.throws(() => decodeCsv(Uint8Array.from([0xff, 0xfe]).buffer), /not UTF-8/);
  assert.throws(() => parseCsv("a\0,b\n1,2"), /encoding/);
});

test("placeholder matching is case-insensitive, exact and restricted to the specified list", () => {
  const data = parseCsv("a,b,c\n n/A ,NULL, na \nnullable,N/Aextra,0\n");
  assert.deepEqual(detectIssues(data), { duplicates: 0, emptyRows: 0, whitespace: 2, missing: 0, placeholders: 3 });
  assert.deepEqual(cleanCsv(data, { ...NO_FIXES, placeholders: true }).rows, [["", "", ""], ["nullable", "N/Aextra", "0"]]);
});
