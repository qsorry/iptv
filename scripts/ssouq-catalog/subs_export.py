# -*- coding: utf-8 -*-
"""subscriptions.json -> subscriptions-import.csv for the platform's /admin/products/import page.
Description is HTML (rendered by the storefront) with icon bullets (inline MDI SVG) and hosted guide images."""
import json, csv, subprocess, html
P = json.load(open('subscriptions.json', encoding='utf-8'))
icons = sorted({i['icon'] for p in P for g in p['groups'] for i in g['items']} | {l['icon'] for p in P for l in p['links']})
js = "const m=require('@mdi/js');const out={};for(const n of %s){out[n]=m['mdi'+n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join('')]||null}console.log(JSON.stringify(out))" % json.dumps(icons)
paths = json.loads(subprocess.check_output(['node', '-e', js], cwd='mdi'))
def svg(name):
    return ('<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="flex:none;margin-top:3px;fill:#004d73;background:#dbe9f0;border-radius:6px;padding:2px">'
            '<path d="%s"/></svg>' % paths[name])
LI = 'style="display:flex;gap:8px;align-items:flex-start;margin:0 0 6px"'
def desc_html(p):
    out = []
    if p['summary']: out.append('<p>%s</p>' % html.escape(p['summary']))
    for g in p['groups']:
        if g['title']: out.append('<h3 style="margin:16px 0 8px;font-size:15px">%s</h3>' % html.escape(g['title']))
        items = ''.join('<li %s>%s<span>%s</span></li>' % (LI, svg(i['icon']), ('<b>%s:</b> %s' % (html.escape(i['key']), html.escape(i['value']))) if i.get('key') else html.escape(i['text'])) for i in g['items'])
        out.append('<ul style="list-style:none;padding:0;margin:0">%s</ul>' % items)
    if p['links']:
        out.append('<h3 style="margin:16px 0 8px;font-size:15px">روابط التحميل والشرح</h3><ul style="list-style:none;padding:0;margin:0">%s</ul>' % ''.join(
            '<li %s>%s<a href="%s" target="_blank" rel="noopener">%s</a></li>' % (LI, svg(l['icon']), html.escape(l['href']), html.escape(l['text'])) for l in p['links']))
    if p['guide_images']:
        out.append('<h3 style="margin:16px 0 8px;font-size:15px">صور الشرح والتثبيت</h3><div style="display:flex;flex-wrap:wrap;gap:8px">%s</div>' % ''.join(
            '<img src="%s" alt="" loading="lazy" style="max-width:100%%;width:220px;height:auto;border-radius:8px;border:1px solid #d5dee5">' % html.escape(g['src']) for g in p['guide_images']))
    return ''.join(out)
with open('subscriptions-import.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator='\n')
    w.writerow(['name', 'price', 'short_description', 'description', 'images', 'type', 'status'])
    for p in P:
        w.writerow([p['name'], '%.2f' % (p['sale_price'] or p['price']), p['summary'] or (p['groups'][0]['items'][0]['text'] if p['groups'] else ''),
                    desc_html(p), '|'.join(im['src'] for im in p['images']), 'digital', 'active'])
print('rows', len(P))
