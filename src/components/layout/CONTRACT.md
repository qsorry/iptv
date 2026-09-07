# عقود مكوّنات `layout/`

## Header
- Purpose: الشريط العلوي اللاصق (شعار، بحث، سلة، حساب، تصنيفات).
- Variants: `standard | minimal`.
- Required: `store`, `categories`, `cartCount`, `themeMode`.
- Must Not: يجلب بيانات.

## MobileNavigation
- Purpose: تنقّل سفلي للجوال (الرئيسية / الأقسام / السلة / الحساب).
- Must Not: يظهر على الشاشات ≥ sm.

## Container
- في `ui/container.tsx`.

## Footer
- `components/storefront/store-footer.tsx` (StoreFooter).
