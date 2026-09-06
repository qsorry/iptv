// يطبّق هجرات drizzle/ عند إقلاع الحاوية. يعتمد فقط على drizzle-orm و postgres (موجودان وقت التشغيل).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL غير مضبوط");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.log("✓ الهجرات مطبّقة");
} catch (error) {
  console.error("✗ فشل تطبيق الهجرات", error);
  process.exit(1);
} finally {
  await client.end();
}
