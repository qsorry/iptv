import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, classify, M3uSource, parseM3u } from "./m3u";

const SAMPLE = `﻿#EXTM3U url-tvg="http://epg.xml"
#EXTINF:-1 tvg-id="sp1" tvg-name="Sport 1" tvg-logo="http://logo/sp1.png" group-title="رياضة",رياضة 1, HD
http://h/live/u/p/1.ts
#EXTINF:-1 group-title="أفلام 2025",ظلال المدينة (2025)
http://h/movie/u/p/10.mkv
#EXTINF:-1 tvg-logo="http://p.jpg" group-title="مسلسلات",بيت على البحر S01 E02
http://h/series/u/p/100.mp4
#EXTINF:-1 group-title="مسلسلات",بيت على البحر S01E01 البداية
http://h/series/u/p/99.mp4
#EXTVLCOPT:http-user-agent=VLC
#EXTINF:-1,
#EXTGRP:عام
http://h/stream/abc
# تعليق
not-a-url
`;

test("parseM3u: السمات، الفاصلة داخل العنوان، EXTGRP، والأسطر غير الصالحة", () => {
  const e = parseM3u(SAMPLE);
  assert.equal(e.length, 5);
  assert.equal(e[0].name, "رياضة 1, HD");
  assert.equal(e[0].attrs["tvg-id"], "sp1");
  assert.equal(e[0].group, "رياضة");
  assert.equal(e[4].group, "عام");
  assert.equal(e[4].name, "abc");
});

test("classify من المسار والامتداد والاسم", () => {
  assert.equal(classify({ name: "x", url: "http://h/live/u/p/1.ts", attrs: {} }), "live");
  assert.equal(classify({ name: "x", url: "http://h/a/b.mp4", attrs: {} }), "movie");
  assert.equal(classify({ name: "Show S02E05", url: "http://h/a/b", attrs: {} }), "series");
});

test("buildCatalog يجمع حلقات المسلسل ويبني التصنيفات", async () => {
  const cat = buildCatalog(parseM3u(SAMPLE));
  assert.equal(cat.live.length, 2);
  assert.equal(cat.movies.length, 1);
  assert.equal(cat.movies[0].year, "2025");
  assert.equal(cat.series.length, 1);
  assert.equal(cat.series[0].name, "بيت على البحر");
  assert.deepEqual(cat.categories.live.map((c) => c.name), ["رياضة", "عام"]);

  const src = new M3uSource("http://list", async () => SAMPLE);
  const info = await src.seriesInfo(cat.series[0]);
  assert.deepEqual(info.seasons[0].episodes.map((e) => [e.episode, e.title]), [[1, "البداية"], [2, "الحلقة 2"]]);
  assert.equal(src.liveUrl(cat.live[0]), "http://h/live/u/p/1.ts");
});

test("M3uSource يرفض ما ليس قائمة", async () => {
  const src = new M3uSource("http://x", async () => "<html>login</html>");
  await assert.rejects(() => src.liveChannels(), /ليس قائمة/);
});
