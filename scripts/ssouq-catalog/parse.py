import glob, re, json, html, sys
from bs4 import BeautifulSoup

def text_of(el):
    return re.sub(r'\s+', ' ', el.get_text(' ', strip=True)).strip()

def parse(path):
    s = open(path, encoding='utf-8').read()
    soup = BeautifulSoup(s, 'lxml')
    pid = int(re.search(r'(\d+)\.html$', path).group(1))
    out = {'id': pid}
    h1 = soup.select_one('[data-testid="store-product-title"]')
    out['name'] = text_of(h1) if h1 else None
    can = soup.find('link', rel='canonical')
    out['url'] = can['href'] if can else None
    md = soup.find('meta', attrs={'name': 'description'})
    out['meta_description'] = html.unescape(md['content']).strip() if md and md.get('content') else ''
    # JSON-LD product
    for sc in soup.find_all('script', type='application/ld+json'):
        try: d = json.loads(sc.string or '')
        except Exception: continue
        g = d.get('@graph') if isinstance(d, dict) else None
        if g:
            for n in g:
                if n.get('@type') == 'Product':
                    off = n.get('offers', {})
                    out['price'] = off.get('price')
                    out['currency'] = off.get('priceCurrency')
                    out['availability'] = (off.get('availability') or '').split('/')[-1]
    # price block (sale / regular)
    pb = soup.select_one('[data-testid="store-product-price"]')
    out['sale_price'] = None; out['regular_price'] = None
    if pb:
        sale = pb.select_one('.text-red-800')
        before = pb.select_one('.line-through')
        onsale_wrapper = sale.find_parent('div') if sale else None
        is_on_sale = onsale_wrapper is not None and 'hidden' not in (onsale_wrapper.get('class') or [])
        if is_on_sale and sale and before:
            try:
                out['sale_price'] = float(re.sub(r'[^\d.]', '', sale.get_text()))
                out['regular_price'] = float(re.sub(r'[^\d.]', '', before.get_text()))
            except ValueError: pass
    # events json (brand, sku, image)
    m = re.search(r'"Product Viewed":\[(\{.*?\})\]', s)
    if m:
        try:
            ev = json.loads(m.group(1))
            out['brand'] = ev.get('brand') or ''
            out['sku'] = ev.get('sku') or ''
            out['main_image'] = ev.get('image_url') or ev.get('image')
            if out.get('price') is None: out['price'] = ev.get('price')
        except Exception: pass
    # images
    imgs = []
    for a in soup.select('salla-slider [slot="items"] a[data-type="image"]'):
        if a.get('href') and a['href'] not in imgs: imgs.append(a['href'])
    if not imgs:
        for im in soup.select('salla-slider [slot="items"] img'):
            if im.get('src') and im['src'] not in imgs: imgs.append(im['src'])
    out['images'] = imgs
    if not out.get('main_image') and imgs: out['main_image'] = imgs[0]
    # description
    art = soup.select_one('.product__description article')
    out['description_html'] = art.decode_contents().strip() if art else ''
    # sold / remaining
    m = re.search(r'تم شراؤه\s*<span><span>(\d+)</span>', s)
    out['sold'] = int(m.group(1)) if m else None
    m = re.search(r'المتبقي\s*<span>(\d+)</span>', s)
    out['remaining'] = int(m.group(1)) if m else None
    btn = soup.select_one('salla-add-product-button')
    out['product_status'] = btn.get('product-status') if btn else None
    out['product_type'] = btn.get('product-type') if btn else None
    out['requires_shipping'] = bool(btn is not None and btn.has_attr('required-shipping'))
    # options
    opts = []
    po = soup.select_one('salla-product-options')
    if po and po.get('options'):
        try:
            for o in json.loads(html.unescape(po['options'])):
                opts.append({'name': o.get('name'), 'type': o.get('type'),
                             'values': [{'name': d.get('name'), 'extra': d.get('additional_price'), 'available': d.get('is_out') is not True} for d in (o.get('details') or [])]})
        except Exception as e: pass
    out['options'] = opts
    # rating
    m = re.search(r'"rating":\{[^}]*"rate":([\d.]+)', s)
    return out

if __name__ == '__main__':
    files = sorted(glob.glob('pages/*.html'))
    rows = [parse(f) for f in files]
    json.dump(rows, open('raw_products.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(rows), 'parsed')
    import collections
    print('no name', sum(1 for r in rows if not r['name']))
    print('empty desc', sum(1 for r in rows if not r['description_html']))
    print('no images', sum(1 for r in rows if not r['images']))
    print('availability', collections.Counter(r.get('availability') for r in rows))
    print('on sale', sum(1 for r in rows if r['sale_price']))
    print('with options', sum(1 for r in rows if r['options']))
    print('brands', collections.Counter(r.get('brand') for r in rows).most_common(15))
