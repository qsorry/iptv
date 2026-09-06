# -*- coding: utf-8 -*-
"""Clean raw scraped products -> structured products.json with bullet groups + MDI icons."""
import json, re, html, collections
from bs4 import BeautifulSoup, NavigableString

RAW = json.load(open('raw_products.json', encoding='utf-8'))

# ---------- category inference ----------
CATS = [
 ('الاشتراكات الرقمية', r'iptv|اشتراك|بث|falcon|فالكون|smarters|قنوات'),
 ('الأزياء والإكسسوارات', r'سلسال|سلسلة|roxi|كالفن|calvin|حامل بطاقة|card case|جزمة|حذاء|أحذية|shoes?|sneaker|yeezy|adidas|nike|فستان|dress|قميص|shirt|بنطلون|جاكيت|jacket|عباية|توري بورش|tory|كوتش|coach|كيت سبيد|kate spade|أقنر|aigner|تومي|tommy|مايكل كورس|michael kors|\bmk\b|تيد بيكر|ted baker|سواروفيسكي|swarovski|guess|fossil|aldo|شنطة|شنط|حقيبة|حقائب|محفظة|كروس|\bbag\b|wallet|clutch|tote|backpack|أسورة|سوار|قلادة|عقد|خاتم|bracelet|necklace|ring|earring|حلق|ساعة يد|watch|نظارة|sunglass|حزام|belt'),
 ('القهوة وأدواتها', r'قهوة|كبسلا|ستارباكس|ستارباکس|starbucks|سبريسو|بريفيل|سماور|غلاية|شاهي|كتلي|samovar|كبسول|دولتشي|dolce|نسبريسو|nespresso|ديلونجي|delonghi|espresso|coffee|باريستا|barista|سايفون|سيفون|v60|كيمكس|chemex|كوب|أكواب|شاي|tea|مطحنة|grinder|ماكينة|machine|فلتر|filter|إبريق|كتلي|kettle|موكا|moka|لاتيه|تامبر|tamper|double shot|sage|breville|ترمس|حليب|milk'),
 ('العناية الشخصية والجمال', r'شامبو|shampoo|بلسم|conditioner|شعر|hair|زيت|oil|كريم|cream|بشرة|skin|أسنان|teeth|dental|crest|فرشاة|brush|philips|sonicare|oral|ipl|إزالة الشعر|حلاقة|shav|عطر|perfume|مساج|massag|صبغة|crazy color|olaplex|لوريال|loreal|l\'oreal|manuka|مانوكا|عسل|honey|سيروم|serum|مكياج|makeup|أظافر|nail|mane|تبييض|whiten|ماسك|mask|لوشن|lotion|صابون|soap'),
 ('الإلكترونيات والشبكات', r'جوال|oneplus|هاتف|phone|شاحن|charger|سماعة|سماعات|headphone|earbud|بلوتوث|bluetooth|كاميرا|camera|litebeam|ubiquiti|راوتر|router|شبكة|network|واي فاي|wifi|كمبيوتر|لابتوب|laptop|usb|طابعة|printer|حبر|ink|cartridge|toner|ساعة ذكية|smart watch|smartwatch|تلفزيون|tv\b|شاشة|monitor|كيبورد|keyboard|ماوس|mouse|بطارية|battery|باور بانك|power bank|كابل|cable|مكبر صوت|speaker|ريسيفر|receiver|أندرويد|android|ايباد|ipad|تابلت|tablet'),
 ('الألعاب والهوايات', r'أنمي|انمي|anime|سيف|سيوف|sword|لعبة|ألعاب|toy|game|مجسم|figure|بازل|puzzle|ليغو|lego|دراجة|bike|سكوتر|scooter'),
 ('إكسسوارات السيارات', r'سيارة|سيارات|\bcar\b|مركبة|دبل|dashcam'),
 ('الحديقة ومكافحة الحشرات', r'حديقة|garden|نبات|plant|حشرات|insect|ناموس|بعوض|mosquito|صاعق|pest|رش|sprayer|خرطوم|hose'),
 ('الأم والطفل', r'أطفال|اطفال|طفل|رضيع|baby|kids|حفاض|diaper|رضاعة|عربة'),
 ('تجهيز المطاعم والمقاهي', r'مطعم|مقهى|كافيه|cafe|restaurant|نداء|pager|كاشير|cashier|pos\b|عرض الطعام|بوفيه|buffet|صينية تقديم'),
 ('مستلزمات التصوير', r'تصوير|photograph|استوديو|studio|ترايبود|tripod|softbox|سوفت بوكس|رينق لايت|ring light|ستاند|stand|خلفية|backdrop|جيمبل|gimbal'),
 ('السحبات', r'سحبة|سحبات|vape|نكهة|بود\b|pod'),
 ('المنزل والمطبخ', r'مطبخ|قطاعة|كسارة|خضار|فواكه|kitchen|منزل|home|لحاف|duvet|مفرش|sheet|وسادة|pillow|بطانية|blanket|إضاءة|اضاءة|lamp|لمبة|led|light|تنظيم|منظم|organizer|رف|shelf|أكريلك|اكريلك|acrylic|صينية|tray|طقم|set|ديكور|decor|ستارة|curtain|سجاد|rug|حمام|bath|منشفة|مناشف|towel|قدر|pot|مقلاة|pan|سكين|knife|خلاط|blender|مكنسة|vacuum|مروحة|fan|مكواة|iron|ثلاجة|fridge|غسالة|washer|فرن|oven|ميكرويف|microwave|كوب|مج\b|mug|صحن|plate|علبة|box|حافظة|container|تخزين|storage|ملعقة|spoon|شوكة|fork|مقص|scissor|شمعة|candle|إطار|frame|ساعة حائط|clock|مرآة|mirror'),
]
BRAND_CATS = {
 'توري بورش':'الأزياء والإكسسوارات','كوتش':'الأزياء والإكسسوارات','كيت سبيد':'الأزياء والإكسسوارات','أقنر Aigner':'الأزياء والإكسسوارات',
 'تومي هيلفيغر - Tommy Hilfiger':'الأزياء والإكسسوارات','مايكل كورس MK':'الأزياء والإكسسوارات','تيد بيكر':'الأزياء والإكسسوارات',
 'سواروفيسكي - SWAROVSKI':'الأزياء والإكسسوارات','دولتشي قوستو':'القهوة وأدواتها','Double Shot':'القهوة وأدواتها','ديلونجي':'القهوة وأدواتها',
 'نسبريسو':'القهوة وأدواتها','sage':'القهوة وأدواتها','IPTV':'الاشتراكات الرقمية','فالكون':'الاشتراكات الرقمية',
}
def infer_category(p):
    b = p.get('brand') or ''
    if b in BRAND_CATS: return BRAND_CATS[b]
    hay = ((p.get('name') or '') + ' ' + b).lower()
    for cat, rx in CATS:
        if re.search(rx, hay, re.I): return cat
    hay2 = (p.get('meta_description') or '')[:200].lower()
    for cat, rx in CATS:
        if re.search(rx, hay2, re.I): return cat
    return 'منتجات متنوعة'

