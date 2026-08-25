import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/types";

/**
 * Request-scoped Supabase client using the publishable (anon) key.
 *
 * This is the client that public pages read through, so Row Level Security is
 * genuinely enforced: the policies in the migration allow SELECT and nothing
 * else. It also carries the auth cookie, which is what admin authentication
 * will use in a later milestone.
 *
 * A new client is created per request — never share one across requests.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    serverEnv.supabaseUrl,
    serverEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled elsewhere; safe to ignore.
          }
        },
      },
    },
  );
}
