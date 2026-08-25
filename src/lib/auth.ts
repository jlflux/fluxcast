import "server-only";

import { isSupabaseConfigured } from "@/lib/env.server";

/**
 * Admin authorization — the single choke point.
 *
 * Every admin page and every admin server action calls `requireAdmin()`. Today
 * it always allows: FluxCast has no login screen yet, and the admin area is
 * open. That is a deliberate, visible state — `adminIsUnprotected` drives a
 * banner across the whole admin area saying so.
 *
 * When Supabase auth lands, the implementation goes *here* and nothing else has
 * to change:
 *
 *   const supabase = await createServerSupabaseClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (!user) redirect("/admin/login");
 *   return { userId: user.id, email: user.email };
 *
 * Server Actions are reachable by direct POST, not just through the UI, which
 * is exactly why the check belongs in the action rather than in the page that
 * renders the form.
 */

export interface AdminSession {
  /** Null while the admin area is unauthenticated. */
  userId: string | null;
  email: string | null;
  protectedByAuth: boolean;
}

export const adminIsUnprotected = true;

export async function requireAdmin(): Promise<AdminSession> {
  return {
    userId: null,
    email: null,
    protectedByAuth: isSupabaseConfigured && !adminIsUnprotected,
  };
}
