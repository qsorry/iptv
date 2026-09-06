# -*- coding: utf-8 -*-
"""Clean raw scraped products -> structured products.json with bullet groups + MDI icons."""
import json, re, html, collections
from catalog_lib import infer_category, to_bullets, title_case_name, ZW

RAW = json.load(open('raw_products.json', encoding='utf-8'))
products = []
for r in RAW:
    if not r.get('name'): continue   # redirected to homepage = removed product
    p = {
        'id': r['id'],
        'name': title_case_name(r['name']),
        'url': r.get('url'),
        'brand': (r.get('brand') or '').strip(),
        'category': None,
        'price': r.get('price'),
        'sale_price': (r.get('sale_price') if r.get('sale_price') and r.get('regular_price') and r['sale_price'] < r['regular_price'] else None),
        'regular_price': r.get('regular_price'),
        'currency': r.get('currency') or 'SAR',
        'in_stock': r.get('availability') == 'InStock',
        'sold': r.get('sold'),
        'remaining': r.get('remaining'),
        'type': 'digital' if r.get('product_type') == 'codes' or not r.get('requires_shipping') else 'physical',
        'images': r.get('images') or ([r['main_image']] if r.get('main_image') else []),
        'options': [o for o in (r.get('options') or []) if o.get('values')],
        'summary': ('' if 'يقدم كل ماهو جديد من المنتجات' in (r.get('meta_description') or '') else re.sub(r'\s+', ' ', ZW.sub('', html.unescape(r.get('meta_description') or ''))).strip()[:220]),
        'groups': to_bullets(r.get('description_html'), r.get('meta_description')),
    }
    p['category'] = infer_category(p)
    p['bullet_count'] = sum(len(g['items']) for g in p['groups'])
    products.append(p)

products.sort(key=lambda p: (not p['in_stock'], p['category'], -(p['sold'] or 0), p['name']))
json.dump(products, open('products.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(products), 'products')
print('categories', collections.Counter(p['category'] for p in products).most_common())
print('icons', collections.Counter(i['icon'] for p in products for g in p['groups'] for i in g['items']).most_common(60))
print('no bullets', sum(1 for p in products if p['bullet_count']==0))
print('avg bullets', sum(p['bullet_count'] for p in products)/len(products))
