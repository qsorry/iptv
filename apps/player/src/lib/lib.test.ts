import { test } from "node:test";
import assert from "node:assert/strict";
import { count, logoText, MINUTES, remaining, shortDuration, thousands, timecode, initial } from "./format";
import { continueWatching, isFinished, type HistoryEntry } from "./library";
import { normalizeServer, xtreamFromUrl } from "./accounts";
import { formatActivationInput, ACTIVATION_PATTERN } from "./platform-api";
import { nowNext, epgSlice } from "../catalog/epg";

test("العدد العربي", () => {
  assert.equal(count(1, MINUTES), "دقيقة");
  assert.equal(count(2, MINUTES), "دقيقتان");
  assert.equal(count(5, MINUTES), "5 دقائق");
  assert.equal(count(42, MINUTES), "42 دقيقة");
  assert.equal(count(103, MINUTES), "103 دقائق");
  assert.equal(remaining(600, 3120), "متبقٍّ 42 دقيقة");
});

test("تنسيق الوقت والمدة والأرقام", () => {
  assert.equal(timecode(3725), "1:02:05");
  assert.equal(timecode(65), "1:05");
  assert.equal(shortDuration(7500), "2س 5د");
  assert.equal(shortDuration(2880), "48د");
  assert.equal(thousands(10291), "10,291");
  assert.equal(logoText("رياضة 1 HD"), "ر1");
  assert.equal(logoText("أخبار 24"), "أ24");
  assert.equal(logoText("MBC Drama HD"), "MD");
  assert.equal(logoText("HD"), "TV");
  assert.equal(initial("  «ظلال»"), "ظ");
});

test("تابع المشاهدة: غير المنتهي، الأحدث، وحلقة واحدة لكل مسلسل", () => {
  const e = (key: string, position: number, duration: number, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
    key, kind: "movie", itemId: key, title: key, position, duration, updatedAt: 0, ...extra,
  });
  const list = continueWatching([
    e("episode:8", 600, 3000, { kind: "episode", seriesId: "s1" }),
    e("episode:7", 900, 3000, { kind: "episode", seriesId: "s1" }),
    e("movie:1", 10, 6000),
    e("movie:2", 5900, 6000),
    e("live:3", 100, 0, { kind: "live" }),
    e("movie:4", 1200, 6000),
  ]);
  assert.deepEqual(list.map((x) => x.key), ["episode:8", "movie:4"]);
  assert.ok(isFinished({ position: 2950, duration: 3000 }));
  assert.ok(isFinished({ position: 2890, duration: 3000 }), "آخر دقيقتين في حلقة طويلة");
  assert.ok(!isFinished({ position: 30, duration: 90 }), "مقطع قصير: فقط آخر 5%");
});

test("روابط الحسابات", () => {
  assert.deepEqual(xtreamFromUrl("http://h.tv:8080/get.php?username=u&password=p&type=m3u_plus"), { server: "http://h.tv:8080", username: "u", password: "p" });
  assert.equal(xtreamFromUrl("http://h.tv/list.m3u"), null);
  assert.equal(normalizeServer("h.tv:8080/"), "http://h.tv:8080");
  assert.equal(normalizeServer("ftp://x"), null);
});

test("تنسيق كود التفعيل أثناء الكتابة", () => {
  assert.equal(formatActivationInput("8h3k92pl"), "SN-8H3K-92PL");
  assert.equal(formatActivationInput("sn-8h3"), "SN-8H3");
  assert.equal(formatActivationInput("SN"), "SN");
  assert.equal(formatActivationInput("S"), "S");
  assert.equal(formatActivationInput("SN-8H3K-92PLXX"), "SN-8H3K-92PL");
  assert.ok(ACTIVATION_PATTERN.test(formatActivationInput("sn 8h3k 92pl")));
});

test("الدليل: الحالي والتالي والشريحة", () => {
  const H = 3600_000;
  const list = [{ title: "a", start: 0, end: H }, { title: "b", start: H, end: 2 * H }, { title: "c", start: 2 * H, end: 3 * H }];
  const nn = nowNext(list, 1.5 * H);
  assert.equal(nn.current?.title, "b");
  assert.equal(nn.next?.title, "c");
  assert.equal(nn.progress, 0.5);
  const slice = epgSlice(list, 0.5 * H, 2.5 * H, 1.5 * H);
  assert.deepEqual(slice.map((s) => [s.entry.title, s.span, s.live]), [["a", 0.25, false], ["b", 0.5, true], ["c", 0.25, false]]);
});
