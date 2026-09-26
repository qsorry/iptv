import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InvalidActivationCodeError, PairingCodeError, UnknownUsernameError, completePairing, findPendingPairing, normalizePairingCode } from "@/modules/player";
import { ValidationError } from "@/core/errors";
import { RateLimitedError, rateLimit } from "@/lib/rate-limit";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: { absolute: "ربط التلفاز | Ssouq Net" },
  robots: { index: false, follow: false },
};

const PATH = "/player/pair";

/** رسائل ثابتة تختارها الصفحة بمفتاح؛ لا نص حرّ من الرابط (يُستغل لخداع المشترك على صفحة المنصة). */
const ERRORS = {
  pair: "رمز الربط غير صحيح أو انتهت صلاحيته. أعد فتح شاشة الربط على التلفاز وامسح الرمز الجديد.",
  code: "كود التفعيل غير صالح أو منتهي. تأكد منه أو اطلب كوداً جديداً من مزوّدك.",
  user: "لم نتعرّف على مزوّد لاسم المستخدم هذا. استخدم كود التفعيل بدلاً منه.",
  fields: "أدخل كود التفعيل، أو اسم المستخدم وكلمة المرور.",
  rate: "محاولات كثيرة، انتظر دقيقة ثم حاول مرة أخرى.",
  generic: "تعذّر الإرسال، حاول مرة أخرى.",
} as const;
type ErrorKey = keyof typeof ERRORS;

function errorKey(e: unknown): ErrorKey {
  if (e instanceof PairingCodeError) return "pair";
  if (e instanceof InvalidActivationCodeError) return "code";
  if (e instanceof UnknownUsernameError) return "user";
  if (e instanceof RateLimitedError) return "rate";
  if (e instanceof ValidationError) return "fields";
  return "generic";
}

/** Next يعطي مصفوفة إن تكرر المفتاح في الرابط. */
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type Search = { code?: string | string[]; e?: string | string[]; done?: string | string[] };

/**
 * صفحة يفتحها الجوال بعد مسح QR الظاهر على التلفاز في تطبيق Ssouq Net.
 * يرسل المستخدم كود التفعيل أو اسم المستخدم وكلمة المرور، فيستلمها التلفاز مرة واحدة.
 */
export default async function PairPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const rawCode = first(sp.code);
  const e = first(sp.e);
  const error = e && e in ERRORS ? ERRORS[e as ErrorKey] : null;
  const done = first(sp.done) === "1";
  const code = normalizePairingCode(rawCode);
  const pending = code ? await findPendingPairing(code) : null;

  async function send(formData: FormData) {
    "use server";
    const pairCode = String(formData.get("pairCode") ?? "");
    let target: string;
    try {
      const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      rateLimit(`player:pair-complete:${ip}`, 10, 60_000);
      await completePairing({
        pairCode,
        activationCode: formData.get("activationCode"),
        username: formData.get("username"),
        password: formData.get("password"),
      });
      target = `${PATH}?done=1`;
    } catch (err) {
      if (errorKey(err) === "generic") console.error("pairing failed", err);
      target = `${PATH}?code=${encodeURIComponent(pairCode)}&e=${errorKey(err)}`;
    }
    redirect(target);
  }

  return (
    <main className="py-8 sm:py-12">
      <Container className="max-w-md space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink-secondary" dir="ltr">Ssouq Net</p>
          <h1 className="text-2xl font-semibold">ربط التلفاز</h1>
        </div>

        {done ? (
          <Card className="space-y-2">
            <Alert variant="success">تم الإرسال. سيفتح التلفاز حسابك خلال ثوانٍ.</Alert>
          </Card>
        ) : (
          <>
            {error && <Alert variant="error">{error}</Alert>}
            {rawCode && !pending && !error && <Alert variant="warning">انتهت صلاحية هذا الرمز أو استُخدم. افتح شاشة الربط على التلفاز من جديد وامسح الرمز الجديد.</Alert>}

            <Card>
              <form action={send} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="pairCode" className="text-sm font-medium">رمز الربط الظاهر على التلفاز</label>
                  <Input id="pairCode" name="pairCode" required dir="ltr" autoCapitalize="characters" autoComplete="off" defaultValue={code ?? rawCode?.slice(0, 20) ?? ""} placeholder="XXXX-XXXX" className="text-center font-semibold tracking-widest" />
                </div>

                <fieldset className="space-y-3">
                  <legend className="mb-1 text-sm font-semibold">كود التفعيل</legend>
                  <label htmlFor="activationCode" className="sr-only">كود التفعيل</label>
                  <Input id="activationCode" name="activationCode" dir="ltr" autoCapitalize="characters" autoComplete="off" placeholder="SN-XXXX-XXXX" className="text-center tracking-widest" />
                </fieldset>

                <div className="flex items-center gap-3 text-sm text-ink-secondary" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  أو
                  <span className="h-px flex-1 bg-border" />
                </div>

                <fieldset className="space-y-3">
                  <legend className="mb-1 text-sm font-semibold">بيانات الاشتراك</legend>
                  <div className="space-y-1">
                    <label htmlFor="username" className="text-sm font-medium">اسم المستخدم</label>
                    <Input id="username" name="username" dir="ltr" autoComplete="username" inputMode="text" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="password" className="text-sm font-medium">كلمة المرور</label>
                    <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" />
                  </div>
                </fieldset>

                <Button type="submit" className="w-full">إرسال إلى التلفاز</Button>
              </form>
            </Card>

            <p className="text-xs text-ink-secondary">
              تابع فقط إن كان رمز الربط أعلاه ظاهراً على تلفازك أنت الآن؛ أي تلفاز يحمل هذا الرمز سيستلم حسابك.
            </p>
            <p className="text-xs text-ink-secondary">
              Ssouq Net مشغّل وسائط فقط ولا يحتوي على أي قنوات أو محتوى. المحتوى يقدّمه مزوّدك، وبياناتك تُرسل إلى تلفازك فقط ولا تُحفظ بعد استلامها.
            </p>
          </>
        )}
      </Container>
    </main>
  );
}
