import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { isoToWallTime } from "@/lib/format";
import { BroadcastForm } from "@/components/admin/BroadcastForm";

export const metadata = { title: "Create broadcast" };

export default async function NewBroadcastPage() {
  const session = await requireAdmin();

  const allTeams = await getDataSource().listTeamOptions();
  const teams =
    session.profile.role === "super_admin"
      ? allTeams
      : allTeams.filter((t) => t.schoolId === session.profile.schoolId);
  const { date } = isoToWallTime(new Date().toISOString());

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm text-ink-400 transition hover:text-ink-200">
        ← Dashboard
      </Link>

      <h1 className="mt-4 mb-1 text-2xl font-bold tracking-tight text-ink-100">
        Create broadcast
      </h1>
      <p className="mb-8 text-sm text-ink-400">
        This creates the game and its broadcast. You&rsquo;ll generate the stream destination
        on the next screen.
      </p>

      {teams.length === 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          No teams available to you. Add one on the{" "}
          <Link href="/admin/teams" className="underline">
            Teams
          </Link>{" "}
          page, or ask a FluxCast super admin to link your account to a school.
        </p>
      ) : (
        <BroadcastForm teams={teams} defaultDate={date} />
      )}
    </div>
  );
}
