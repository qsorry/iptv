# -*- coding: utf-8 -*-
"""Merge storefront API + admin API + scraped page data for the digital-subscriptions category
into subscriptions.json (cleaned, bullet groups with MDI icons, hosted image paths)."""
import json, re, html
from catalog_lib import to_bullets, pick_icon, ZW
from bs4 import BeautifulSoup

HOST = 'https://com.ssouq.net/media/subscriptions/'
recs = json.load(open('subs/subs_raw.json', encoding='utf-8'))
pages = {r['id']: r for r in json.load(open('subs/pages_parsed.json', encoding='utf-8'))}
man = json.load(open('subs/image_manifest.json', encoding='utf-8'))

def hosted(url):
    rel = man.get(url)
    return {'src': HOST + rel, 'path': 'public/media/subscriptions/' + rel, 'original': url} if rel else None

AR_NUM = {'يوم': (1, 'day'), 'ثلاثة': 3, 'ثلاث': 3, 'ستة': 6, 'ست': 6, 'سنه': 12, 'سنة': 12, 'سنتين': 24}
def duration_months(name):
    n = name.lower()
    m = re.search(r'(\d+)\s*(شهر|اشهر|أشهر|month)', n)
    if m: return int(m.group(1))
    if 'سنتين' in n: return 24
    if re.search(r'\bسنه\b|\bسنة\b|year', n): return 12
    for w, v in (('ثلاثة', 3), ('ثلاث', 3), ('ستة', 6), ('ست ', 6)):
        if w in n: return v
    if 'يوم' in n: return 0
    return None
def devices(name):
    n = name
    if 'جهازين' in n or 'جهازان' in n: return 2
    m = re.search(r'(\d+)\s*(جهاز|أجهزة|اجهزة)', n)
    if m: return int(m.group(1))
    if 'جهاز واحد' in n: return 1
    return 1
def family(name, brand):
    n = name.lower()
    if 'falcon' in n or 'فالكون' in n or (brand or '').lower() in ('فالكون', 'falcon'): return 'Falcon TV Pro'
    if 'webos' in n or 'سامسونج' in n or 'ال جي' in n or 'lg' in n.split(): return 'Samsung / LG (webOS)'
    if 'لوحة تحكم' in n or 'موزع' in n: return 'لوحة تحكم الموزعين'
    if 'كاسبر' in n: return 'Casper'
    return 'IPTV Smarters / سمارت'
def platform_tags(name, desc_text):
    t = (name + ' ' + desc_text).lower(); tags = []
    if re.search(r'أندرويد|اندرويد|android', t): tags.append('Android')
    if re.search(r'آيفون|ايفون|iphone|ios\b|ايباد|ipad|apple', t): tags.append('iOS')
    if re.search(r'webos|سامسونج|samsung|ال جي|\blg\b|tizen', t): tags.append('Samsung / LG')
    if re.search(r'windows|ويندوز|كمبيوتر|\bpc\b|لاب توب', t): tags.append('Windows / PC')
    if re.search(r'شاومي|xiaomi|mi box|رسيفر|receiver|tv box', t): tags.append('TV Box')
    return tags

