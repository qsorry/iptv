# -*- coding: utf-8 -*-
"""Build a single self-contained HTML preview (catalog.html) from products.json."""
import json, subprocess, html, collections, datetime
import footer_html
FOOTER = footer_html.load()

P = json.load(open('products.json', encoding='utf-8'))
used = sorted({i['icon'] for p in P for g in p['groups'] for i in g['items']})
UI_ICONS = ['magnify','close','chevron-down','chevron-up','open-in-new','image-off-outline','cart-outline','tag-outline',
            'check-circle-outline','package-variant-closed','sale','sort','filter-variant','information-outline',
            'shape-outline','store-outline','format-list-bulleted','chevron-right','chevron-left','cloud-download-outline']
names = sorted(set(used) | set(UI_ICONS) | set(footer_html.icon_names(FOOTER)))
def camel(n): return 'mdi' + ''.join(w.capitalize() for w in n.split('-'))
js = "const m=require('@mdi/js');const out={};for(const n of %s){const k=%s;out[n]=m[k]||null}console.log(JSON.stringify(out))" % (
    json.dumps(names), "'mdi'+n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join('')")
paths = json.loads(subprocess.check_output(['node', '-e', js], cwd='mdi'))
missing = [n for n, v in paths.items() if not v]
assert not missing, missing
sprite = ''.join('<symbol id="i-%s" viewBox="0 0 24 24"><path d="%s"/></symbol>' % (n, d) for n, d in paths.items())

cats = collections.Counter(p['category'] for p in P)
brands = collections.Counter(p['brand'] for p in P if p['brand'])
stats = {
    'total': len(P), 'in_stock': sum(p['in_stock'] for p in P), 'on_sale': sum(1 for p in P if p['sale_price']),
    'cats': len(cats), 'brands': len(brands), 'bullets': sum(p['bullet_count'] for p in P),
    'digital': sum(1 for p in P if p['type']=='digital'), 'with_options': sum(1 for p in P if p['options']),
}
generated = datetime.date.today().isoformat()
data_json = json.dumps({'products': P, 'stats': stats, 'generated': generated}, ensure_ascii=False).replace('</', '<\\/')

