import { requireAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { AdminSection } from "@/components/admin/AdminSection";
import { CreateTeamForm } from "@/components/admin/CreateTeamForm";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const session = await requireAdmin();
  const data = getDataSource();

  const [allSchools, sports, allTeams] = await Promise.all([
    data.listSchools(),
    data.listSports(),
    data.listTeamOptions(),
  ]);

  const isSuper = session.profile.role === "super_admin";
  const schools = isSuper
    ? allSchools
    : allSchools.filter((s) => s.id === session.profile.schoolId);
  const teams = isSuper
    ? allTeams
    : allTeams.filter((t) => t.schoolId === session.profile.schoolId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-100">Teams</h1>
      <p className="mb-8 text-sm text-ink-400">
        A team is a school, a sport and a level — &ldquo;Homewood Varsity Football&rdquo;.
        Broadcasts are created against a team.
      </p>

      <AdminSection title="Existing teams">
        {teams.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-800 px-4 py-6 text-center text-sm text-ink-400">
            No teams yet. Create one below.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-ink-800 divide-y divide-ink-800">
            {teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between gap-4 bg-ink-900/50 px-4 py-3 text-sm"
              >
                <span className="font-semibold text-ink-100">{team.label}</span>
                <span className="text-xs text-ink-400">{team.schoolName}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection
        title="Add a team"
        description={
          isSuper
            ? "As super admin you can add a team to any school."
            : "You can add teams to your own school."
        }
      >
        {schools.length === 0 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Your account is not linked to a school yet. Ask a FluxCast super admin to assign
            one.
          </p>
        ) : (
          <CreateTeamForm
            schools={schools}
            sports={sports}
            defaultSchoolId={session.profile.schoolId ?? schools[0]?.id ?? null}
            lockedToSchool={!isSuper}
          />
        )}
      </AdminSection>
    </div>
  );
}
