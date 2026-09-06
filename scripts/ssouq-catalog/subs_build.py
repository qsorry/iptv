# -*- coding: utf-8 -*-
"""Build the digital-subscriptions preview. Usage: python3 subs_build.py [standalone|embed]
standalone -> subscriptions.html  (images: hosted URL on com.ssouq.net with CDN fallback)
embed      -> subscriptions-embed.html (images embedded as resized WebP data URIs, for the Artifact preview)"""
import json, subprocess, html, collections, datetime, sys, base64, io, os
MODE = sys.argv[1] if len(sys.argv) > 1 else 'standalone'
P = json.load(open('subscriptions.json', encoding='utf-8'))
REPO = '/home/user/iptv/'
HOST = 'https://com.ssouq.net/media/subscriptions/'

if MODE == 'embed':
    from PIL import Image
    cache = {}
    def data_uri(path, maxw=900):
        if path in cache: return cache[path]
        im = Image.open(REPO + path); im.thumbnail((maxw, maxw))
        if im.mode in ('RGBA', 'P', 'LA'): im = im.convert('RGBA')
        else: im = im.convert('RGB')
        buf = io.BytesIO(); im.save(buf, 'WEBP', quality=78, method=6)
        cache[path] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
        return cache[path]
    for p in P:
        for im in p['images'] + p['guide_images']: im['src'] = data_uri(im['path']); im['original'] = ''

used = sorted({i['icon'] for p in P for g in p['groups'] for i in g['items']} | {l['icon'] for p in P for l in p['links']})
UI = ['magnify','close','chevron-down','chevron-up','open-in-new','image-off-outline','tag-outline','check-circle-outline','sort','shape-outline',
      'format-list-bulleted','calendar-month-outline','devices','cash-multiple','star','cart-check','folder-image','link-variant','information-outline',
      'server-network','cloud-download-outline','table-large','view-grid-outline','television-classic','fire','chart-line','apple','android','microsoft-windows','monitor']
names = sorted(set(used) | set(UI))
js = "const m=require('@mdi/js');const out={};for(const n of %s){out[n]=m['mdi'+n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join('')]||null}console.log(JSON.stringify(out))" % json.dumps(names)
paths = json.loads(subprocess.check_output(['node', '-e', js], cwd='mdi'))
missing = [n for n, v in paths.items() if not v]; assert not missing, missing
sprite = ''.join('<symbol id="i-%s" viewBox="0 0 24 24"><path d="%s"/></symbol>' % (n, d) for n, d in paths.items())

fam = collections.Counter(p['family'] for p in P)
stats = {'total': len(P), 'in_stock': sum(p['in_stock'] for p in P), 'families': len(fam), 'sold': sum(p['sold'] or 0 for p in P),
         'images': len({im['path'] for p in P for im in p['images'] + p['guide_images']}), 'bullets': sum(p['bullet_count'] for p in P),
         'min_price': min(p['price'] for p in P if p['price']), 'max_price': max(p['price'] for p in P if p['price'])}
gen = datetime.date.today().isoformat()
data_json = json.dumps({'products': P, 'stats': stats, 'generated': gen, 'host': HOST, 'mode': MODE}, ensure_ascii=False).replace('</', '<\\/')