page = r'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>كتالوج سمارت سوق</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<style>
:root{
  --ground:#f2f5f7; --surface:#ffffff; --surface-2:#e9eff3; --ink:#12232f; --muted:#5d6f7c; --line:#d5dee5; --line-strong:#b9c7d1;
  --accent:#004d73; --accent-ink:#ffffff; --accent-soft:#dbe9f1; --accent-text:#004d73;
  --good:#1b6e46; --good-soft:#dcefe3; --bad:#8a3b2a; --bad-soft:#f5e2dc; --sale:#a4530f; --sale-soft:#fbe9d6; --digital:#4d3f8f; --digital-soft:#e7e2f6;
  --shadow:0 1px 2px rgba(18,35,47,.06),0 6px 20px -8px rgba(18,35,47,.18);
  --radius:10px; --font-display:"Readex Pro","IBM Plex Sans Arabic",system-ui,sans-serif; --font-body:"IBM Plex Sans Arabic","Readex Pro",system-ui,sans-serif;
  color-scheme:light;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --ground:#0e161c; --surface:#172229; --surface-2:#1f2d36; --ink:#e4ecf1; --muted:#98a9b4; --line:#2a3a45; --line-strong:#3a4f5c;
  --accent:#6fb8dc; --accent-ink:#0b1a23; --accent-soft:#183445; --accent-text:#8ccbe9;
  --good:#7ed3a5; --good-soft:#173328; --bad:#f0a08c; --bad-soft:#3c221b; --sale:#f2b46a; --sale-soft:#3d2a13; --digital:#c3b6f5; --digital-soft:#2a2445;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -10px rgba(0,0,0,.6); color-scheme:dark;
}}
:root[data-theme="dark"]{
  --ground:#0e161c; --surface:#172229; --surface-2:#1f2d36; --ink:#e4ecf1; --muted:#98a9b4; --line:#2a3a45; --line-strong:#3a4f5c;
  --accent:#6fb8dc; --accent-ink:#0b1a23; --accent-soft:#183445; --accent-text:#8ccbe9;
  --good:#7ed3a5; --good-soft:#173328; --bad:#f0a08c; --bad-soft:#3c221b; --sale:#f2b46a; --sale-soft:#3d2a13; --digital:#c3b6f5; --digital-soft:#2a2445;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -10px rgba(0,0,0,.6); color-scheme:dark;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.7;font-variant-numeric:tabular-nums}
h1,h2,h3{font-family:var(--font-display);font-weight:600;line-height:1.35;margin:0;text-wrap:balance}
a{color:var(--accent-text)}
button{font:inherit;color:inherit}
svg.ic{width:1.15em;height:1.15em;fill:currentColor;flex:none;vertical-align:-.2em}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* ---------- header ---------- */
.top{position:sticky;top:0;z-index:20;background:var(--surface);border-bottom:1px solid var(--line);padding-top:env(safe-area-inset-top)}
.top-in{max-width:1400px;margin:0 auto;padding:10px 16px;display:grid;gap:10px}
.brandrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.logo{width:40px;height:40px;border-radius:8px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-family:var(--font-display);font-weight:700;font-size:18px;flex:none}
.brandrow h1{font-size:18px}
.brandrow .sub{color:var(--muted);font-size:13px}
.tag-preview{margin-inline-start:auto;font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--sale);background:var(--sale-soft);padding:3px 10px;border-radius:999px}
.controls{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:720px){.controls{grid-template-columns:minmax(220px,1.6fr) repeat(3,minmax(140px,1fr)) auto}}
.field{position:relative;display:flex;align-items:center}
.field svg.ic{position:absolute;inset-inline-start:10px;color:var(--muted);pointer-events:none}
.field input,.field select{width:100%;min-height:40px;font-size:16px;font-family:inherit;color:var(--ink);background:var(--ground);border:1px solid var(--line);border-radius:8px;padding:6px 36px 6px 12px;appearance:none;-webkit-appearance:none}
.field select{padding-inline-end:36px;cursor:pointer}
.field input:focus,.field select:focus{border-color:var(--accent);outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.toggle{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--ground);cursor:pointer;user-select:none;white-space:nowrap}
.toggle input{accent-color:var(--accent);width:16px;height:16px;margin:0}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.chip{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:13px;font-weight:500}
.chip .n{font-size:12px;color:var(--muted);background:var(--surface-2);padding:0 7px;border-radius:999px;line-height:1.6}
.chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.chip[aria-pressed="true"] .n{background:rgba(255,255,255,.22);color:inherit}

/* ---------- stats ---------- */
.wrap{max-width:1400px;margin:0 auto;padding:16px}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
@media(min-width:640px){.stats{grid-template-columns:repeat(4,1fr)}}
@media(min-width:1024px){.stats{grid-template-columns:repeat(8,1fr)}}
.stat{background:var(--surface);padding:12px 14px}
.stat .v{font-family:var(--font-display);font-size:22px;font-weight:600;line-height:1.2}
.stat .l{font-size:12px;color:var(--muted)}
.resultbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 10px;color:var(--muted);font-size:13px;flex-wrap:wrap}
.resultbar b{color:var(--ink);font-weight:600}

