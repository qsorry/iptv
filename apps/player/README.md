# Ssouq Net Player

مشغّل وسائط (Xtream Codes / M3U) للجوال والتلفاز من حزمة ويب واحدة: Samsung Tizen، LG webOS، VIDAA، Android وAndroid TV.
لا يحتوي على أي محتوى؛ يتصل بخادم المزوّد مباشرة.

التوثيق الكامل (البنية، الخادم، التطوير، الحزم، الحدود): [`docs/PLAYER.md`](../../docs/PLAYER.md).

```bash
npm install
npm test && npm run typecheck
npm run mock                                   # خادم Xtream وهمي على :8090
VITE_API_BASE=http://localhost:3000 npm run dev
npm run build && npm run package:tizen          # أو package:webos / package:android
```
