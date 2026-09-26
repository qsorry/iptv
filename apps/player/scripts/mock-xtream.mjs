/**
 * خادم Xtream Codes وهمي للتطوير والاختبار فقط (لا يُشحن مع التطبيق).
 * بيانات تجريبية بالعربية، ودليل برامج حول الوقت الحالي، وروابط البث تُحوَّل إلى بث HLS تجريبي عام.
 *
 *   node scripts/mock-xtream.mjs            → http://localhost:8090 (مستخدم: 394218775 / كلمة المرور: demo-pass)
 *   PORT=8091 TEST_STREAM=https://…m3u8 node scripts/mock-xtream.mjs
 */
import http from "node:http";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 8090);
const TEST_STREAM = process.env.TEST_STREAM || "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
/** ملف فيديو محلي (webm) يُقدَّم للأفلام والحلقات مع دعم Range للتقديم والتأخير. */
const TEST_FILE = process.env.TEST_FILE;
const FILE_EXT = TEST_FILE ? "webm" : "mp4";
const USERS = { "394218775": "demo-pass", demo: "demo" };
const TONES = ["#2B3446", "#3A2E3F", "#233A38", "#4A3A28", "#23303F", "#3F2A2A", "#3A3524", "#2E3A2A", "#35283F", "#28353F"];

const liveCats = [
  { category_id: "1", category_name: "رياضة", parent_id: 0 },
  { category_id: "2", category_name: "أخبار", parent_id: 0 },
  { category_id: "3", category_name: "أفلام", parent_id: 0 },
  { category_id: "4", category_name: "أطفال", parent_id: 0 },
  { category_id: "5", category_name: "وثائقي", parent_id: 0 },
];
const channelNames = {
  1: ["رياضة 1 HD", "رياضة 2 HD", "رياضة 3", "رياضة 4", "رياضة 5", "رياضة 6 FHD"],
  2: ["أخبار 24", "الأخبار العاجلة", "اقتصاد اليوم"],
  3: ["أفلام HD", "سينما العائلة", "أفلام كلاسيك"],
  4: ["أطفال", "كرتون زمان"],
  5: ["وثائقي البحار", "عالم الحيوان"],
};
let num = 100;
const live = Object.entries(channelNames).flatMap(([cat, names]) =>
  names.map((name) => {
    num++;
    return { num, name, stream_type: "live", stream_id: num, stream_icon: "", epg_channel_id: `ch${num}`, added: String(1700000000 + num), category_id: cat, tv_archive: 0 };
  }),
);

const vodCats = [
  { category_id: "11", category_name: "دراما" },
  { category_id: "12", category_name: "أكشن" },
  { category_id: "13", category_name: "كوميديا" },
  { category_id: "14", category_name: "عائلي" },
];
const movieTitles = ["ظلال المدينة", "رحلة الصحراء", "آخر الليل", "بيت الجدّة", "الميناء", "رسالة قديمة", "العاصفة", "حكاية حارة", "الطريق الطويل", "نجمة الشمال", "المدينة الساحلية", "سرّ القلعة"];
const vod = movieTitles.map((name, i) => ({
  num: i + 1,
  name,
  stream_type: "movie",
  stream_id: 5000 + i,
  stream_icon: `http://localhost:${PORT}/img/m${i}.svg`,
  rating: (6.4 + ((i * 7) % 25) / 10).toFixed(1),
  added: String(Math.floor(Date.now() / 1000) - i * 86400),
  category_id: vodCats[i % vodCats.length].category_id,
  container_extension: FILE_EXT,
  releasedate: `${2020 + (i % 6)}-0${1 + (i % 8)}-10`,
}));

const seriesCats = [
  { category_id: "21", category_name: "مسلسلات عربية 2026" },
  { category_id: "22", category_name: "دراما خليجية" },
  { category_id: "23", category_name: "كوميديا" },
];
const seriesTitles = ["بيت على البحر", "ظلال المدينة", "رحلة الصحراء", "آخر الليل", "حكاية حارة", "الطريق الطويل"];
const series = seriesTitles.map((name, i) => ({
  num: i + 1,
  name,
  series_id: 700 + i,
  cover: `http://localhost:${PORT}/img/s${i}.svg`,
  plot: "قصة عائلة تعود إلى بيتها القديم على البحر، فتنكشف أسرار أجيال سابقة.",
  genre: i % 2 ? "دراما عائلية" : "دراما",
  releaseDate: `${2022 + (i % 4)}-01-01`,
  rating: (7.2 + i / 10).toFixed(1),
  last_modified: String(Math.floor(Date.now() / 1000) - i * 3600 * 20),
  category_id: seriesCats[i % seriesCats.length].category_id,
}));

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const PROGRAMS = ["ما قبل المباراة", "مباراة الأسبوع — مباشر", "الاستوديو التحليلي", "نشرة المساء", "حوار اليوم", "موجز الأخبار", "فيلم السهرة", "فيلم منتصف الليل", "مغامرات الفضاء", "حكايات قبل النوم"];

function epgFor(streamId, limit) {
  const slot = 30 * 60;
  const nowSec = Math.floor(Date.now() / 1000);
  let t = Math.floor(nowSec / slot) * slot - slot;
  const out = [];
  for (let i = 0; i < limit; i++) {
    const len = slot * (1 + ((streamId + i) % 3));
    out.push({
      id: String(i),
      epg_id: String(streamId),
      title: b64(PROGRAMS[(streamId + i) % PROGRAMS.length]),
      description: b64("وصف البرنامج من دليل المزوّد."),
      start_timestamp: String(t),
      stop_timestamp: String(t + len),
    });
    t += len;
  }
  return { epg_listings: out };
}