/* ---------- grid / cards ---------- */
.grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:640px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1400px){.grid{grid-template-columns:repeat(4,1fr)}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);display:flex;flex-direction:column;overflow:hidden;min-width:0}
.media{position:relative;aspect-ratio:4/3;background:var(--surface-2);display:grid;place-items:center;cursor:zoom-in}
.media img{width:100%;height:100%;object-fit:contain;display:block;background:#fff}
.media .noimg{color:var(--muted);display:grid;place-items:center;gap:4px;font-size:12px}
.media .noimg svg.ic{width:28px;height:28px}
.badges{position:absolute;top:8px;inset-inline-start:8px;display:flex;gap:6px;flex-wrap:wrap}
.pill{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;line-height:1.6;display:inline-flex;align-items:center;gap:4px}
.pill.good{background:var(--good-soft);color:var(--good)}
.pill.bad{background:var(--bad-soft);color:var(--bad)}
.pill.sale{background:var(--sale-soft);color:var(--sale)}
.pill.digital{background:var(--digital-soft);color:var(--digital)}
.imgcount{position:absolute;bottom:8px;inset-inline-end:8px;font-size:11px;background:rgba(18,35,47,.7);color:#fff;padding:1px 8px;border-radius:999px}
.body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px;flex:1}
.meta{display:flex;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.meta span{display:inline-flex;align-items:center;gap:4px;background:var(--surface-2);padding:1px 8px;border-radius:6px}
.card h3{font-size:15px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}
.pricerow{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.price{font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--ink)}
.price small{font-size:12px;font-weight:500;color:var(--muted);margin-inline-start:3px}
.was{color:var(--muted);text-decoration:line-through;font-size:13px}
.sold{margin-inline-start:auto;font-size:12px;color:var(--muted)}
.opts{display:flex;flex-direction:column;gap:6px;font-size:12.5px}
.opt{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.opt .k{color:var(--muted);font-weight:500}
.opt .v{border:1px solid var(--line);border-radius:6px;padding:0 7px;background:var(--ground)}
.opt .v.na{opacity:.5;text-decoration:line-through}
.details{border-top:1px dashed var(--line);padding-top:10px;display:grid;gap:8px}
.gtitle{font-size:11.5px;font-weight:600;letter-spacing:.02em;color:var(--accent-text);text-transform:uppercase;display:flex;align-items:center;gap:6px}
.gtitle::after{content:"";flex:1;height:1px;background:var(--line)}
ul.bul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
ul.bul li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.55;overflow-wrap:anywhere}
ul.bul li svg.ic{width:18px;height:18px;color:var(--accent-text);margin-top:3px;background:var(--accent-soft);border-radius:6px;padding:2px}
ul.bul li b{font-weight:600}
.empty{font-size:13px;color:var(--muted);display:flex;gap:6px;align-items:center}
.more{align-self:flex-start;background:none;border:0;padding:4px 0;color:var(--accent-text);font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;min-height:32px}
.hidden-items{display:none}
.card.open .hidden-items{display:contents}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);padding-top:6px}
.foot a{display:inline-flex;align-items:center;gap:4px;text-decoration:none;font-weight:600;min-height:32px}
.loadmore{display:flex;justify-content:center;margin:24px 0}
.btn{min-height:44px;padding:0 22px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:8px}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.nores{padding:40px;text-align:center;color:var(--muted)}

