"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env.server";
import type { SignInState } from "@/actions/form-state";

/**
 * Sign in an admin.
 *
 * Failures return a single generic message on purpose: distinguishing "no such
 * account" from "wrong password" tells an attacker which addresses are real.
 * The specific reason is logged server-side.
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase is not configured, so there are no admin accounts yet." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.warn(`[fluxcast] Failed sign-in for ${email}: ${error.message}`);
    return { error: "That email and password don't match an account." };
  }

  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
