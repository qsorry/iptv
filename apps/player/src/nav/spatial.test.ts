import { test } from "node:test";
import assert from "node:assert/strict";
import { pickNext, type Box } from "./spatial";

const box = (left: number, top: number, w = 100, h = 100): Box => ({ left, top, right: left + w, bottom: top + h });

test("النزول في شبكة يبقى في نفس العمود", () => {
  const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 120), box(120, 120), box(240, 120)];
  const from = grid[1];
  const others = grid.filter((b) => b !== from);
  assert.equal(others[pickNext(from, others, "down")], grid[4]);
  assert.equal(others[pickNext(from, others, "right")], grid[2]);
  assert.equal(others[pickNext(from, others, "left")], grid[0]);
  assert.equal(pickNext(from, others, "up"), -1);
});

test("من زر عريض إلى صف: الصف الأقرب ثم العنصر تحت منتصفه", () => {
  const hero = box(0, 0, 400, 60);
  const row = [box(0, 100), box(150, 100), box(300, 100), box(150, 300)];
  assert.equal(pickNext(hero, row, "down"), 1);
});

test("القائمة الجانبية على اليمين (RTL): السهم الأيمن من المحتوى يصلها", () => {
  const content = box(100, 200);
  const rail = [box(1180, 0, 96, 60), box(1180, 200, 96, 60), box(1180, 400, 96, 60)];
  assert.equal(pickNext(content, rail, "right"), 1);
});
