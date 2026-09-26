import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { completePairing, findPendingPairing, normalizePairingCode } from "@/modules/player";
import { AppError } from "@/core/errors";
import { rateLimit } from "@/lib/rate-limit";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "ربط التلفاز | Ssouq Net",
  robots: { index: false, follow: false },
};

const PATH = "/player/pair";

type Search = { code?: string; error?: string; done?: string; provider?: string };

/**
 * صفحة يفتحها الجوال بعد مسح QR الظاهر على التلفاز في تطبيق Ssouq Net.
 * يرسل المستخدم كود التفعيل أو اسم المستخدم وكلمة المرور، فيستلمها التلفاز مرة واحدة.
 */
export default async function PairPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { code: rawCode, error, done, provider } = await searchParams;
  const code = rawCode ? normalizePairingCode(rawCode) : null;
  const pending = code ? await findPendingPairing(code) : null;

  async function send(formData: FormData) {
    "use server";
    const pairCode = String(formData.get("pairCode") ?? "");
    let target: string;
    try {
      const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      rateLimit(`player:pair-complete:${ip}`, 10, 60_000);
      const result = await completePairing({
        pairCode,
        activationCode: formData.get("activationCode"),
        username: formData.get("username"),
        password: formData.get("password"),
      });
      target = `${PATH}?done=1&provider=${encodeURIComponent(result.providerName)}`;
    } catch (e) {
      const msg = e instanceof AppError ? e.message : "تعذّر الإرسال، حاول مرة أخرى";
      target = `${PATH}?code=${encodeURIComponent(pairCode)}&error=${encodeURIComponent(msg)}`;
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
            {provider && <p className="text-sm text-ink-secondary">المزوّد: {provider}</p>}
          </Card>
        ) : (
          <>
            {error && <Alert variant="error">{error}</Alert>}
            {code && !pending && !error && <Alert variant="warning">انتهت صلاحية هذا الرمز أو استُخدم. افتح شاشة الربط على التلفاز من جديد وامسح الرمز الجديد.</Alert>}

            <Card>
              <form action={send} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="pairCode" className="text-sm font-medium">رمز الربط الظاهر على التلفاز</label>
                  <Input id="pairCode" name="pairCode" required dir="ltr" autoCapitalize="characters" autoComplete="off" defaultValue={code ?? rawCode ?? ""} placeholder="XXXX-XXXX" className="text-center font-semibold tracking-widest" />
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
              Ssouq Net مشغّل وسائط فقط ولا يحتوي على أي قنوات أو محتوى. المحتوى يقدّمه مزوّدك، وبياناتك تُرسل إلى تلفازك فقط ولا تُحفظ بعد استلامها.
            </p>
          </>
        )}
      </Container>
    </main>
  );
}
