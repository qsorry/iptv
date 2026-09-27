import { test } from "node:test";
import assert from "node:assert/strict";
import { streamKind } from "./engine";

test("اختيار طريقة التشغيل من الرابط", () => {
  assert.equal(streamKind("http://h:8080/live/u/p/1.m3u8", true), "hls");
  assert.equal(streamKind("http://h/get.php?id=1&output=m3u8", true), "hls");
  assert.equal(streamKind("http://h:8080/live/u/p/1.ts", true), "ts");
  assert.equal(streamKind("http://h:8080/movie/u/p/7.mp4"), "file");
  // M3U من لوحات Xtream: البث المباشر بلا امتداد هو MPEG-TS.
  assert.equal(streamKind("http://h:8080/u/p/12345", true), "ts");
  assert.equal(streamKind("http://h:8080/u/p/12345?token=a.b", true), "ts");
  assert.equal(streamKind("http://h:8080/u/p/12345"), "file");
  assert.equal(streamKind("http://h/stream.mp4", true), "file");
  assert.equal(streamKind("http://h/play.php?id=1", true), "file");
});
