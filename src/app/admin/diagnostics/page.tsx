import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { collectDiagnostics } from "@/lib/diagnostics";
import type { EnvCheck } from "@/lib/diagnostics";

export const metadata = { title: "Diagnostics" };

/**
 * Configuration self-check.
 *
 * The point of this page is to turn "it says Development mode" into a specific,
 * actionable line — which variable is missing, or which query failed — without
 * anyone reading a log.
 */
export default async function DiagnosticsPage() {
  await requireAdmin();
  const d = await collectDiagnostics();

  const supabaseVars = d.env.slice(0, 3);
  const livekitVars = d.env.slice(3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm text-ink-400 transition hover:text-ink-200">
        ← Dashboard
      </Link>

      <h1 className="mt-4 mb-1 text-2xl font-bold tracking-tight text-ink-100">Diagnostics</h1>
      <p className="mb-8 text-sm text-ink-400">
        What this running server can actually see. Secret values are never shown — only
        whether they are present and how long they are.
      </p>

      <Card title="Status">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Data"
            value={d.dataMode === "supabase" ? "Supabase" : "In-memory sample data"}
            ok={d.dataMode === "supabase"}
          />
          <Stat
            label="Streaming"
            value={d.streamingMode === "livekit" ? "LiveKit" : "Development placeholders"}
            ok={d.streamingMode === "livekit"}
          />
        </dl>
      </Card>

      <Card
        title="Deployment"
        description="If the commit below predates your latest push, redeploy — environment variables are applied when a deployment is created, not retroactively."
      >
        <dl className="flex flex-col gap-2">
          {d.deployment.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 text-sm">
              <dt className="text-ink-400">{row.label}</dt>
              <dd className="font-mono text-ink-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title="Supabase variables"
        description="All three must be present for FluxCast to use the database."
      >
        <EnvList checks={supabaseVars} />
      </Card>

      <Card
        title="LiveKit variables"
        description="All three must be present for real stream destinations."
      >
        <EnvList checks={livekitVars} />
      </Card>

      {d.supabaseConfigured ? (
        <>
          <Card title="Database connection">
            <div className="flex flex-col gap-3">
              <ConnResult
                label="Public read (publishable key + RLS)"
                result={d.publicRead}
                hint="This is how fans read the schedule. A failure here usually means the migration's RLS policies did not run."
              />
              <ConnResult
                label="Service role read"
                result={d.serviceRead}
                hint="This is how the admin area writes. A failure here usually means the service role key is wrong."
              />
            </div>
          </Card>

          <Card
            title="Tables"
            description="Row counts. Zero rows in every table means the migration ran but the seed did not."
          >
            {d.tables.length === 0 ? (
              <p className="text-sm text-ink-400">Could not read table counts.</p>
            ) : (
              <dl className="flex flex-col gap-2">
                {d.tables.map((t) => (
                  <div key={t.table} className="flex items-center justify-between gap-4 text-sm">
                    <dt className="font-mono text-ink-300">{t.table}</dt>
                    <dd
                      className={
                        t.error
                          ? "text-rose-300"
                          : t.count === 0
                            ? "text-amber-300"
                            : "text-ink-100"
                      }
                    >
                      {t.error ? t.error : `${t.count} row${t.count === 1 ? "" : "s"}`}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </>
      ) : (
        <Card title="Database connection">
          <p className="text-sm text-ink-400">
            Not attempted — Supabase is not fully configured, so there is nothing to connect
            to yet.
          </p>
        </Card>
      )}
    </div>
  );
}

function EnvList({ checks }: { checks: EnvCheck[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {checks.map((c) => (
        <li key={c.label} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink-200">
              <Mark ok={c.present} /> {c.label}
            </span>
            <span className="font-mono text-xs text-ink-400">
              {c.present
                ? c.secret
                  ? `set · ${c.length} chars`
                  : (c.displayValue ?? "set")
                : "missing"}
            </span>
          </div>
          <p className="font-mono text-xs text-ink-500">
            {c.present ? (
              <>
                read from <span className="text-ink-300">{c.source}</span>
                {c.source !== c.candidates[0] && (
                  <span className="text-amber-300">
                    {" "}
                    — fallback name; prefer {c.candidates[0]}
                  </span>
                )}
              </>
            ) : (
              <>set {c.candidates[0]}</>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ConnResult({
  label,
  result,
  hint,
}: {
  label: string;
  result: { ok: boolean; error: string | null } | null;
  hint: string;
}) {
  if (!result) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-ink-200">
        <Mark ok={result.ok} /> {label}
      </p>
      {result.error && (
        <p className="mt-1 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-100">
          {result.error}
        </p>
      )}
      {!result.ok && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "text-flux-400" : "text-rose-400"} aria-label={ok ? "ok" : "problem"}>
      {ok ? "✓" : "✗"}
    </span>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div>
      <dt className="eyebrow text-ink-400">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${ok ? "text-ink-100" : "text-amber-300"}`}>
        <Mark ok={ok} /> {value}
      </dd>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-lg border border-ink-800 bg-ink-900 p-5">
      <h2 className="text-base font-bold tracking-tight text-ink-100">{title}</h2>
      {description && <p className="mt-1 mb-4 text-sm text-ink-400">{description}</p>}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </section>
  );
}
