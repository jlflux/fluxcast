import Link from "next/link";

import { Wordmark } from "@/components/ui/Wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-5 text-sm font-medium text-ink-300">
          <Link href="/schools/homewood" className="transition hover:text-ink-100">
            Homewood
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
