export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-800 bg-ink-900/40 px-6 py-10 text-center">
      <p className="font-semibold text-ink-200">{title}</p>
      <p className="mt-1 text-sm text-ink-400">{body}</p>
    </div>
  );
}
