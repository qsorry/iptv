# عقود مكوّنات `ui/`

كل مكوّن هنا: مسؤولية واحدة، رموز دلالية فقط، لا يعرف الثيم، لا يجلب بيانات.

## Button
- Purpose: تنفيذ إجراء.
- Variants: `primary | secondary | outline | ghost` (`tonal` اسم قديم = secondary).
- Sizes: `sm | md | lg`.
- Required: `children`.
- Must Not: يُستخدم للتنقّل (استخدم `Link` مع `buttonClasses()`).

## Card
- Purpose: حاوية محتوى مفصولة عن الخلفية.
- Variants: `default | elevated | flat`.
- Must Not: يحتوي منطق صفحة أو يجلب بيانات.

## Input
- Purpose: إدخال نص. حجم 16px إلزامي.
- Must Not: يحمل ألواناً ثابتة.

## Badge
- Purpose: شارة نصية قصيرة.
- Variants: `default | success | warning | error`.

## Alert
- Purpose: رسالة حالة مضمّنة.
- Variants: `info | success | warning | error`.

## Skeleton
- Purpose: حجز مساحة أثناء التحميل (منع CLS).

## Modal
- Purpose: حوار تفاعلي فوق الصفحة.
- Required: `open`, `onClose`.
- Must Not: يحتوي محتوى مهماً لمحركات البحث.

## Container
- Purpose: عرض أقصى متمركز مع حواف متجاوبة.
