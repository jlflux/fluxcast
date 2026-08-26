import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase auth session on every admin request.
 *
 * Access tokens are short-lived. Without a refresh step the cookie silently
 * goes stale and an admin is bounced to the login screen mid-session. This runs
 * before the page, swaps the refresh token for a fresh access token, and writes
 * the updated cookies onto the response — which Server Components cannot do
 * themselves.
 *
 * This is session *maintenance*, not authorization. The actual check lives in
 * `requireAdmin()`, which every admin page and action calls: proxy checks are
 * optimistic and must never be the only gate.
 *
 * Renamed from `middleware` in Next.js 16.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";

  // Not configured: nothing to refresh, and the admin area runs in development
  // mode anyway.
  if (!url || !key) return response;

  const supabase = createServerClient(normalizeUrl(url), key.trim(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

/** Mirrors `normalizeSupabaseUrl` in env.server.ts, which proxy cannot import. */
function normalizeUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime|graphql|functions)\/v\d+$/i, "")
    .replace(/\/+$/, "");
}

export const config = {
  // Only admin routes need a session; the public site is anonymous.
  matcher: ["/admin/:path*"],
};
