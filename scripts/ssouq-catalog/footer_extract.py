"""Extract footer data (contacts, social, licences, payment methods, policy pages) from https://ssouq.com.

Sources
- The storefront homepage: Salla injects the store config into `twilight::init` (contacts, social links,
  commercial registration, tax number, Saudi Business Center certificate, enabled payment methods).
- The static pages listed in the sitemap under /ar/p/<slug>: their `.content-entry` body is cleaned into
  plain semantic HTML (no classes / inline styles) so it can be stored in the platform `pages` table.

Output: data/salla-import/store-footer.json  (consumed by scripts/seed-imports.mjs on container boot
and by subs_build.py for the HTML preview) + public/media/store/business-center-certificate.jpg.

Run:  python3 footer_extract.py   (stdlib only)
"""
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "salla-import" / "store-footer.json"
CERT_IMG = ROOT / "public" / "media" / "store" / "business-center-certificate.jpg"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
BASE = "https://ssouq.com"

# slug on ssouq.com -> (platform slug, footer group, MDI icon)
PAGES = [
    ("من-نحن", "about", "company", "information-outline"),
    ("اتصل-بنا", "contact", "company", "headset"),
    ("الأسئلة-الشائعة", "faq", "company", "help-circle-outline"),
    ("معلومات-الدفع-والتوصيل", "shipping-payment", "policies", "truck-delivery-outline"),
    ("سياسية-الإستبدال-والإرجاع", "return-policy", "policies", "package-variant-closed"),
    ("سياسة-الخصوصية", "privacy-policy", "policies", "shield-lock-outline"),
]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ar"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def clean_entry(fragment: str) -> str:
    """Salla stores Quill output: strip classes/styles/spans/&nbsp;, drop empty blocks, keep semantics."""
    s = fragment
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s, flags=re.S)
    s = re.sub(r"<img[^>]*>", "", s)
    s = re.sub(r"</?span[^>]*>", "", s)
    s = re.sub(r"<(\w+)[^>]*>", lambda m: f"<{m.group(1).lower()}>" if m.group(1).lower() != "a" else m.group(0), s)
    s = re.sub(r'<a\s[^>]*href="([^"]*)"[^>]*>', lambda m: f'<a href="{m.group(1)}" rel="noopener">', s)
    s = s.replace("&nbsp;", " ").replace("\xa0", " ")
    s = re.sub(r"<(strong|em|b|i)>\s*</\1>", "", s)
    s = re.sub(r"<(p|li|h\d)>[\s\\]*(<br\s*/?>)?[\s\\]*</\1>", "", s)
    s = re.sub(r"<p>\s*<br\s*/?>\s*</p>", "", s)
    s = re.sub(r"\s*<br\s*/?>\s*", "<br>", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r">\s+<", "><", s)
    return s.strip()


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def main() -> None:
    home = get(BASE + "/").decode("utf-8", "ignore")
    i = home.find("salla.event.dispatchEvents(")
    if i < 0:
        sys.exit("twilight::init config not found on homepage")
    events, _ = json.JSONDecoder().raw_decode(home, home.index("{", i))
    cfg = events["twilight::init"]["store"]
    st = cfg["settings"]
    contacts = cfg.get("contacts") or {}
    social = cfg.get("social") or {}
    email = contacts.get("email") or ""

    pages = []
    for src, slug, group, icon in PAGES:
        raw = get(f"{BASE}/ar/p/{urllib.parse.quote(src)}").decode("utf-8", "ignore")
        t = re.search(r'<div class="content content--single-page[^"]*">\s*<h1[^>]*>(.*?)</h1>\s*<div class="content-entry">(.*?)</div>\s*<salla-comments', raw, re.S)
        if not t:
            print("skip (no content):", src)
            continue
        title = html.unescape(t.group(1)).strip()
        body = clean_entry(t.group(2))
        # Cloudflare obfuscates emails in the HTML; restore the public address.
        body = re.sub(r'<a href="/cdn-cgi/l/email-protection[^"]*"[^>]*>.*?</a>', f'<a href="mailto:{email}">{email}</a>', body, flags=re.S)
        body = body.replace("[email protected]", email)
        # The source runs three return conditions into one sentence; split them into a list.
        body = body.replace(
            "<p>يجب ان يكون المنتج جديد ولم يستعمليجب ان يكون التغليف بحالته الأصلية وغير تالفوجود الفاتورة الأصلية</p>",
            "<ul><li>يجب ان يكون المنتج جديد ولم يستعمل</li><li>يجب ان يكون التغليف بحالته الأصلية وغير تالف</li><li>وجود الفاتورة الأصلية</li></ul>",
        )
        pages.append({
            "slug": slug, "title": title, "group": group, "icon": icon,
            "source": f"{BASE}/ar/p/{src}", "seoDescription": text_of(body)[:160], "body": body,
        })
        print("page:", title, len(body))

    cert = st.get("certificate") or {}
    if cert.get("image"):
        CERT_IMG.parent.mkdir(parents=True, exist_ok=True)
        CERT_IMG.write_bytes(get(cert["image"]))

    payments = st.get("payments") or []
    # ids mirror salla-payments; extra methods listed on the store's own payment page are appended.
    data = {
        "extracted_at": date.today().isoformat(),
        "source": BASE + "/",
        "store": {"name": cfg["name"], "url": cfg["url"], "description": text_of(cfg.get("description") or ""), "logo": cfg.get("logo"), "icon": cfg.get("icon")},
        "contact": {
            "legal_name": "مؤسسة الجرعة الزائدة التجارية",
            "phone": contacts.get("mobile") or "",
            "whatsapp": contacts.get("whatsapp") or "",
            "email": email,
            "address": "الخالدية - الشارع الخامس، الدمام، المملكة العربية السعودية",
        },
        "social": {k: v for k, v in social.items() if v},
        "licenses": {
            "commercial_number": st.get("commercial_number"),
            "tax_number": (st.get("tax") or {}).get("number"),
            "tax_certificate": (st.get("tax") or {}).get("certificate"),
            "freelance_number": st.get("freelance_number"),
            "business_center_certificate": {
                "id": cert.get("id"), "image": cert.get("image"),
                "local": "/media/store/business-center-certificate.jpg" if cert.get("image") else None,
                "verify_url": f"https://eauthenticate.saudibusiness.gov.sa/certificate-details/{cert['id']}" if cert.get("id") else None,
            },
        },
        "payments": payments,
        "pages": pages,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT.relative_to(ROOT), "pages:", len(pages), "payments:", payments)


if __name__ == "__main__":
    main()
