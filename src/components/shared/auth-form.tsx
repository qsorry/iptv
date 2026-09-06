"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AuthForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const result =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: String(form.get("name")) });

    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "حدث خطأ");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}</h1>

      {mode === "signup" && (
        <label className="block text-sm">
          الاسم
          <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
        </label>
      )}
      <label className="block text-sm">
        البريد الإلكتروني
        <input name="email" type="email" required dir="ltr" className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        كلمة المرور
        <input name="password" type="password" required minLength={8} dir="ltr" className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "..." : mode === "signin" ? "دخول" : "إنشاء"}
      </Button>

      <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-sm text-gray-600 underline">
        {mode === "signin" ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل الدخول"}
      </button>
    </form>
  );
}
