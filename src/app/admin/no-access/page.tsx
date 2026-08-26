import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveAdminSession } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SignOutButton } from "@/components/admin/SignOutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account not set up", robots: { index: false, follow: false } };

/**
 * Shown when a sign-in worked but the account has no profile row.
 *
 * The usual cause is ordering: the Supabase user was created before migration
 * 0002 added the trigger that creates profiles, so nothing fired. This page
 * says so and hands over the exact SQL, because the diagnostics page is behind
 * the very login this account cannot complete.
 *
 * Everything shown is about the signed-in user's own account.
 */
export default async function NoAccessPage() {
  const result = await resolveAdminSession();

  if (result.status === "ok") redirect("/admin");
  if (result.status === "anonymous") redirect("/admin/login");

  const userId = result.status === "unprovisioned" ? result.userId : null;
  const email = result.status === "unprovisioned" ? result.email : null;

  // Is the profiles table there at all, and does anything live in it? This
  // separates "migration 0002 never ran" from "the trigger did not fire".
  let profileCount: number | null = null;
  let tableError: string | null = null;
  try {
    const admin = createAdminSupabaseClient();
    const { count, error } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (error) tableError = error.message;
    else profileCount = count ?? 0;
  } catch (error) {
    tableError = error instanceof Error ? error.message : String(error);
  }

  const migrationMissing =
    tableError !== null && /relation .*profiles.* does not exist|42P01/i.test(tableError);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink-100">
        You&rsquo;re signed in, but this account isn&rsquo;t set up yet
      </h1>
      <p className="mt-2 text-sm text-ink-400">
        The password was right. What&rsquo;s missing is the <code>profiles</code> row that
        says which school you belong to and what you&rsquo;re allowed to do.
      </p>

      <dl className="mt-6 flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-900 p-5 text-sm">
        <Row label="Signed in as" value={email ?? "(no email on the account)"} />
        <Row label="User ID" value={userId ?? "unknown"} mono />
        <Row
          label="profiles table"
          value={
            migrationMissing
              ? "missing — migration 0002 has not run"
              : tableError
                ? `error: ${tableError}`
                : `${profileCount} row${profileCount === 1 ? "" : "s"}`
          }
        />
      </dl>

      <div className="mt-8">
        <h2 className="text-base font-bold text-ink-100">
          {migrationMissing ? "Run the migration first" : "Fix it with one query"}
        </h2>

        {migrationMissing ? (
          <p className="mt-2 text-sm text-ink-300">
            In Supabase, open <span className="text-ink-100">SQL Editor</span> and run{" "}
            <code className="font-mono text-xs text-ink-200">
              supabase/migrations/0002_auth_and_roles.sql
            </code>
            , then come back and reload this page.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-300">
              Your Supabase user was almost certainly created before migration 0002 added the
              trigger that creates profiles, so nothing fired for it. In Supabase, open{" "}
              <span className="text-ink-100">SQL Editor</span> and run this:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-ink-800 bg-ink-950 p-4 font-mono text-xs leading-relaxed text-ink-200">
{`insert into public.profiles (id, email, role, school_id)
values (
  '${userId ?? "YOUR-USER-ID"}',
  '${email ?? "you@example.com"}',
  'super_admin',
  (select id from public.schools where slug = 'homewood')
)
on conflict (id) do update
  set role = 'super_admin',
      school_id = excluded.school_id;`}
            </pre>
            <p className="mt-3 text-sm text-ink-400">
              Then reload this page. It sends you straight to the dashboard once the row
              exists.
            </p>
          </>
        )}
      </div>

      <div className="mt-10 flex items-center gap-4 text-sm">
        <Link href="/admin/no-access" className="font-semibold text-flux-400 hover:text-flux-300">
          Reload
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className={mono ? "font-mono text-xs text-ink-200" : "text-ink-200"}>{value}</dd>
    </div>
  );
}
