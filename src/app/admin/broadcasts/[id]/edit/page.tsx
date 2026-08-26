import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { canManageSchool, requireAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { isoToWallTime } from "@/lib/format";
import { EditBroadcastForm } from "@/components/admin/EditBroadcastForm";

export const metadata = { title: "Edit broadcast" };

export default async function EditBroadcastPage({
  params,
}: PageProps<"/admin/broadcasts/[id]/edit">) {
  const session = await requireAdmin();
  const { id } = await params;

  const broadcast = await getDataSource().getBroadcastById(id);
  if (!broadcast) notFound();
  if (!canManageSchool(session, broadcast.school.id)) redirect("/admin?denied=school");

  const { date, time } = isoToWallTime(broadcast.scheduledStart);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={`/admin/broadcasts/${broadcast.id}`}
        className="text-sm text-ink-400 transition hover:text-ink-200"
      >
        ← {broadcast.matchup}
      </Link>

      <h1 className="mt-4 mb-1 text-2xl font-bold tracking-tight text-ink-100">
        Edit broadcast
      </h1>
      <p className="mb-8 text-sm text-ink-400">
        Fix a typo or change the kickoff. The stream destination is unaffected.
      </p>

      <EditBroadcastForm broadcast={broadcast} date={date} time={time} />
    </div>
  );
}