function seriesInfo(id) {
  const s = series.find((x) => x.series_id === Number(id));
  if (!s) return {};
  const seasons = 2 + (s.series_id % 2);
  const episodes = {};
  for (let season = 1; season <= seasons; season++) {
    episodes[String(season)] = Array.from({ length: 8 + season }, (_, i) => ({
      id: String(s.series_id * 1000 + season * 100 + i + 1),
      episode_num: i + 1,
      title: `${s.name} - S0${season}E${String(i + 1).padStart(2, "0")} - ${PROGRAMS[(i + season) % PROGRAMS.length]}`,
      container_extension: FILE_EXT,
      season,
      info: { duration_secs: 2700 + (i % 4) * 120, plot: "ملخص الحلقة.", movie_image: "" },
    }));
  }
  return {
    seasons: Array.from({ length: seasons }, (_, i) => ({ season_number: i + 1, name: `Season ${i + 1}` })),
    info: { name: s.name, cover: s.cover, plot: s.plot, genre: s.genre, rating: s.rating, cast: "ممثل أول، ممثلة ثانية", backdrop_path: [] },
    episodes,
  };
}

function poster(id) {
  const kind = id[0];
  const i = Number(id.slice(1));
  const title = (kind === "m" ? movieTitles : seriesTitles)[i] ?? "";
  const tone = TONES[(i * 3 + (kind === "s" ? 5 : 0)) % TONES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone}"/><stop offset="1" stop-color="#0E1014"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><circle cx="300" cy="170" r="110" fill="#F3F1EC" fill-opacity="0.08"/><text x="200" y="330" font-family="sans-serif" font-size="44" font-weight="700" fill="#F3F1EC" text-anchor="middle" direction="rtl">${title}</text></svg>`;
}

function sendFile(req, res, file) {
  const size = fs.statSync(file).size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  const headers = { "Content-Type": "video/webm", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" };
  if (!range) {
    res.writeHead(200, { ...headers, "Content-Length": size });
    return fs.createReadStream(file).pipe(res);
  }
  const start = range[1] ? Number(range[1]) : 0;
  const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
  fs.createReadStream(file, { start, end }).pipe(res);
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") return send(res, 204, "");

  const img = url.pathname.match(/^\/img\/([ms]\d+)\.svg$/);
  if (img) return send(res, 200, poster(img[1]), "image/svg+xml");

  // روابط البث: /live|movie|series/<user>/<pass>/<id>.<ext> → بث تجريبي.
  const stream = url.pathname.match(/^\/(live|movie|series)\/([^/]+)\/([^/]+)\/(\d+)\.(\w+)$/);
  if (stream) {
    const [, kind, u, p] = stream;
    if (USERS[decodeURIComponent(u)] !== decodeURIComponent(p)) return send(res, 403, "forbidden", "text/plain");
    if (TEST_FILE && kind !== "live") return sendFile(req, res, TEST_FILE);
    res.writeHead(302, { Location: TEST_STREAM, "Access-Control-Allow-Origin": "*" });
    return res.end();
  }

  if (url.pathname === "/player_api.php") {
    const u = url.searchParams.get("username") ?? "";
    const p = url.searchParams.get("password") ?? "";
    if (USERS[u] !== p) return send(res, 200, { user_info: { auth: 0 } });
    const action = url.searchParams.get("action");
    switch (action) {
      case null:
        return send(res, 200, {
          user_info: { username: u, password: p, auth: 1, status: "Active", exp_date: String(Math.floor(Date.now() / 1000) + 180 * 86400), is_trial: "0", active_cons: "0", max_connections: "2", allowed_output_formats: ["m3u8", "ts"] },
          server_info: { url: "localhost", port: String(PORT), server_protocol: "http", timezone: "Asia/Riyadh", timestamp_now: Math.floor(Date.now() / 1000) },
        });
      case "get_live_categories":
        return send(res, 200, liveCats);
      case "get_live_streams":
        return send(res, 200, live);
      case "get_vod_categories":
        return send(res, 200, vodCats);
      case "get_vod_streams":
        return send(res, 200, vod);
      case "get_series_categories":
        return send(res, 200, seriesCats);
      case "get_series":
        return send(res, 200, series);
      case "get_series_info":
        return send(res, 200, seriesInfo(url.searchParams.get("series_id")));
      case "get_vod_info": {
        const m = vod.find((x) => x.stream_id === Number(url.searchParams.get("vod_id")));
        return send(res, 200, m ? { info: { plot: "رجل يعود إلى مدينته بعد غياب طويل ليكتشف أنها تغيّرت أكثر مما توقّع.", genre: "دراما", cast: "ممثل أول، ممثلة ثانية", director: "مخرج العمل", duration_secs: 7500, rating: m.rating, releasedate: m.releasedate }, movie_data: m } : {});
      }
      case "get_short_epg":
        return send(res, 200, epgFor(Number(url.searchParams.get("stream_id")), Number(url.searchParams.get("limit") || 4)));
      default:
        return send(res, 200, []);
    }
  }
  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`mock Xtream on http://localhost:${PORT} — user 394218775 / demo-pass`));
