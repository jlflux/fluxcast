import Link from "next/link";

import { dataMode, streamingMode } from "@/lib/env.server";
import { adminIsUnprotected } from "@/lib/auth";
import { Wordmark } from "@/components/ui/Wordmark";
import { DevModeNotice } from "@/components/ui/DevModeNotice";

/** Admin always reflects current state; never prerender it. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <DevModeNotice dataMode={dataMode} streamingMode={streamingMode} />

      {adminIsUnprotected && (
        <div className="border-b border-rose-500/25 bg-rose-500/10">
          <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-rose-100/90 sm:px-6">
            <span className="font-bold uppercase tracking-[0.14em]">Unprotected</span> — the
            admin area has no sign-in yet. Do not deploy it publicly until Supabase
            authentication is wired up.
          </div>
        </div>
      )}

      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Wordmark size="sm" />
            <span className="eyebrow rounded border border-ink-700 px-1.5 py-0.5 text-ink-400">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-ink-300 transition hover:text-ink-100">
              Dashboard
            </Link>
            <Link href="/" className="text-ink-300 transition hover:text-ink-100">
              View site
            </Link>
            <Link
              href="/admin/broadcasts/new"
              className="rounded-md bg-flux-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300"
            >
              Create Broadcast
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 bg-ink-950">{children}</main>
    </>
  );
}