/* ---------- dialog ---------- */
dialog{border:0;border-radius:14px;padding:0;background:var(--surface);color:var(--ink);width:min(960px,calc(100vw - 24px));max-height:calc(100vh - 24px);box-shadow:0 30px 80px -20px rgba(0,0,0,.5)}
dialog::backdrop{background:rgba(8,18,26,.6);backdrop-filter:blur(2px)}
.dlg{display:grid;grid-template-columns:1fr;max-height:calc(100vh - 24px);overflow:auto}
@media(min-width:800px){.dlg{grid-template-columns:5fr 6fr}}
.dlg-media{background:var(--surface-2);padding:14px;display:grid;gap:10px;align-content:start}
.dlg-media .main{aspect-ratio:1;background:#fff;border-radius:10px;display:grid;place-items:center;overflow:hidden}
.dlg-media .main img{width:100%;height:100%;object-fit:contain}
.thumbs{display:flex;gap:6px;flex-wrap:wrap}
.thumbs button{width:56px;height:56px;border-radius:8px;border:2px solid transparent;padding:0;background:#fff;overflow:hidden;cursor:pointer}
.thumbs button[aria-current="true"]{border-color:var(--accent)}
.thumbs img{width:100%;height:100%;object-fit:contain}
.dlg-body{padding:18px 20px 22px;display:grid;gap:12px;align-content:start}
.dlg-body h2{font-size:19px}
.dlg-close{position:sticky;top:8px;float:left;margin:8px;z-index:2;width:36px;height:36px;border-radius:999px;border:1px solid var(--line);background:var(--surface);cursor:pointer;display:grid;place-items:center}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px}
.kv dt{color:var(--muted)}
.kv dd{margin:0}
@media (prefers-reduced-motion: no-preference){.card{transition:transform .15s ease}.card:hover{transform:translateY(-2px)}}
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">__SPRITE__</svg>

<header class="top">
  <div class="top-in">
    <div class="brandrow">
      <div class="logo" aria-hidden="true">س</div>
      <div>
        <h1>كتالوج سمارت سوق</h1>
        <div class="sub">بيانات المنتجات المستخرجة من ssouq.com بعد التنظيف وإعادة التنظيم · تم الاستخراج بتاريخ __DATE__</div>
      </div>
      <span class="tag-preview">نسخة معاينة للمراجعة</span>
    </div>
    <div class="controls">
      <label class="field"><span class="sr">بحث</span><svg class="ic"><use href="#i-magnify"/></svg><input id="q" type="search" placeholder="ابحث بالاسم أو الماركة أو أي كلمة في التفاصيل…" autocomplete="off"></label>
      <label class="field"><span class="sr">الماركة</span><svg class="ic"><use href="#i-tag-outline"/></svg><select id="brand"><option value="">كل الماركات</option></select></label>
      <label class="field"><span class="sr">التوفر</span><svg class="ic"><use href="#i-package-variant-closed"/></svg><select id="stock"><option value="">كل المنتجات</option><option value="in">متوفر فقط</option><option value="out">نفدت الكمية</option></select></label>
      <label class="field"><span class="sr">الترتيب</span><svg class="ic"><use href="#i-sort"/></svg><select id="sort"><option value="default">الترتيب الافتراضي</option><option value="sold">الأكثر مبيعاً</option><option value="price-asc">السعر: من الأقل</option><option value="price-desc">السعر: من الأعلى</option><option value="name">الاسم أ-ي</option><option value="bullets">الأكثر تفصيلاً</option></select></label>
      <label class="toggle"><input id="sale" type="checkbox"> <svg class="ic"><use href="#i-sale"/></svg> عليها خصم</label>
    </div>
    <div class="chips" id="cats" role="group" aria-label="التصنيفات"></div>
  </div>
</header>

<main class="wrap">
  <section class="stats" id="stats" aria-label="ملخص الكتالوج"></section>
  <div class="resultbar"><div id="count"></div><div>اضغط على الصورة أو «عرض التفاصيل» لفتح البطاقة الكاملة</div></div>
  <section class="grid" id="grid" aria-live="polite"></section>
  <div class="loadmore" id="loadmore"></div>
</main>

<dialog id="dlg" aria-labelledby="dlg-title"><div class="dlg" id="dlgc"></div></dialog>

<script id="data" type="application/json">__DATA__</script>
<script>
(function(){
  const DATA = JSON.parse(document.getElementById('data').textContent);
  const P = DATA.products, S = DATA.stats;
  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const fmt = n => n==null ? '—' : Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
  const cur = c => c==='SAR' ? 'ر.س' : c;

  /* stats */
  const statDefs = [['total','منتج'],['in_stock','متوفر حالياً'],['on_sale','عليها خصم'],['digital','منتج رقمي'],['with_options','بخيارات متعددة'],['cats','تصنيف'],['brands','ماركة'],['bullets','نقطة تفصيلية']];
  $('#stats').innerHTML = statDefs.map(([k,l]) => `<div class="stat"><div class="v">${fmt(S[k])}</div><div class="l">${l}</div></div>`).join('');

  /* filters */
  const catCount = {}; const brandCount = {};
  P.forEach(p => { catCount[p.category]=(catCount[p.category]||0)+1; if(p.brand) brandCount[p.brand]=(brandCount[p.brand]||0)+1; });
  const cats = Object.entries(catCount).sort((a,b)=>b[1]-a[1]);
  const state = { q:'', cat:'', brand:'', stock:'', sale:false, sort:'default', shown:0 };
  const PAGE = 36;
  $('#cats').innerHTML = `<button class="chip" data-cat="" aria-pressed="true">الكل <span class="n">${P.length}</span></button>` +
    cats.map(([c,n]) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(c)} <span class="n">${n}</span></button>`).join('');
  $('#brand').insertAdjacentHTML('beforeend', Object.entries(brandCount).sort((a,b)=>b[1]-a[1]).map(([b,n]) => `<option value="${esc(b)}">${esc(b)} (${n})</option>`).join(''));

  $('#cats').addEventListener('click', e => { const b = e.target.closest('.chip'); if(!b) return; state.cat = b.dataset.cat; [...$('#cats').children].forEach(x => x.setAttribute('aria-pressed', x===b)); render(); });
  $('#q').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); render(); });
  $('#brand').addEventListener('change', e => { state.brand = e.target.value; render(); });
  $('#stock').addEventListener('change', e => { state.stock = e.target.value; render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $('#sale').addEventListener('change', e => { state.sale = e.target.checked; render(); });

  P.forEach(p => { p._hay = [p.name, p.brand, p.category, p.summary, ...p.groups.flatMap(g => [g.title||'', ...g.items.map(i=>i.text)])].join(' ').toLowerCase(); });

  function filtered(){
    let r = P.filter(p => (!state.cat || p.category===state.cat) && (!state.brand || p.brand===state.brand)
      && (!state.stock || (state.stock==='in')===p.in_stock) && (!state.sale || p.sale_price) && (!state.q || p._hay.includes(state.q)));
    const pr = p => p.sale_price ?? p.price ?? 0;
    switch(state.sort){
      case 'sold': r.sort((a,b)=>(b.sold||0)-(a.sold||0)); break;
      case 'price-asc': r.sort((a,b)=>pr(a)-pr(b)); break;
      case 'price-desc': r.sort((a,b)=>pr(b)-pr(a)); break;
      case 'name': r.sort((a,b)=>a.name.localeCompare(b.name,'ar')); break;
      case 'bullets': r.sort((a,b)=>b.bullet_count-a.bullet_count); break;
    }
    return r;
  }

  function bulletHTML(i){
    const body = i.key ? `<b>${esc(i.key)}:</b> ${esc(i.value)}` : esc(i.text);
    return `<li>${ic(i.icon)}<span>${body}</span></li>`;
  }
  function groupsHTML(p, limit){
    if(!p.groups.length) return `<div class="empty">${ic('information-outline')} لا يوجد وصف لهذا المنتج في المتجر</div>`;
    let left = limit, out = '', hiddenN = 0;
    for(const g of p.groups){
      const vis = [], hid = [];
      for(const it of g.items){ if(left>0){ vis.push(it); left--; } else hid.push(it); }
      hiddenN += hid.length;
      const title = g.title ? `<div class="gtitle">${esc(g.title)}</div>` : '';
      const wrapStart = vis.length ? '' : '<div class="hidden-items">', wrapEnd = vis.length ? '' : '</div>';
      out += `${wrapStart}${title}<ul class="bul">${vis.map(bulletHTML).join('')}${hid.length?`<div class="hidden-items">${hid.map(bulletHTML).join('')}</div>`:''}</ul>${wrapEnd}`;
    }
    if(hiddenN) out += `<button class="more" data-more type="button">${ic('chevron-down')} <span>عرض كل النقاط (${p.bullet_count})</span></button>`;
    return out;
  }
  function optsHTML(p){
    if(!p.options.length) return '';
    return `<div class="opts">${p.options.map(o => `<div class="opt"><span class="k">${esc(o.name)}:</span>${o.values.slice(0,8).map(v => `<span class="v${v.available===false?' na':''}">${esc(v.name)}${v.extra?` +${fmt(v.extra)}`:''}</span>`).join('')}${o.values.length>8?`<span class="k">+${o.values.length-8}</span>`:''}</div>`).join('')}</div>`;
  }
  function priceHTML(p){
    const c = cur(p.currency);
    if(p.sale_price && p.regular_price) return `<span class="price">${fmt(p.sale_price)}<small>${c}</small></span><span class="was">${fmt(p.regular_price)} ${c}</span>`;
    return `<span class="price">${fmt(p.price)}<small>${c}</small></span>`;
  }
  function badges(p){
    let b = p.in_stock ? `<span class="pill good">${ic('check-circle-outline')} متوفر</span>` : `<span class="pill bad">نفدت الكمية</span>`;
    if(p.sale_price && p.regular_price) b += `<span class="pill sale">خصم ${Math.round((1-p.sale_price/p.regular_price)*100)}٪</span>`;
    if(p.type==='digital') b += `<span class="pill digital">${ic('cloud-download-outline')} رقمي</span>`;
    return b;
  }
  function cardHTML(p, idx){
    const img = p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy" decoding="async">` : `<div class="noimg">${ic('image-off-outline')}<span>بدون صورة</span></div>`;
    return `<article class="card" data-idx="${idx}">
      <div class="media" data-open="${idx}" role="button" tabindex="0" aria-label="فتح تفاصيل ${esc(p.name)}">${img}<div class="badges">${badges(p)}</div>${p.images.length>1?`<span class="imgcount">${p.images.length} صور</span>`:''}</div>
      <div class="body">
        <div class="meta"><span>${ic('shape-outline')}${esc(p.category)}</span>${p.brand?`<span>${ic('tag-outline')}${esc(p.brand)}</span>`:''}</div>
        <h3 title="${esc(p.name)}">${esc(p.name)}</h3>
        <div class="pricerow">${priceHTML(p)}${p.sold?`<span class="sold">بيع ${fmt(p.sold)} مرة</span>`:''}</div>
        ${optsHTML(p)}
        <div class="details">${groupsHTML(p, 5)}</div>
        <div class="foot"><span>#${p.id}</span><a href="#" data-open="${idx}">${ic('format-list-bulleted')} عرض التفاصيل</a><a href="${esc(p.url)}" target="_blank" rel="noopener">${ic('open-in-new')} صفحة المنتج</a></div>
      </div></article>`;
  }

  let current = [];
  function render(){
    current = filtered(); state.shown = 0;
    $('#grid').innerHTML = ''; more();
    $('#count').innerHTML = `عرض <b>${Math.min(state.shown,current.length)}</b> من <b>${current.length}</b> منتج` + (current.length!==P.length?` (من أصل ${P.length})`:'');
    if(!current.length) $('#grid').innerHTML = `<div class="nores">لا توجد منتجات مطابقة لهذه الفلاتر</div>`;
  }
  function more(){
    const slice = current.slice(state.shown, state.shown+PAGE);
    $('#grid').insertAdjacentHTML('beforeend', slice.map((p,i) => cardHTML(p, P.indexOf(p))).join(''));
    state.shown += slice.length;
    $('#loadmore').innerHTML = state.shown < current.length ? `<button class="btn primary" id="morebtn" type="button">${ic('chevron-down')} عرض ${Math.min(PAGE,current.length-state.shown)} منتجاً إضافياً (المتبقي ${current.length-state.shown})</button>` : '';
    $('#count').innerHTML = `عرض <b>${Math.min(state.shown,current.length)}</b> من <b>${current.length}</b> منتج` + (current.length!==P.length?` (من أصل ${P.length})`:'');
  }
  $('#loadmore').addEventListener('click', e => { if(e.target.closest('#morebtn')) more(); });
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(es => { if(es[0].isIntersecting && $('#morebtn')) more(); }, {rootMargin:'600px'}) : null;
  if(io) io.observe($('#loadmore'));

  $('#grid').addEventListener('click', e => {
    const m = e.target.closest('[data-more]'); if(m){ const c = m.closest('.card'); c.classList.toggle('open'); m.querySelector('span').textContent = c.classList.contains('open') ? 'إخفاء النقاط الإضافية' : `عرض كل النقاط (${P[c.dataset.idx].bullet_count})`; m.querySelector('use').setAttribute('href', c.classList.contains('open')?'#i-chevron-up':'#i-chevron-down'); return; }
    const o = e.target.closest('[data-open]'); if(o){ e.preventDefault(); openDlg(P[o.dataset.open]); }
  });
  $('#grid').addEventListener('keydown', e => { const o = e.target.closest('.media[data-open]'); if(o && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); openDlg(P[o.dataset.open]); } });

  /* dialog */
  const dlg = $('#dlg');
  function openDlg(p){
    const imgs = p.images;
    $('#dlgc').innerHTML = `
      <button class="dlg-close" type="button" data-close aria-label="إغلاق">${ic('close')}</button>
      <div class="dlg-media">
        <div class="main">${imgs[0]?`<img id="dlg-main" src="${esc(imgs[0])}" alt="${esc(p.name)}">`:`<div class="noimg">${ic('image-off-outline')}</div>`}</div>
        ${imgs.length>1?`<div class="thumbs">${imgs.map((u,i)=>`<button type="button" data-img="${esc(u)}" aria-current="${i===0}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}
      </div>
      <div class="dlg-body">
        <div class="meta"><span>${ic('shape-outline')}${esc(p.category)}</span>${p.brand?`<span>${ic('tag-outline')}${esc(p.brand)}</span>`:''}<span>#${p.id}</span></div>
        <h2 id="dlg-title">${esc(p.name)}</h2>
        <div class="badges" style="position:static">${badges(p)}</div>
        <div class="pricerow">${priceHTML(p)}${p.sold?`<span class="sold">بيع ${fmt(p.sold)} مرة</span>`:''}</div>
        ${p.summary?`<p style="margin:0;color:var(--muted);font-size:13.5px">${esc(p.summary)}</p>`:''}
        ${optsHTML(p)}
        <dl class="kv"><dt>النوع</dt><dd>${p.type==='digital'?'منتج رقمي (بدون شحن)':'منتج مادي'}</dd>${p.remaining!=null?`<dt>المتبقي</dt><dd>${fmt(p.remaining)}</dd>`:''}<dt>عدد النقاط</dt><dd>${p.bullet_count}</dd><dt>الرابط</dt><dd><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a></dd></dl>
        <div class="details">${groupsHTML(p, 1e9)}</div>
      </div>`;
    dlg.showModal();
  }
  dlg.addEventListener('click', e => { if(e.target.closest('[data-close]') || e.target===dlg) dlg.close(); const t = e.target.closest('[data-img]'); if(t){ $('#dlg-main').src = t.dataset.img; dlg.querySelectorAll('[data-img]').forEach(b => b.setAttribute('aria-current', b===t)); } });

  render();
})();
</script>
</body>
</html>
'''
out = page.replace('</style>', footer_html.CSS + '</style>', 1).replace('</main>', '</main>\n' + footer_html.render(FOOTER), 1).replace('__SPRITE__', sprite).replace('__DATA__', data_json).replace('__DATE__', generated)
open('catalog.html', 'w', encoding='utf-8').write(out)
print('catalog.html', len(out)//1024, 'KB', len(P), 'products', len(names), 'icons')
