import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEpisodeTitle, mapAccountStatus, mapLive, mapMovieInfo, mapMovies, mapSeries, mapSeriesInfo, mapShortEpg, statusProblem, XtreamSource, xtreamLogin } from "./xtream";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

test("mapLive يطبّع الأنواع ويستبعد العناصر بلا معرّف", () => {
  const list = mapLive([
    { num: "3", name: "رياضة 1 HD", stream_id: 101, stream_icon: "http://img/1.png", category_id: "5", epg_channel_id: "sport1", added: "1700000000" },
    { name: "بلا معرّف" },
    { stream_id: "102", name: "أخبار", stream_icon: "", category_ids: [7] },
  ]);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { kind: "live", id: "101", num: 3, name: "رياضة 1 HD", logo: "http://img/1.png", categoryId: "5", epgId: "sport1", added: 1700000000 });
  assert.equal(list[1].categoryId, "7");
  assert.equal(list[1].logo, undefined);
});

test("mapMovies: التقييم والسنة والامتداد", () => {
  const [m, n] = mapMovies([
    { stream_id: 9, name: "ظلال المدينة (2025)", rating: "8.1", container_extension: "mkv", category_id: "2" },
    { stream_id: 10, name: "فيلم", rating: "0", rating_5based: 3.5, releasedate: "2019-05-01" },
  ]);
  assert.equal(m.rating, 8.1);
  assert.equal(m.year, "2025");
  assert.equal(m.ext, "mkv");
  assert.equal(n.rating, 7);
  assert.equal(n.year, "2019");
});

test("mapSeriesInfo يقبل الحلقات ككائن بالمواسم أو كمصفوفة", () => {
  const series = mapSeries([{ series_id: 5, name: "بيت على البحر", cover: "http://c.jpg", category_id: "1" }])[0];
  const info = mapSeriesInfo(
    {
      info: { plot: "قصة", genre: "دراما", backdrop_path: ["http://b.jpg"] },
      episodes: {
        "2": [{ id: "22", episode_num: "2", season: 2, title: "بيت على البحر - S02E02 - العاصفة", container_extension: "mp4", info: { duration: "00:50:00" } }],
        "1": [
          { id: "12", episode_num: 2, season: 1, title: "الثانية", info: { duration_secs: 2880 } },
          { id: "11", episode_num: 1, season: 1, title: "", info: {} },
        ],
      },
    },
    series,
  );
  assert.deepEqual(info.seasons.map((s) => s.number), [1, 2]);
  assert.deepEqual(info.seasons[0].episodes.map((e) => e.id), ["11", "12"]);
  assert.equal(info.seasons[0].episodes[0].title, "الحلقة 1");
  assert.equal(info.seasons[1].episodes[0].title, "العاصفة");
  assert.equal(info.seasons[1].episodes[0].duration, 3000);
  assert.equal(info.backdrop, "http://b.jpg");
  const asArray = mapSeriesInfo({ episodes: [[{ id: "1", episode_num: 1, season: 1, title: "x" }]] }, series);
  assert.equal(asArray.seasons[0].episodes.length, 1);
  const flat = mapSeriesInfo({ episodes: [{ id: "1", episode_num: 1, season: 1 }, { id: "2", episode_num: 1, season: 2 }] }, series);
  assert.deepEqual(flat.seasons.map((x) => [x.number, x.episodes.length]), [[1, 1], [2, 1]], "مصفوفة حلقات مسطّحة");
});

test("cleanEpisodeTitle", () => {
  assert.equal(cleanEpisodeTitle("Show - S01E03 - Pilot", "Show"), "Pilot");
  assert.equal(cleanEpisodeTitle("S1 E2 عنوان", "x"), "عنوان");
});

test("mapShortEpg يفك base64 ويرتب ويستبعد الناقص", () => {
  const list = mapShortEpg({
    epg_listings: [
      { title: b64("الاستوديو التحليلي"), description: b64("وصف"), start_timestamp: "1700003600", stop_timestamp: "1700007200" },
      { title: b64("مباراة الأسبوع"), start_timestamp: 1700000000, stop_timestamp: 1700003600 },
      { title: b64("بلا وقت") },
    ],
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].title, "مباراة الأسبوع");
  assert.equal(list[0].start, 1700000000 * 1000);
  assert.equal(list[1].description, "وصف");
});

test("حالة الحساب: بيانات خاطئة، منتهٍ، فعّال", () => {
  assert.throws(() => mapAccountStatus({ user_info: { auth: 0 } }), /غير صحيحة/);
  assert.throws(() => mapAccountStatus([]), /غير صحيحة/);
  const s = mapAccountStatus({ user_info: { auth: 1, status: "Active", exp_date: "1700000000", max_connections: "2", allowed_output_formats: ["m3u8", "ts"] } });
  assert.equal(s.expiresAt, 1700000000000);
  assert.equal(s.maxConnections, 2);
  assert.match(statusProblem(s, 1800000000000) ?? "", /انتهى/);
  assert.equal(statusProblem({ ...s, expiresAt: null }), null);
  assert.match(statusProblem({ ...s, status: "Banned", expiresAt: null }) ?? "", /موقوف/);
});

test("xtreamLogin وروابط البث", async () => {
  const calls: string[] = [];
  const fetchJson = async <T,>(url: string) => {
    calls.push(url);
    if (url.includes("action=get_live_streams")) return [{ stream_id: 1, name: "a" }] as T;
    return { user_info: { auth: 1, status: "Active", exp_date: null } } as T;
  };
  const creds = { server: "http://h:8080", username: "u 1", password: "p/2" };
  const status = await xtreamLogin(creds, fetchJson);
  assert.equal(status.expiresAt, null);
  assert.match(calls[0], /^http:\/\/h:8080\/player_api\.php\?username=u\+1&password=p%2F2$/);

  const src = new XtreamSource(creds, fetchJson);
  await src.liveChannels();
  await src.liveChannels();
  assert.equal(calls.filter((c) => c.includes("get_live_streams")).length, 1, "القوائم تُحمّل مرة واحدة");
  assert.equal(src.liveUrl({ kind: "live", id: "7", num: 1, name: "x", categoryId: "1" }, "m3u8"), "http://h:8080/live/u%201/p%2F2/7.m3u8");
  assert.equal(src.episodeUrl({ id: "9", season: 1, episode: 1, title: "t", ext: "mkv" }), "http://h:8080/series/u%201/p%2F2/9.mkv");
});

test("mapMovieInfo", () => {
  assert.equal(mapMovieInfo({}), null);
  const info = mapMovieInfo({ info: { plot: "p", duration_secs: 7500, rating: "7.2", releasedate: "2021-01-01", backdrop_path: "http://x.jpg" } });
  assert.equal(info?.duration, 7500);
  assert.equal(info?.year, "2021");
  assert.equal(info?.backdrop, "http://x.jpg");
});
