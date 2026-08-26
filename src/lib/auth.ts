import "server-only";

import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AdminProfile, AdminRole } from "@/lib/types";
import { ADMIN_ROLES } from "@/lib/types";

/**
 * Admin authorization — the single choke point.
 *
 * Every admin page and every admin server action calls `requireAdmin()`.
 * Server Actions are reachable by direct POST, not only through the UI, which
 * is why the check belongs in the action rather than in the page that renders
 * the form.
 *
 * When Supabase is not configured there is no user database to check against,
 * so the admin area runs unauthenticated as a clearly-labelled development
 * mode (`DEV_PROFILE` below, and a banner across the admin area). With
 * Supabase configured, a real session is required.
 */

/** Stand-in identity used only when Supabase is not configured. */
const DEV_PROFILE: AdminProfile = {
  id: "development-admin",
  email: "development@localhost",
  fullName: "Development Admin",
  role: "super_admin",
  schoolId: null,
  createdAt: new Date(0).toISOString(),
};

export interface AdminSession {
  profile: AdminProfile;
  /** False when running unauthenticated because Supabase is not configured. */
  authenticated: boolean;
}

/**
 * Why an admin session could not be established.
 *
 * These are kept apart because they need opposite responses. "anonymous" means
 * sign in. "unprovisioned" means the sign-in worked and the account simply has
 * no profile row — sending that person back to the login form produces an
 * endless bounce with nothing on screen explaining it.
 */
export type AdminSessionResult =
  | { status: "ok"; session: AdminSession }
  | { status: "anonymous" }
  | { status: "unprovisioned"; userId: string; email: string | null }
  | { status: "error"; message: string };

function toRole(value: string): AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value)
    ? (value as AdminRole)
    : "school_admin";
}

/**
 * The signed-in admin, or null.
 *
 * Uses `getUser()` rather than `getSession()`: getUser revalidates the token
 * with Supabase, whereas getSession trusts whatever is in the cookie. For an
 * authorization decision only the verified answer will do.
 */
export async function resolveAdminSession(): Promise<AdminSessionResult> {
  if (!isSupabaseConfigured) {
    return {
      status: "ok",
      session: { profile: DEV_PROFILE, authenticated: false },
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  // Read the profile with the service role: a signed-in user must be able to
  // load their own role even before any policy lets them read the table.
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error(`[fluxcast] Could not load profile for ${user.id}: ${error.message}`);
    return { status: "error", message: error.message };
  }

  if (!data) {
    console.warn(
      `[fluxcast] Authenticated user ${user.id} (${user.email ?? "no email"}) has no profiles row.`,
    );
    return { status: "unprovisioned", userId: user.id, email: user.email ?? null };
  }

  return {
    status: "ok",
    session: {
      profile: {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: toRole(data.role),
        schoolId: data.school_id,
        createdAt: data.created_at,
      },
      authenticated: true,
    },
  };
}

/** Convenience wrapper for places that only care whether there is a session. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const result = await resolveAdminSession();
  return result.status === "ok" ? result.session : null;
}

/**
 * Redirects when there is no admin session.
 *
 * An unprovisioned or errored account goes to an explanation, not back to the
 * login form — bouncing a successful sign-in straight back to the form is the
 * most confusing failure this app can produce.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const result = await resolveAdminSession();
  switch (result.status) {
    case "ok":
      return result.session;
    // redirect() throws, so these cases never fall through.
    case "anonymous":
      redirect("/admin/login");
    case "unprovisioned":
      redirect("/admin/no-access");
    case "error":
      redirect("/admin/no-access?problem=lookup");
  }
}

/** Redirects unless the signed-in admin is FluxCast staff. */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.profile.role !== "super_admin") redirect("/admin?denied=super_admin");
  return session;
}

/** True when the admin area is reachable without signing in. */
export const adminIsUnprotected = !isSupabaseConfigured;

/** Can this admin act on the given school? */
export function canManageSchool(session: AdminSession, schoolId: string): boolean {
  return session.profile.role === "super_admin" || session.profile.schoolId === schoolId;
}
