"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/auth");
        router.refresh();
      }}
      className="text-sm text-gray-600 hover:underline"
    >
      تسجيل الخروج
    </button>
  );
}