page = r'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>باقات سمارت سوق الرقمية</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<style>
:root{
  --ground:#f1f5f8; --surface:#ffffff; --surface-2:#e7eef3; --ink:#10212d; --muted:#5b6d7a; --line:#d3dde5; --line-strong:#b6c5d0;
  --accent:#004d73; --accent-ink:#ffffff; --accent-soft:#d9e8f0; --accent-text:#004d73; --glow:#0a7fb5;
  --good:#1b6e46; --good-soft:#dcefe3; --bad:#8a3b2a; --bad-soft:#f5e2dc; --warm:#a4530f; --warm-soft:#fbe9d6;
  --shadow:0 1px 2px rgba(16,33,45,.06),0 8px 24px -10px rgba(16,33,45,.22);
  --radius:12px; --font-display:"Readex Pro","IBM Plex Sans Arabic",system-ui,sans-serif; --font-body:"IBM Plex Sans Arabic","Readex Pro",system-ui,sans-serif;
  color-scheme:light;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --ground:#0c151c; --surface:#152129; --surface-2:#1d2c36; --ink:#e3ebf0; --muted:#95a7b3; --line:#293a46; --line-strong:#3a4f5d;
  --accent:#6fb8dc; --accent-ink:#0b1a23; --accent-soft:#16323f; --accent-text:#8ccbe9; --glow:#8ccbe9;
  --good:#7ed3a5; --good-soft:#173328; --bad:#f0a08c; --bad-soft:#3c221b; --warm:#f2b46a; --warm-soft:#3d2a13;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px -12px rgba(0,0,0,.7); color-scheme:dark;
}}
:root[data-theme="dark"]{
  --ground:#0c151c; --surface:#152129; --surface-2:#1d2c36; --ink:#e3ebf0; --muted:#95a7b3; --line:#293a46; --line-strong:#3a4f5d;
  --accent:#6fb8dc; --accent-ink:#0b1a23; --accent-soft:#16323f; --accent-text:#8ccbe9; --glow:#8ccbe9;
  --good:#7ed3a5; --good-soft:#173328; --bad:#f0a08c; --bad-soft:#3c221b; --warm:#f2b46a; --warm-soft:#3d2a13;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px -12px rgba(0,0,0,.7); color-scheme:dark;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.7;font-variant-numeric:tabular-nums}
h1,h2,h3{font-family:var(--font-display);font-weight:600;line-height:1.35;margin:0;text-wrap:balance}
a{color:var(--accent-text)} button{font:inherit;color:inherit}
svg.ic{width:1.15em;height:1.15em;fill:currentColor;flex:none;vertical-align:-.2em}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.top{position:sticky;top:0;z-index:20;background:var(--surface);border-bottom:1px solid var(--line);padding-top:env(safe-area-inset-top)}
.top-in{max-width:1360px;margin:0 auto;padding:10px 16px;display:grid;gap:10px}
.brandrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.logo{width:42px;height:42px;border-radius:10px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;flex:none}
.logo svg.ic{width:24px;height:24px}
.brandrow h1{font-size:18px} .brandrow .sub{color:var(--muted);font-size:13px}
.tag-preview{margin-inline-start:auto;font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--warm);background:var(--warm-soft);padding:3px 10px;border-radius:999px}
.controls{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:720px){.controls{grid-template-columns:minmax(220px,2fr) minmax(160px,1fr) minmax(160px,1fr) auto}}
.field{position:relative;display:flex;align-items:center}
.field svg.ic{position:absolute;inset-inline-start:10px;color:var(--muted);pointer-events:none}
.field input,.field select{width:100%;min-height:40px;font-size:16px;font-family:inherit;color:var(--ink);background:var(--ground);border:1px solid var(--line);border-radius:8px;padding:6px 36px 6px 12px;appearance:none;-webkit-appearance:none}
.field select{cursor:pointer}
.field input:focus,.field select:focus{border-color:var(--accent);outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--ground)}
.seg button{min-height:40px;padding:0 14px;border:0;background:transparent;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:500}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.chip{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:13px;font-weight:500}
.chip .n{font-size:12px;color:var(--muted);background:var(--surface-2);padding:0 7px;border-radius:999px;line-height:1.6}
.chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.chip[aria-pressed="true"] .n{background:rgba(255,255,255,.22);color:inherit}
.wrap{max-width:1360px;margin:0 auto;padding:16px}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
@media(min-width:640px){.stats{grid-template-columns:repeat(4,1fr)}} @media(min-width:1024px){.stats{grid-template-columns:repeat(7,1fr)}}
.stat{background:var(--surface);padding:12px 14px} .stat .v{font-family:var(--font-display);font-size:22px;font-weight:600;line-height:1.2} .stat .l{font-size:12px;color:var(--muted)}
.note{margin-top:14px;display:flex;gap:10px;align-items:flex-start;background:var(--accent-soft);color:var(--ink);border-radius:var(--radius);padding:12px 14px;font-size:13px}
.note svg.ic{color:var(--accent-text);margin-top:3px}
.note code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;background:var(--surface);padding:1px 6px;border-radius:5px;direction:ltr;unicode-bidi:embed}
.resultbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 10px;color:var(--muted);font-size:13px;flex-wrap:wrap} .resultbar b{color:var(--ink)}
/* compare table */
.tblwrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;min-width:900px;font-size:13.5px}
th,td{padding:10px 12px;text-align:start;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:middle}
th{font-size:12px;color:var(--muted);font-weight:600;background:var(--surface-2);position:sticky;top:0}
tr:last-child td{border-bottom:0}
td.name{white-space:normal;min-width:260px;font-weight:600} td.name small{display:block;font-weight:400;color:var(--muted);font-size:12px}
td .thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#fff;border:1px solid var(--line);vertical-align:middle;margin-inline-end:10px}
td.num{font-family:var(--font-display);font-weight:600}
tr.row{cursor:pointer} tr.row:hover td{background:var(--ground)}
/* cards */
.grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:720px){.grid{grid-template-columns:repeat(2,1fr)}} @media(min-width:1180px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);display:flex;flex-direction:column;overflow:hidden;min-width:0}
.media{position:relative;aspect-ratio:4/3;background:var(--surface-2);display:grid;place-items:center;cursor:zoom-in;overflow:hidden}
.media img{width:100%;height:100%;object-fit:contain;display:block;padding:8px}
.badges{position:absolute;top:10px;inset-inline-start:10px;display:flex;gap:6px;flex-wrap:wrap}
.pill{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;line-height:1.6;display:inline-flex;align-items:center;gap:4px}
.pill.good{background:var(--good-soft);color:var(--good)} .pill.bad{background:var(--bad-soft);color:var(--bad)} .pill.warm{background:var(--warm-soft);color:var(--warm)} .pill.fam{background:rgba(255,255,255,.9);color:#10212d}
.body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px;flex:1}
.card h3{font-size:16px;font-weight:600}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.fact{background:var(--ground);padding:8px 6px;text-align:center}
.fact .v{font-family:var(--font-display);font-weight:600;font-size:15px;line-height:1.3} .fact .l{font-size:11px;color:var(--muted)}
.pricerow{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.price{font-family:var(--font-display);font-size:24px;font-weight:700} .price small{font-size:12px;font-weight:500;color:var(--muted);margin-inline-start:3px}
.was{color:var(--muted);text-decoration:line-through;font-size:13px} .tax{font-size:12px;color:var(--muted)}
.plat{display:flex;gap:6px;flex-wrap:wrap} .plat span{font-size:12px;border:1px solid var(--line);border-radius:6px;padding:0 8px;background:var(--ground);display:inline-flex;gap:4px;align-items:center}
.details{border-top:1px dashed var(--line);padding-top:10px;display:grid;gap:8px}
.gtitle{font-size:11.5px;font-weight:600;color:var(--accent-text);display:flex;align-items:center;gap:6px} .gtitle::after{content:"";flex:1;height:1px;background:var(--line)}
ul.bul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
ul.bul li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.55;overflow-wrap:anywhere}
ul.bul li svg.ic{width:20px;height:20px;color:var(--accent-text);margin-top:2px;background:var(--accent-soft);border-radius:6px;padding:3px}
ul.bul li b{font-weight:600}
.hidden-items{display:none} .card.open .hidden-items{display:contents}
.more{align-self:flex-start;background:none;border:0;padding:4px 0;color:var(--accent-text);font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;min-height:32px}
.guides{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px} .guides img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:#fff;flex:none;cursor:zoom-in}
.links{display:flex;gap:6px;flex-wrap:wrap} .links a{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;text-decoration:none;border:1px solid var(--line);border-radius:8px;padding:4px 10px;min-height:32px;background:var(--ground)}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);padding-top:6px;gap:8px;flex-wrap:wrap}
.foot a{display:inline-flex;align-items:center;gap:4px;text-decoration:none;font-weight:600;min-height:32px}
.nores{padding:40px;text-align:center;color:var(--muted)}
dialog{position:relative;border:0;border-radius:14px;padding:0;background:var(--surface);color:var(--ink);width:min(1000px,calc(100vw - 24px));max-height:calc(100vh - 24px);box-shadow:0 30px 80px -20px rgba(0,0,0,.5)}
dialog::backdrop{background:rgba(6,16,24,.65);backdrop-filter:blur(2px)}
.dlg{display:grid;grid-template-columns:1fr;max-height:calc(100vh - 24px);overflow:auto} @media(min-width:820px){.dlg{grid-template-columns:5fr 7fr}}
.dlg-media{background:var(--surface-2);padding:14px;display:grid;gap:10px;align-content:start}
.dlg-media .main{aspect-ratio:1;background:#fff;border-radius:10px;display:grid;place-items:center;overflow:hidden} .dlg-media .main img{width:100%;height:100%;object-fit:contain}
.thumbs{display:flex;gap:6px;flex-wrap:wrap} .thumbs button{width:56px;height:56px;border-radius:8px;border:2px solid transparent;padding:0;background:#fff;overflow:hidden;cursor:pointer} .thumbs button[aria-current="true"]{border-color:var(--accent)} .thumbs img{width:100%;height:100%;object-fit:cover}
.dlg-media h4{margin:6px 0 0;font-size:12px;color:var(--muted);font-weight:600}
.dlg-body{padding:18px 20px 22px;display:grid;gap:12px;align-content:start} .dlg-body h2{font-size:19px}
.dlg-close{position:absolute;top:10px;left:10px;z-index:2;width:36px;height:36px;border-radius:999px;border:1px solid var(--line);background:var(--surface);cursor:pointer;display:grid;place-items:center}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px;margin:0} .kv dt{color:var(--muted)} .kv dd{margin:0;overflow-wrap:anywhere}
.kv code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;direction:ltr;unicode-bidi:embed}
@media (prefers-reduced-motion: no-preference){.card{transition:transform .15s ease}.card:hover{transform:translateY(-2px)}}
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">__SPRITE__</svg>
<header class="top"><div class="top-in">
  <div class="brandrow">
    <div class="logo" aria-hidden="true"><svg class="ic"><use href="#i-television-classic"/></svg></div>
    <div><h1>باقات سمارت سوق الرقمية</h1><div class="sub">الاشتراكات الرقمية المعروضة في ssouq.com بعد التنظيف وإعادة التنظيم · الاستخراج بتاريخ __DATE__</div></div>
    <span class="tag-preview">نسخة معاينة للمراجعة</span>
  </div>
  <div class="controls">
    <label class="field"><span class="sr">بحث</span><svg class="ic"><use href="#i-magnify"/></svg><input id="q" type="search" placeholder="ابحث في الأسماء والمميزات والقنوات…" autocomplete="off"></label>
    <label class="field"><span class="sr">الترتيب</span><svg class="ic"><use href="#i-sort"/></svg><select id="sort"><option value="default">حسب الباقة والمدة</option><option value="sold">الأكثر مبيعاً</option><option value="price-asc">السعر: من الأقل</option><option value="price-desc">السعر: من الأعلى</option><option value="ppm">أفضل سعر شهري</option><option value="duration">الأطول مدة</option></select></label>
    <label class="field"><span class="sr">المنصة</span><svg class="ic"><use href="#i-devices"/></svg><select id="plat"><option value="">كل المنصات</option></select></label>
    <div class="seg" role="group" aria-label="طريقة العرض"><button id="v-cards" aria-pressed="true" type="button"><svg class="ic"><use href="#i-view-grid-outline"/></svg> بطاقات</button><button id="v-table" aria-pressed="false" type="button"><svg class="ic"><use href="#i-table-large"/></svg> جدول مقارنة</button></div>
  </div>
  <div class="chips" id="fams" role="group" aria-label="عائلة الاشتراك"></div>