out = []
for r in recs:
    st, ad = r['store'], r['admin']
    pg = pages.get(ad['id'], {})
    name = re.sub(r'\s+', ' ', ZW.sub('', html.unescape(pg.get('name') or st['name']))).strip()
    desc_html = ad.get('description') or pg.get('description_html') or ''
    soup = BeautifulSoup(desc_html, 'lxml')
    desc_text = soup.get_text(' ')
    # download / help links inside the description
    links = []
    for a in soup.find_all('a', href=True):
        href = a['href'].strip(); txt = re.sub(r'\s+', ' ', a.get_text(' ')).strip()
        if not href.startswith('http') or any(l['href'] == href for l in links): continue
        txt = ZW.sub('', txt).strip()
        if not txt:
            hl = href.lower()
            txt = 'شرح التثبيت' if 'ssouq.com' in hl and 'page-' in hl else 'تطبيق أندرويد (APK)' if '.apk' in hl else 'تطبيق iOS' if 'apple.com' in hl else 'برنامج Windows' if 'windows' in hl or '.exe' in hl else 'رابط'
        links.append({'href': href, 'text': txt,
                      'icon': 'apple' if 'apple.com' in href else 'android' if '.apk' in href or 'android' in href.lower() else 'microsoft-windows' if 'windows' in href.lower() or '.exe' in href else 'link-variant'})
    gallery = [hosted(im['url']) for im in ad['images']]
    if st.get('original_image') and hosted(st['original_image']) and hosted(st['original_image'])['src'] not in [g['src'] for g in gallery if g]:
        gallery.append(hosted(st['original_image']))
    gallery = [g for g in gallery if g]
    # dedupe gallery by hosted src
    seen = set(); gallery = [g for g in gallery if not (g['src'] in seen or seen.add(g['src']))]
    desc_imgs = []
    for u in re.findall(r'<img[^>]+src="([^"]+)"', desc_html):
        h = hosted(u)
        if h and h['src'] not in [d['src'] for d in desc_imgs]: desc_imgs.append(h)
    groups = to_bullets(desc_html, (ad.get('metadata') or {}).get('description') or '')
    NOISE = re.compile(r'اضغط على (الصورة|صورة)|يرجى الضغط على صورة|وهذه ايقونته')
    for g in groups: g['items'] = [i for i in g['items'] if not NOISE.search(i['text'])]
    groups = [g for g in groups if g['items']]
    months = duration_months(name)
    price = st.get('price') or pg.get('price')
    on_sale = bool(st.get('is_on_sale')) and st.get('regular_price') and st.get('sale_price') and st['sale_price'] < st['regular_price']
    p = {
        'id': ad['id'], 'name': name, 'url': st['url'], 'brand': (ad.get('brand') or {}).get('name') or '',
        'category': 'الاشتراكات الرقمية', 'family': family(name, (ad.get('brand') or {}).get('name')),
        'promotion': st.get('promotion_title') or (ad.get('promotion') or {}).get('title') or '',
        'seo_title': (ad.get('metadata') or {}).get('title') or '', 'seo_description': (ad.get('metadata') or {}).get('description') or '',
        'price': price, 'currency': 'SAR', 'price_includes_tax': True,
        'sale_price': st['sale_price'] if on_sale else None, 'regular_price': st['regular_price'] if on_sale else None,
        'pre_tax_price': (ad.get('pre_tax_price') or {}).get('amount'),
        'in_stock': bool(st.get('is_available')) and not st.get('is_out_of_stock'),
        'quantity': ad.get('quantity'), 'sold': ad.get('sold_quantity') or pg.get('sold'),
        'rating': ({'rate': round(ad['rating']['rate'], 1), 'count': ad['rating']['count']} if (ad.get('rating') or {}).get('rate') else {'rate': None, 'count': 0}),
        'type': ad.get('type') or pg.get('product_type'), 'requires_shipping': bool(ad.get('require_shipping')),
        'duration_months': months, 'devices': devices(name), 'platforms': platform_tags(name, desc_text),
        'price_per_month': round(price / months, 2) if price and months else None,
        'images': gallery, 'guide_images': desc_imgs, 'links': links,
        'summary': (ad.get('metadata') or {}).get('description') or '',
        'groups': groups, 'bullet_count': sum(len(g['items']) for g in groups),
        'updated_at': ad.get('updated_at'),
    }
    out.append(p)
out.sort(key=lambda p: (p['family'], p['duration_months'] or 0, p['devices'], p['price'] or 0))
json.dump(out, open('subscriptions.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for p in out:
    print(p['id'], p['family'], '|', p['duration_months'], 'mo x', p['devices'], '|', p['price'], p['sale_price'], '|', p['in_stock'], 'sold', p['sold'], 'rating', p['rating'], '| imgs', len(p['images']), 'guides', len(p['guide_images']), 'links', len(p['links']), '| bullets', p['bullet_count'], '|', p['name'][:45])
