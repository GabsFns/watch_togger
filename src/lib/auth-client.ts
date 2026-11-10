"use client";

import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export const signIn = (email: string, password: string) =>
  supabaseBrowser().auth.signInWithPassword({ email, password });

export const signUp = (email: string, password: string) =>
  supabaseBrowser().auth.signUp({ email, password });

export const signOut = () => supabaseBrowser().auth.signOut();

export const getSession = () => supabaseBrowser().auth.getSession();

export const onAuthChange = (cb: (event: string, session: any) => void) =>
  supabaseBrowser().auth.onAuthStateChange(cb);

export const updateUser = (updates: { email?: string; password?: string; data?: Record<string, any> }) =>
  supabaseBrowser().auth.updateUser(updates);

export const resetPasswordEmail = (email: string) =>
  supabaseBrowser().auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });
