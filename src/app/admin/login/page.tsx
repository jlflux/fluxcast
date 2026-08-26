import { redirect } from "next/navigation";

import { resolveAdminSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env.server";
import { Wordmark } from "@/components/ui/Wordmark";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  // Already signed in (or running unauthenticated in development). An account
  // that signed in but has no profile goes to the explanation instead of
  // /admin, which would only redirect back here.
  const result = await resolveAdminSession();
  if (result.status === "ok") redirect("/admin");
  if (result.status === "unprovisioned" || result.status === "error") {
    redirect("/admin/no-access");
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <Wordmark size="lg" />
        <p className="eyebrow mt-3 text-ink-400">Broadcast admin</p>
      </div>

      {!isSupabaseConfigured ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Supabase is not configured, so there are no accounts yet and the admin area is
          open. Configure Supabase to require a sign-in.
        </p>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