</div></header>
<main class="wrap">
  <section class="stats" id="stats" aria-label="ملخص"></section>
  <div class="note" id="hostnote"><svg class="ic"><use href="#i-server-network"/></svg><div></div></div>
  <div class="resultbar"><div id="count"></div><div>اضغط على الصورة أو «عرض التفاصيل» لفتح البطاقة الكاملة مع صور الشرح</div></div>
  <section class="grid" id="grid" aria-live="polite"></section>
  <section class="tblwrap" id="tbl" hidden></section>
</main>
<dialog id="dlg" aria-labelledby="dlg-title"><button class="dlg-close" type="button" data-close aria-label="إغلاق"><svg class="ic"><use href="#i-close"/></svg></button><div class="dlg" id="dlgc"></div></dialog>
<script id="data" type="application/json">__DATA__</script>
<script>
(function(){
  const DATA = JSON.parse(document.getElementById('data').textContent);
  const P = DATA.products, S = DATA.stats;
  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const fmt = n => n==null ? '—' : Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
  const img = (im, cls, alt) => im ? `<img class="${cls}" src="${esc(im.src)}" ${im.original?`data-fb="${esc(im.original)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb')}"`:''} alt="${esc(alt||'')}" loading="lazy" decoding="async">` : `<div class="noimg">${ic('image-off-outline')}</div>`;
  const dur = p => p.duration_months==null ? '—' : p.duration_months===0 ? 'يوم' : p.duration_months===12 ? 'سنة' : p.duration_months===24 ? 'سنتان' : p.duration_months + ' شهر';
  const rating = p => p.rating.rate ? `${ic('star')} ${p.rating.rate} <span style="color:var(--muted);font-weight:400">(${p.rating.count})</span>` : '<span style="color:var(--muted)">بدون تقييم</span>';

  $('#stats').innerHTML = [['total','باقة معروضة'],['in_stock','متوفرة الآن'],['families','عائلات اشتراك'],['sold','عملية بيع إجمالاً'],['images','صورة مستضافة'],['bullets','نقطة تفصيلية'],['min_price','أقل سعر (ر.س)']].map(([k,l]) => `<div class="stat"><div class="v">${fmt(S[k])}</div><div class="l">${l}</div></div>`).join('');
  $('#hostnote div').innerHTML = DATA.mode==='embed'
    ? `الصور في هذه المعاينة مضمّنة داخل الملف (نسخ مصغّرة). النسخ الأصلية محفوظة في المستودع تحت <code>public/media/subscriptions/</code> وستُخدَم من <code>${esc(DATA.host)}</code> بعد النشر.`
    : `الصور مستضافة على خادمك: <code>${esc(DATA.host)}</code> (المجلد <code>public/media/subscriptions/</code> في المستودع). إلى أن يُنشر الفرع، يعود المتصفح تلقائياً إلى نسخة CDN الأصلية.`;

  const fams = {}; const plats = {};
  P.forEach(p => { fams[p.family]=(fams[p.family]||0)+1; p.platforms.forEach(t => plats[t]=(plats[t]||0)+1); });
  $('#fams').innerHTML = `<button class="chip" data-f="" aria-pressed="true">الكل <span class="n">${P.length}</span></button>` + Object.entries(fams).map(([f,n]) => `<button class="chip" data-f="${esc(f)}" aria-pressed="false">${esc(f)} <span class="n">${n}</span></button>`).join('');
  $('#plat').insertAdjacentHTML('beforeend', Object.entries(plats).map(([t,n]) => `<option value="${esc(t)}">${esc(t)} (${n})</option>`).join(''));
  P.forEach(p => p._hay = [p.name, p.family, p.brand, p.promotion, p.summary, ...p.groups.flatMap(g => [g.title||'', ...g.items.map(i=>i.text)])].join(' ').toLowerCase());
  const state = {q:'', f:'', plat:'', sort:'default', view:'cards'};
  $('#fams').addEventListener('click', e => { const b=e.target.closest('.chip'); if(!b) return; state.f=b.dataset.f; [...$('#fams').children].forEach(x=>x.setAttribute('aria-pressed',x===b)); render(); });
  $('#q').addEventListener('input', e => { state.q=e.target.value.trim().toLowerCase(); render(); });
  $('#sort').addEventListener('change', e => { state.sort=e.target.value; render(); });
  $('#plat').addEventListener('change', e => { state.plat=e.target.value; render(); });
  $('#v-cards').addEventListener('click', () => setView('cards')); $('#v-table').addEventListener('click', () => setView('table'));
  function setView(v){ state.view=v; $('#v-cards').setAttribute('aria-pressed', v==='cards'); $('#v-table').setAttribute('aria-pressed', v==='table'); render(); }

  function filtered(){
    let r = P.filter(p => (!state.f || p.family===state.f) && (!state.plat || p.platforms.includes(state.plat)) && (!state.q || p._hay.includes(state.q)));
    const pr = p => p.sale_price ?? p.price ?? 0;
    switch(state.sort){
      case 'sold': r.sort((a,b)=>(b.sold||0)-(a.sold||0)); break;
      case 'price-asc': r.sort((a,b)=>pr(a)-pr(b)); break;
      case 'price-desc': r.sort((a,b)=>pr(b)-pr(a)); break;
      case 'ppm': r.sort((a,b)=>(a.price_per_month??1e9)-(b.price_per_month??1e9)); break;
      case 'duration': r.sort((a,b)=>(b.duration_months??-1)-(a.duration_months??-1)); break;
    }
    return r;
  }
  const bullet = i => `<li>${ic(i.icon)}<span>${i.key ? `<b>${esc(i.key)}:</b> ${esc(i.value)}` : esc(i.text)}</span></li>`;
  function groupsHTML(p, limit){
    if(!p.groups.length) return `<div class="empty">${ic('information-outline')} لا يوجد وصف لهذه الباقة</div>`;
    let left=limit, out='', hiddenN=0;
    for(const g of p.groups){
      const vis=[], hid=[]; for(const it of g.items){ if(left>0){vis.push(it);left--;} else hid.push(it); }
      hiddenN += hid.length;
      const title = g.title ? `<div class="gtitle">${esc(g.title)}</div>` : '';
      out += `${vis.length?'':'<div class="hidden-items">'}${title}<ul class="bul">${vis.map(bullet).join('')}${hid.length?`<div class="hidden-items">${hid.map(bullet).join('')}</div>`:''}</ul>${vis.length?'':'</div>'}`;
    }
    if(hiddenN) out += `<button class="more" data-more type="button">${ic('chevron-down')} <span>عرض كل النقاط (${p.bullet_count})</span></button>`;
    return out;
  }
  const priceHTML = p => (p.sale_price ? `<span class="price">${fmt(p.sale_price)}<small>ر.س</small></span><span class="was">${fmt(p.regular_price)} ر.س</span>` : `<span class="price">${fmt(p.price)}<small>ر.س</small></span>`) + `<span class="tax">شامل الضريبة</span>`;
  const badges = p => (p.in_stock ? `<span class="pill good">${ic('check-circle-outline')} متوفر</span>` : `<span class="pill bad">غير متوفر</span>`) + (p.promotion ? `<span class="pill warm">${ic('fire')} ${esc(p.promotion)}</span>` : '');
  const linksHTML = p => p.links.length ? `<div class="links">${p.links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${ic(l.icon)} ${esc(l.text)}</a>`).join('')}</div>` : '';
  const platHTML = p => p.platforms.length ? `<div class="plat">${p.platforms.map(t => `<span>${ic(t==='iOS'?'apple':t==='Android'?'android':t.startsWith('Windows')?'microsoft-windows':t==='TV Box'?'monitor':'television-classic')}${esc(t)}</span>`).join('')}</div>` : '';
  function cardHTML(p, idx){
    return `<article class="card" data-idx="${idx}">
      <div class="media" data-open="${idx}" role="button" tabindex="0" aria-label="فتح تفاصيل ${esc(p.name)}">${img(p.images[0],'',p.name)}<div class="badges"><span class="pill fam">${esc(p.family)}</span>${badges(p)}</div></div>
      <div class="body">
        <h3 title="${esc(p.name)}">${esc(p.name)}</h3>
        <div class="facts">
          <div class="fact"><div class="v">${dur(p)}</div><div class="l">المدة</div></div>
          <div class="fact"><div class="v">${p.devices}</div><div class="l">${p.devices>1?'أجهزة':'جهاز'}</div></div>
          <div class="fact"><div class="v">${p.price_per_month!=null?fmt(p.price_per_month):'—'}</div><div class="l">ر.س / شهر</div></div>
          <div class="fact"><div class="v">${fmt(p.sold)}</div><div class="l">مبيعات</div></div>
        </div>
        <div class="pricerow">${priceHTML(p)}<span style="margin-inline-start:auto;font-size:13px">${rating(p)}</span></div>
        ${platHTML(p)}
        <div class="details">${groupsHTML(p, 6)}</div>
        ${p.guide_images.length?`<div class="gtitle">صور الشرح والتثبيت (${p.guide_images.length})</div><div class="guides">${p.guide_images.map((g,i)=>`<img src="${esc(g.src)}" ${g.original?`data-fb="${esc(g.original)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb')}"`:''} alt="" loading="lazy" data-open="${idx}" data-g="${i}">`).join('')}</div>`:''}
        ${linksHTML(p)}
        <div class="foot"><span>#${p.id}</span><a href="#" data-open="${idx}">${ic('format-list-bulleted')} عرض التفاصيل</a><a href="${esc(p.url)}" target="_blank" rel="noopener">${ic('open-in-new')} صفحة المنتج</a></div>
      </div></article>`;
  }
  function tableHTML(rows){
    return `<table><thead><tr><th>الباقة</th><th>المدة</th><th>الأجهزة</th><th>السعر (ر.س)</th><th>ر.س/شهر</th><th>المبيعات</th><th>التقييم</th><th>الحالة</th><th>المنصات</th><th>النقاط</th></tr></thead><tbody>${rows.map(p => `<tr class="row" data-open="${P.indexOf(p)}"><td class="name">${img(p.images[0],'thumb',p.name)}${esc(p.name)}<small>${esc(p.family)}${p.promotion?' · '+esc(p.promotion):''}</small></td><td>${dur(p)}</td><td>${p.devices}</td><td class="num">${fmt(p.sale_price??p.price)}${p.sale_price?` <span class="was">${fmt(p.regular_price)}</span>`:''}</td><td class="num">${p.price_per_month!=null?fmt(p.price_per_month):'—'}</td><td class="num">${fmt(p.sold)}</td><td>${rating(p)}</td><td>${p.in_stock?'<span class="pill good">متوفر</span>':'<span class="pill bad">غير متوفر</span>'}</td><td style="white-space:normal;min-width:180px;font-size:12px">${p.platforms.join(' · ')||'—'}</td><td class="num">${p.bullet_count}</td></tr>`).join('')}</tbody></table>`;
  }
  function render(){
    const r = filtered();
    $('#count').innerHTML = `عرض <b>${r.length}</b> من <b>${P.length}</b> باقة`;
    if(state.view==='cards'){ $('#tbl').hidden=true; $('#grid').hidden=false; $('#grid').innerHTML = r.length ? r.map(p => cardHTML(p, P.indexOf(p))).join('') : `<div class="nores">لا توجد باقات مطابقة</div>`; }
    else { $('#grid').hidden=true; $('#tbl').hidden=false; $('#tbl').innerHTML = tableHTML(r); }
  }
  document.body.addEventListener('click', e => {
    const m = e.target.closest('[data-more]'); if(m){ const c=m.closest('.card'); c.classList.toggle('open'); const o=c.classList.contains('open'); m.querySelector('span').textContent = o ? 'إخفاء النقاط الإضافية' : `عرض كل النقاط (${P[c.dataset.idx].bullet_count})`; m.querySelector('use').setAttribute('href', o?'#i-chevron-up':'#i-chevron-down'); return; }
    const o = e.target.closest('[data-open]'); if(o && !e.target.closest('dialog')){ e.preventDefault(); openDlg(P[o.dataset.open], o.dataset.g!=null ? Number(o.dataset.g)+1 : 0); }
  });
  document.body.addEventListener('keydown', e => { const o=e.target.closest('.media[data-open]'); if(o && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); openDlg(P[o.dataset.open],0); } });
  const dlg = $('#dlg');
  function openDlg(p, start){
    const all = [...p.images, ...p.guide_images];
    const fb = im => im.original?`data-fb="${esc(im.original)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb')}"`:'';
    $('#dlgc').innerHTML = `
      <div class="dlg-media">
        <div class="main">${all[start]?`<img id="dlg-main" src="${esc(all[start].src)}" ${fb(all[start])} alt="${esc(p.name)}">`:`<div class="noimg">${ic('image-off-outline')}</div>`}</div>
        ${p.images.length?`<h4>صور المنتج (${p.images.length})</h4><div class="thumbs">${p.images.map((u,i)=>`<button type="button" data-img="${esc(u.src)}" data-fbu="${esc(u.original||'')}" aria-current="${i===start}"><img src="${esc(u.src)}" ${fb(u)} alt="" loading="lazy"></button>`).join('')}</div>`:''}
        ${p.guide_images.length?`<h4>صور الشرح والتثبيت (${p.guide_images.length})</h4><div class="thumbs">${p.guide_images.map((u,i)=>`<button type="button" data-img="${esc(u.src)}" data-fbu="${esc(u.original||'')}" aria-current="${i+p.images.length===start}"><img src="${esc(u.src)}" ${fb(u)} alt="" loading="lazy"></button>`).join('')}</div>`:''}
      </div>
      <div class="dlg-body">
        <div class="plat"><span>${ic('shape-outline')}${esc(p.category)}</span><span>${esc(p.family)}</span>${p.brand?`<span>${ic('tag-outline')}${esc(p.brand)}</span>`:''}<span>#${p.id}</span></div>
        <h2 id="dlg-title">${esc(p.name)}</h2>
        <div class="badges" style="position:static">${badges(p)}</div>
        <div class="pricerow">${priceHTML(p)}<span style="margin-inline-start:auto;font-size:13px">${rating(p)}</span></div>
        <div class="facts"><div class="fact"><div class="v">${dur(p)}</div><div class="l">المدة</div></div><div class="fact"><div class="v">${p.devices}</div><div class="l">${p.devices>1?'أجهزة':'جهاز'}</div></div><div class="fact"><div class="v">${p.price_per_month!=null?fmt(p.price_per_month):'—'}</div><div class="l">ر.س / شهر</div></div><div class="fact"><div class="v">${fmt(p.sold)}</div><div class="l">مبيعات</div></div></div>
        ${p.summary?`<p style="margin:0;color:var(--muted);font-size:13.5px">${esc(p.summary)}</p>`:''}
        ${platHTML(p)}
        ${linksHTML(p)}
        <dl class="kv"><dt>النوع</dt><dd>${p.type==='service'?'خدمة رقمية':'أكواد / اشتراك رقمي'} (بدون شحن)</dd><dt>السعر قبل الضريبة</dt><dd>${fmt(p.pre_tax_price)} ر.س</dd>${p.quantity!=null?`<dt>الكمية المتبقية</dt><dd>${fmt(p.quantity)}</dd>`:''}${p.seo_title?`<dt>عنوان SEO</dt><dd>${esc(p.seo_title)}</dd>`:''}<dt>الصورة الرئيسية</dt><dd><code>${esc((p.images[0]||{}).path||'—')}</code></dd><dt>الرابط الأصلي</dt><dd><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a></dd></dl>
        <div class="details">${groupsHTML(p, 1e9)}</div>
      </div>`;
    dlg.showModal();
  }
  dlg.addEventListener('click', e => { if(e.target.closest('[data-close]') || e.target===dlg) { dlg.close(); return; } const t=e.target.closest('[data-img]'); if(t){ const m=$('#dlg-main'); if(m){ m.src=t.dataset.img; if(t.dataset.fbu){ m.dataset.fb=t.dataset.fbu; } } dlg.querySelectorAll('[data-img]').forEach(b=>b.setAttribute('aria-current', b===t)); } });
  render();
})();
</script>
</body>
</html>
'''
out = page.replace('__SPRITE__', sprite).replace('__DATA__', data_json).replace('__DATE__', gen)
fn = 'subscriptions.html' if MODE == 'standalone' else 'subscriptions-embed.html'
open(fn, 'w', encoding='utf-8').write(out)
print(fn, len(out)//1024, 'KB', len(P), 'products', len(names), 'icons')
