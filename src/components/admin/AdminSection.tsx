import type { ReactNode } from "react";

export function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-base font-bold tracking-tight text-ink-100">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}
