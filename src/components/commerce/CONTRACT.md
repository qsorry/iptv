# عقود مكوّنات `commerce/`

## ProductCard
- Purpose: عرض منتج قابل للشراء.
- Variants: `default | featured | compact | horizontal`.
- Required: `product` (image, title, price), `currency`.
- Optional: `badge`, `priority`.
- Must Not: يجلب بيانات، يعرف الثيم، يحتوي منطق سلة أو دفع، يحمل تنسيقاً خاصاً بصفحة.

## ProductPrice
- Purpose: سعر + سعر مقارنة بالهللة.
- Required: `price`, `currency`.

## ProductGrid
- Purpose: شبكة بطاقات منتجات؛ عمودان على الجوال.
- Optional: `variant`, `columns`, `badgeFirst`.

## CategoryCard
- Purpose: رابط تصنيف مع أيقونة/صورة.
- Variants: `default | compact`.
