"use client";

import { createAuthClient } from "better-auth/react";

/** عميل المصادقة للمتصفح. baseURL يُقرأ من نفس الأصل تلقائياً. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
