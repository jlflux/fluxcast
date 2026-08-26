import Link from "next/link";

import { requireSuperAdmin } from "@/lib/auth";
import { getDataSource } from "@/lib/data";
import { AdminSection } from "@/components/admin/AdminSection";
import { CreateSchoolForm } from "@/components/admin/CreateSchoolForm";

export const metadata = { title: "Schools" };

/** FluxCast staff only — onboarding new schools onto the network. */
export default async function SchoolsPage() {
  await requireSuperAdmin();

  const schools = await getDataSource().listSchools();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-100">Schools</h1>
      <p className="mb-8 text-sm text-ink-400">
        Every school on the FluxCast network. Adding one here is the first step in onboarding
        a partner.
      </p>

      <AdminSection title="On the network">
        <ul className="overflow-hidden rounded-lg border border-ink-800 divide-y divide-ink-800">
          {schools.map((school) => (
            <li
              key={school.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-ink-900/50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink-100">{school.name}</p>
                <p className="text-xs text-ink-400">
                  {[school.mascot, school.city, school.state].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Link
                href={`/schools/${school.slug}`}
                className="text-xs font-semibold text-flux-400 transition hover:text-flux-300"
              >
                /schools/{school.slug}
              </Link>
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection
        title="Add a school"
        description="Then add a team on the Teams page, and create the school's admin account in Supabase (see the README, 'Onboarding another school')."
      >
        <CreateSchoolForm />
      </AdminSection>
    </div>
  );
}
