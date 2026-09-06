# -*- coding: utf-8 -*-
"""Shared footer for the single-file HTML previews (catalog.html, subscriptions.html).

Reads data/salla-import/store-footer.json (produced by footer_extract.py) and returns the CSS, the markup
and the MDI icon names it needs, so each builder can add the icons to its sprite and drop the footer in
before </body>. The layout mirrors src/components/storefront/store-footer.tsx (same sections, same icons)
and uses the preview's own design tokens (--surface, --line, --muted, --accent, --radius).
"""
import html
import json
import os

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'salla-import', 'store-footer.json')
MEDIA_HOST = 'https://com.ssouq.net'

PAYMENTS = {
    'mada': ('مدى', 'credit-card-chip-outline'),
    'credit_card': ('فيزا / ماستركارد', 'credit-card-outline'),
    'apple_pay': ('Apple Pay', 'apple'),
    'stc_pay': ('STC Pay', 'cellphone'),
    'bank_transfer': ('تحويل بنكي', 'bank-outline'),
    'cod': ('الدفع عند الاستلام', 'cash-multiple'),
}
SOCIAL = [('instagram', 'instagram', 'إنستغرام'), ('snapchat', 'snapchat', 'سناب شات'), ('facebook', 'facebook', 'فيسبوك'),
          ('twitter', 'twitter', 'إكس'), ('youtube', 'youtube', 'يوتيوب')]

CSS = r'''
/* footer (shared with the storefront StoreFooter component) */
.sf{margin-top:32px;border-top:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:14px;padding-bottom:env(safe-area-inset-bottom)}
.sf-in{max-width:1360px;margin:0 auto;padding:0 16px}
.sf-grid{display:grid;grid-template-columns:1fr;gap:28px;padding:32px 0}
@media(min-width:640px){.sf-grid{grid-template-columns:1fr 1fr}} @media(min-width:1024px){.sf-grid{grid-template-columns:1.3fr 1fr 1fr 1fr;gap:24px;padding:40px 0}}
.sf h3{font-size:14px;font-weight:700;margin:0 0 10px}
.sf-brand{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:700;font-size:16px;color:inherit;text-decoration:none}
.sf-brand img{width:40px;height:40px;border-radius:999px;object-fit:cover;border:1px solid var(--line);background:#fff}
.sf-desc{color:var(--muted);max-width:320px;line-height:1.7;margin:12px 0 0}
.sf-social{display:flex;gap:8px;flex-wrap:wrap;list-style:none;margin:16px 0 0;padding:0}
.sf-social a{width:40px;height:40px;border-radius:999px;border:1px solid var(--line);background:var(--ground);color:var(--muted);display:grid;place-items:center}
.sf-social a:hover{border-color:var(--accent);color:var(--accent-text)}
.sf ul.sf-list{list-style:none;margin:0;padding:0}
.sf-list a,.sf-list .sf-row{display:flex;align-items:center;gap:10px;min-height:36px;padding:4px 0;color:var(--muted);text-decoration:none}
.sf-list a:hover{color:var(--accent-text)} .sf-list svg.ic{width:18px;height:18px;opacity:.85} .sf-list .sf-row{align-items:flex-start} .sf-list .sf-row svg.ic{margin-top:4px}
.sf-legal{border-top:1px solid var(--line)} .sf-legal .sf-in{display:flex;flex-direction:column;gap:14px;padding:18px 16px}
@media(min-width:1024px){.sf-legal .sf-in{flex-direction:row;align-items:center;justify-content:space-between}}
.sf-lic{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;list-style:none;margin:0;padding:0;font-size:12px;color:var(--muted)}
.sf-lic li>a,.sf-lic li>span{display:inline-flex;align-items:center;gap:6px;color:inherit;text-decoration:none} .sf-lic li>a:hover{color:var(--accent-text)}
.sf-lic b{color:var(--ink);font-weight:600;direction:ltr;unicode-bidi:embed} .sf-lic svg.ic{width:16px;height:16px}
.sf-lic img{height:40px;width:auto;border:1px solid var(--line);border-radius:6px;background:#fff;display:block}
.sf-pay{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}
.sf-pay li{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--ground);font-size:12px;font-weight:500}
.sf-pay svg.ic{width:16px;height:16px;color:var(--muted)}
.sf-copy{border-top:1px solid var(--line)} .sf-copy .sf-in{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px;font-size:12px;color:var(--muted);text-align:center}
@media(min-width:640px){.sf-copy .sf-in{flex-direction:row;justify-content:space-between;text-align:start}}
.sf-copy span{display:inline-flex;align-items:center;gap:6px} .sf-copy svg.ic{width:14px;height:14px}
'''


def load(path=DATA_PATH):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def icon_names(data):
    names = {'store-outline', 'phone-outline', 'whatsapp', 'email-outline', 'map-marker-outline', 'post-outline', 'lock-outline',
             'certificate-outline', 'receipt-text-outline', 'check-decagram-outline', 'open-in-new', 'office-building-outline',
             'file-document-outline'}
    names |= {i for _, i, _ in SOCIAL}
    names |= {PAYMENTS[p][1] for p in data.get('payments', []) if p in PAYMENTS}
    names |= {pg.get('icon') or 'file-document-outline' for pg in data.get('pages', [])}
    return sorted(names)