# ---------- icon mapping (Material Design Icons names, @mdi/js) ----------
ICON_RULES = [
 ('soccer',            r'رياض|مباريات|مباراة|كأس|كاس العالم|bein|\bssc\b|الدوري|sport'),
 ('television-classic',r'قنوات|قناة|تلفزيون|بث|iptv|شاشات|\btv\b|live'),
 ('movie-open',        r'أفلام|افلام|مسلسلات|فيلم|مسلسل|نتفلكس|netflix|شاهد|shahid|hbo|osn|سينما'),
 ('baby-face-outline', r'أطفال|اطفال|الطفل|kids|baby'),
 ('earth',             r'وثائقي|عالمي|discovery|geographic|دولي|international|أوروبي|أمريكي|تركي|هندي'),
 ('quality-high',      r'\b4k\b|\bhd\b|fhd|fullhd|جودة عالية|دقة|resolution|جودات'),
 ('cellphone',         r'جوال|آيفون|ايفون|iphone|أندرويد|اندرويد|android|ايباد|ipad|هاتف|smartphone|موبايل'),
 ('laptop',            r'كمبيوتر|كومبيوتر|لاب توب|لابتوب|laptop|\bpc\b|ويندوز|windows|mac\b'),
 ('download',          r'تحميل|تثبيت|تنزيل|download|install|\bapk\b|تطبيق|app\b|متجر التطبيقات'),
 ('lightning-bolt',    r'تفعيل فوري|فوري|سريع|instant|fast|quick|بسرعة'),
 ('headset',           r'دعم فني|الدعم|واتس|whatsapp|تواصل|خدمة العملاء|support|اتصل|مساعدة'),
 ('update',            r'تحديث|محدث|update'),
 ('tag-outline',       r'العلامة التجارية|ماركة|براند|brand|الشركة المصنعة|manufacturer|موديل|model'),
 ('cash-check',        r'يدفع|دفع|رسوم|مجان|free|سعر|price|تكلفة|بدون تجديد|اشتراك واحد|لمرة واحدة'),
 ('shield-check',      r'ضمان|warranty|أصلي|original|موثوق|آمن|امن|حماية|safe|secure|guarantee|مضمون'),
 ('truck-delivery',    r'شحن|توصيل|تسليم|delivery|shipping|يصلك'),
 ('ruler',             r'طول|عرض|ارتفاع|مقاس|مقاسات|قياس|أبعاد|ابعاد|الحجم|حجم|سم\b|\bcm\b|\bmm\b|inch|بوصة|\bx\s*\d|\d\s*x\s*\d|size|dimension|length|width|height'),
 ('weight-kilogram',   r'وزن|كجم|كيلو|غرام|جرام|\bkg\b|\bgm?\b|weight|lbs'),
 ('cup-water',         r'سعة|لتر|\bml\b|\bمل\b|\bل\b|liter|litre|capacity|أونصة|\boz\b|كوب'),
 ('palette',           r'لون|ألوان|الوان|color|colour'),
 ('texture-box',       r'مادة|خامة|خامات|مصنوع|جلد|leather|قماش|fabric|خشب|wood|ستانلس|steel|معدن|metal|بلاستيك|plastic|سيليكون|silicone|زجاج|glass|قطن|cotton|نايلون|nylon|كانفس|canvas|بامبو|bamboo|material'),
 ('battery-charging',  r'بطارية|battery|شحن كهربائي|\busb\b|واط|watt|فولت|volt|كهرب|power|طاقة|شاحن'),
 ('water',             r'ماء|مياه|مقاوم للماء|waterproof|رطوبة|water|بخار|steam|مطر'),
 ('coffee',            r'قهوة|اسبريسو|إسبريسو|espresso|كبسول|capsule|باريستا|barista|شاي|\btea\b|لاتيه|latte|كابتشينو|cappuccino|موكا|mocha|coffee'),
 ('cog',               r'ماكينة|جهاز|محرك|مضخة|pump|motor|ضغط|bar\b|بار\b|تقنية|technology|نظام|system|وضع|mode|إعدادات|settings|برنامج|تشغيل|automatic|أوتوماتيك'),
 ('hair-dryer',        r'شعر|hair|شامبو|shampoo|بلسم|conditioner|صبغة|dye|تسريح'),
 ('spa',               r'بشرة|skin|كريم|cream|ترطيب|moistur|زيت|oil|سيروم|serum|عطر|رائحة|scent|fragrance|مساج|massage|عناية|care|طبيعي|natural|عضوي|organic|فيتامين|vitamin'),
 ('tooth-outline',     r'أسنان|اسنان|teeth|tooth|تبييض|whiten|فرشاة|brush|لثة|gum'),
 ('wifi',              r'سرعة|mbps|gbps|واي فاي|wifi|شبكة|network|إنترنت|انترنت|internet|اتصال|إشارة|signal|هوائي|antenna|lan\b|ethernet'),
 ('account-group',     r'عائل|أسرة|family|جميع أفراد|للجميع|الكل'),
 ('thumb-up',          r'سهل|سهولة|بسيط|easy|simple|مريح|comfort|خفيف|light\b|عملي|practical|مناسب'),
 ('memory',            r'ذاكرة|\bgb\b|\btb\b|تخزين|storage|رام|\bram\b|معالج|processor|chip'),
 ('camera',            r'كاميرا|camera|تصوير|photo|فيديو|video|عدسة|lens|ميجابكسل|\bmp\b'),
 ('headphones',        r'صوت|sound|audio|سماعة|سماعات|speaker|بلوتوث|bluetooth|ميكروفون|mic\b|موسيقى|music|ضوضاء|noise'),
 ('lightbulb-on',      r'إضاءة|اضاءة|ضوء|led|لمبة|lamp|light|إنارة|lumen|لومن'),
 ('spray-bottle',      r'تنظيف|غسل|clean|wash|تعقيم|sterili|غسيل'),
 ('silverware-fork-knife', r'مطبخ|kitchen|طبخ|cook|طعام|food|أكل|وجبة|meal|فرن|oven|خبز|bak'),
 ('car',               r'سيارة|سيارات|\bcar\b|مركبة|vehicle|قيادة|driv'),
 ('flower',            r'حديقة|garden|نبات|plant|زهور|flower|زراعة|عشب|grass'),
 ('bug',               r'حشرات|حشرة|insect|ناموس|بعوض|mosquito|ذباب|fly|صراصير|pest|نمل|ant'),
 ('bag-personal',      r'شنطة|شنط|حقيبة|حقائب|\bbag\b|محفظة|wallet|جيب|pocket|سحاب|zip|حزام|strap|مقبض|handle|كتف|shoulder'),
 ('diamond-stone',     r'سوار|أسورة|قلادة|عقد|خاتم|حلق|jewel|كريستال|crystal|ذهب|gold|فضة|silver|مجوهرات|لؤلؤ|pearl'),
 ('calendar-clock',    r'ساعة|ساعات|hour|وقت|time|مدة|duration|شهر|month|يوم|day|سنة|year|أسبوع|week|دقيقة|minute|توقيت|مؤقت|timer'),
 ('package-variant',   r'عدد|قطعة|قطع|حبة|حبات|عبوة|رؤوس|رأس|أكواب|pack|piece|pcs|set|طقم|مجموعة|يحتوي|يشمل|include|contains|محتويات|content|صندوق|box|كرتون|carton'),
 ('alert-circle-outline', r'ملاحظة|ملاحظه|تنبيه|تحذير|warning|note|انتبه|لا تجعل|يرجى|please|مهم|important'),
 ('numeric',           r'^\s*(\d+|[أ-ي]+)\s*[-.)–]|^\s*(أولا|ثانيا|ثالثا|رابعا|خامسا|أول|ثاني|ثالث|رابع)\b|خطوة|step'),
 ('help-circle-outline', r'كيف|طريقة|method|how|استخدام|usage|use\b|يستخدم|يُستخدم|طريقه'),
 ('star',              r'مميزات|ميزة|ميزات|features?|يتميز|تميز|أفضل|best|premium|ممتاز|excellent|رائع|جودة|quality|احترافي|professional|فاخر|luxury'),
 ('fire',              r'حرارة|heat|ساخن|hot|درجة|temperature|تسخين|دافئ|warm|بارد|cold|تبريد|cool'),
 ('shield-check',      r'مقاوم|resist|متانة|متين|durable|قوي|strong|صلب|solid'),
 ('gift',              r'هدية|هدايا|gift|مناسبة|occasion|عيد|تغليف|wrap'),
 ('information-outline', r'الأنمي|الشخصية|الموديل|model|النوع|type|الماركة|brand|البلد|المنشأ|origin|made in|صنع'),
]
ICON_RULES = [(n, re.compile(rx, re.I)) for n, rx in ICON_RULES]
DEFAULT_ICON = 'check-circle-outline'
def pick_icon(text, key=None):
    hay = (key + ' ' + text) if key else text
    for name, rx in ICON_RULES:
        if rx.search(hay): return name
    return DEFAULT_ICON

