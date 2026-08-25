import Link from "next/link";

import { Wordmark } from "@/components/ui/Wordmark";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <Wordmark size="lg" />
      <h1 className="headline text-2xl text-ink-100">We couldn&rsquo;t find that page</h1>
      <p className="text-sm text-ink-400">
        The broadcast may have been removed, or the link may be out of date.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-flux-400 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-flux-300"
      >
        Back to FluxCast
      </Link>
    </div>
  );
}
