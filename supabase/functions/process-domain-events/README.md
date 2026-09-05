# process-domain-events

Worker مجدول (كل دقيقة عبر pg_cron أو Supabase Scheduled Functions) يقرأ
`domain_events` بحالة `pending`، يقفلها بـ `FOR UPDATE SKIP LOCKED`، ينفّذ المعالجات
(إيميل، إشعار، تحليلات)، ثم يحدّث الحالة إلى `processed` أو `failed` مع زيادة `attempts`.