# ---------- description -> bullets ----------
LEAD = re.compile(r'^[\s\-–—•·*✓✔✅☑►▪●○◦♦◆■□➤➜→⇒✦✧★☆»›“”"\'…:،,.]+')
EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿️‍⭐⬆↔-↪⏩-⏺▪-◾⤴⤵〰〽㊗㊙\U0001F900-\U0001F9FF]+')
ZW = re.compile('[​‌‎‏﻿]')
URL = re.compile(r'https?://\S+|www\.\S+')

def norm(t):
    t = html.unescape(t).replace('\xa0', ' ')
    t = ZW.sub('', t); t = EMOJI.sub(' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = LEAD.sub('', t).strip()
    t = re.sub(r'[\s:،,.\-]+$', '', t).strip() if len(t) > 1 else t
    return t

HEAD_KW = re.compile(r'^(أهم |اهم )?(مميزات|المميزات|ميزات|مواصفات|المواصفات|الوصف|وصف المنتج|محتويات|المحتويات|طريقة الاستخدام|طريقة الإستخدام|الاستخدام|تفاصيل|التفاصيل|ملاحظات|ملاحظة|تنبيه|features?|specifications?|specs|description|details|highlights|contents|how to use|note|warning|what.s in the box|أبعاد|الأبعاد|المقاسات|القياسات|dimensions|package includes|includes)\b[^.]{0,30}$', re.I)
def is_heading_text(t):
    return (len(t) <= 60 and (t.endswith(':') or t.endswith('：'))) or (len(t) <= 45 and HEAD_KW.search(t) is not None and not re.search(r'[.،,]', t))

BLOCK_TAGS = {'p','li','h1','h2','h3','h4','h5','h6','div','tr','td','th','blockquote','pre','span'}
def blocks_from_html(h):
    """Yield (kind, text) where kind in {'h','li','p'} in document order."""
    soup = BeautifulSoup(h, 'lxml')
    for t in soup(['img','script','style','iframe','video','source']): t.decompose()
    for br in soup.find_all('br'): br.replace_with('\n')
    out = []
    def walk(el):
        for ch in el.children:
            if isinstance(ch, NavigableString):
                s = str(ch)
                if s.strip(): out.append(('p', s))
                continue
            name = ch.name
            if name in ('ul','ol','table','tbody','thead','body','html','article','section','div','font','center'):
                # container: if it only has inline content treat as p
                if name == 'div' and not ch.find(['p','li','h1','h2','h3','h4','h5','h6','div','table','ul','ol']):
                    out.append(('p', ch.get_text('\n'))); continue
                walk(ch); continue
            if name in ('h1','h2','h3','h4','h5','h6'):
                out.append(('h', ch.get_text(' '))); continue
            if name == 'li':
                out.append(('li', ch.get_text(' '))); continue
            if name in ('p','tr','blockquote','pre'):
                if ch.find(['ul','ol','p','li']): walk(ch)
                else: out.append(('p', ch.get_text('\n')))
                continue
            # inline (span, strong, a, b, em...)
            if ch.find(['p','li','ul','ol','h1','h2','h3','h4','h5','h6','div']): walk(ch)
            else: out.append(('p', ch.get_text(' ')))
    walk(soup)
    return out

SENT_SPLIT = re.compile(r'(?<=[.!؟?])\s+(?=[^\d\s])')
def to_bullets(desc_html, meta_desc):
    groups = []; cur = {'title': None, 'items': []}
    seen = set()
    def push(kind, raw):
        nonlocal cur
        raw = html.unescape(raw)
        for line in re.split(r'\n+', raw):
            t = norm(line)
            if not t or len(t) < 3: continue
            if URL.fullmatch(t) or (URL.search(t) and len(URL.sub('', t).strip()) < 4): continue
            t_no_url = URL.sub('', t).strip()
            if kind == 'h' or (kind in ('p','li') and is_heading_text(t)):
                title = t.rstrip(':： ').strip()
                if not title: continue
                if cur['items'] or cur['title'] is None and not groups and not cur['items']:
                    if cur['items'] or cur['title']: groups.append(cur)
                cur = {'title': title, 'items': []}
                continue
            parts = [t_no_url]
            if kind == 'p' and len(t_no_url) > 140:
                parts = [s.strip() for s in SENT_SPLIT.split(t_no_url) if s.strip()]
            for s in parts:
                s = norm(s)
                if len(s) < 3: continue
                k = re.sub(r'[\s\W]+', '', s.lower())
                if k in seen: continue
                seen.add(k)
                key = val = None
                m = re.match(r'^([^:：]{2,30})[:：]\s*(.{2,})$', s)
                if m and not re.search(r'https?', s):
                    key, val = m.group(1).strip(), m.group(2).strip()
                item = {'text': s, 'icon': pick_icon(s, key)}
                if key: item['key'] = key; item['value'] = val
                cur['items'].append(item)
    for kind, raw in blocks_from_html(desc_html or ''):
        push(kind, raw)
    if cur['items'] or cur['title']: groups.append(cur)
    # drop empty groups; merge orphan titles
    groups = [g for g in groups if g['items']]
    if not groups and meta_desc and 'يقدم كل ماهو جديد من المنتجات' not in meta_desc:
        push('p', meta_desc)
        if cur['items']: groups = [cur]
    return groups

def title_case_name(n):
    n = ZW.sub('', html.unescape(n or '')).strip()
    n = re.sub(r'\s+', ' ', n)
    return n

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