def render(data, page_href=lambda pg: pg['source'], year=None):
    """Return the footer markup. page_href maps a page dict to its link (defaults to the live ssouq.com page)."""
    e = html.escape
    ic = lambda n: '<svg class="ic" aria-hidden="true"><use href="#i-%s"/></svg>' % n
    st, c, so, lic = data['store'], data.get('contact', {}), data.get('social', {}), data.get('licenses', {})
    cert = lic.get('business_center_certificate') or {}
    pages = data.get('pages', [])
    company = [p for p in pages if p.get('group') == 'company']
    policies = [p for p in pages if p.get('group') == 'policies']
    link = lambda pg: '<li><a href="%s">%s%s</a></li>' % (e(page_href(pg)), ic(pg.get('icon') or 'file-document-outline'), e(pg['title']))
    year = year or __import__('datetime').date.today().year

    social = ''.join('<li><a href="%s" target="_blank" rel="noopener" aria-label="%s" title="%s">%s</a></li>' % (e(so[k]), lbl, lbl, ic(i))
                     for k, i, lbl in SOCIAL if so.get(k))
    contact = []
    if c.get('phone'): contact.append('<li><a href="tel:%s">%s<span dir="ltr">%s</span></a></li>' % (e(c['phone']), ic('phone-outline'), e(c['phone'])))
    if c.get('whatsapp'): contact.append('<li><a href="https://wa.me/%s" target="_blank" rel="noopener">%sواتساب <span dir="ltr">%s</span></a></li>' % (''.join(ch for ch in c['whatsapp'] if ch.isdigit()), ic('whatsapp'), e(c['whatsapp'])))
    if c.get('email'): contact.append('<li><a href="mailto:%s">%s<span dir="ltr">%s</span></a></li>' % (e(c['email']), ic('email-outline'), e(c['email'])))
    if c.get('address'): contact.append('<li><div class="sf-row">%s<span>%s</span></div></li>' % (ic('map-marker-outline'), e(c['address'])))

    legal = []
    if lic.get('commercial_number'): legal.append('<li><span>%s السجل التجاري: <b>%s</b></span></li>' % (ic('certificate-outline'), e(lic['commercial_number'])))
    if lic.get('tax_number'): legal.append('<li><span>%s الرقم الضريبي: <b>%s</b></span></li>' % (ic('receipt-text-outline'), e(lic['tax_number'])))
    if cert.get('id'):
        body = '%s شهادة المركز السعودي للأعمال: <b>%s</b>' % (ic('check-decagram-outline'), e(cert['id']))
        legal.append('<li><a href="%s" target="_blank" rel="noopener" title="التحقق من الشهادة">%s%s</a></li>' % (e(cert.get('verify_url') or '#'), body, ic('open-in-new')) if cert.get('verify_url') else '<li><span>%s</span></li>' % body)
    img = cert.get('local') and (MEDIA_HOST + cert['local'])
    if img:
        fb = ' onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute(\'data-fb\')}" data-fb="%s"' % e(cert['image']) if cert.get('image') else ''
        legal.append('<li><a href="%s" target="_blank" rel="noopener" title="شهادة توثيق المتجر"><img src="%s"%s alt="شهادة توثيق المتجر من المركز السعودي للأعمال" loading="lazy"></a></li>' % (e(cert.get('verify_url') or img), e(img), fb))
    pay = ''.join('<li>%s%s</li>' % (ic(PAYMENTS[p][1]), e(PAYMENTS[p][0])) for p in data.get('payments', []) if p in PAYMENTS)

    logo = ('<img src="%s" alt="%s">' % (e(st['logo']), e(st['name']))) if st.get('logo') else ic('store-outline')
    return '''<footer class="sf" aria-label="ذيل الصفحة">
  <div class="sf-in sf-grid">
    <div>
      <a class="sf-brand" href="%(url)s">%(logo)s<span>%(name)s</span></a>
      %(desc)s
      %(social)s
    </div>
    <nav aria-label="روابط مهمة"><h3>روابط مهمة</h3><ul class="sf-list">%(company)s<li><a href="%(url)sblog">%(post)sالمدونة</a></li><li><a href="%(url)scustomer/profile">%(lock)sحسابي وطلباتي</a></li></ul></nav>
    %(policies)s
    %(contact)s
  </div>
  %(legal)s
  <div class="sf-copy"><div class="sf-in"><span>© %(year)s %(name)s — جميع الحقوق محفوظة</span>%(legalname)s</div></div>
</footer>''' % {
        'url': e(st['url']), 'logo': logo, 'name': e(st['name']),
        'desc': '<p class="sf-desc">%s</p>' % e(st['description']) if st.get('description') else '',
        'social': '<ul class="sf-social" aria-label="حساباتنا على التواصل الاجتماعي">%s</ul>' % social if social else '',
        'company': ''.join(link(p) for p in company), 'post': ic('post-outline'), 'lock': ic('lock-outline'),
        'policies': '<nav aria-label="السياسات"><h3>السياسات</h3><ul class="sf-list">%s</ul></nav>' % ''.join(link(p) for p in policies) if policies else '',
        'contact': '<address style="font-style:normal"><h3>تواصل معنا</h3><ul class="sf-list">%s</ul></address>' % ''.join(contact) if contact else '',
        'legal': '<div class="sf-legal"><div class="sf-in">%s%s</div></div>' % (
            '<ul class="sf-lic">%s</ul>' % ''.join(legal) if legal else '',
            '<ul class="sf-pay" aria-label="طرق الدفع المتاحة">%s</ul>' % pay if pay else '') if (legal or pay) else '',
        'year': year,
        'legalname': '<span>%s%s</span>' % (ic('office-building-outline'), e(c['legal_name'])) if c.get('legal_name') else '',
    }
