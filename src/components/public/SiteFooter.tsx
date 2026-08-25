import { Wordmark } from "@/components/ui/Wordmark";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink-800/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-400 sm:px-6">
        <Wordmark size="sm" href={null} />
        <p>Live school sports, all in one place.</p>
      </div>
    </footer>
  );
}
