/**
 * Banner shown whenever any part of the stack is running on stand-ins.
 *
 * The point is that nothing in FluxCast ever quietly pretends an external
 * service is connected — if it is fake, it says so, on screen.
 */
import Link from "next/link";

export function DevModeNotice({
  dataMode,
  streamingMode,
}: {
  dataMode: "mock" | "supabase";
  streamingMode: "livekit" | "mock";
}) {
  const missing: string[] = [];
  if (dataMode === "mock") missing.push("Supabase");
  if (streamingMode === "mock") missing.push("LiveKit");
  if (missing.length === 0) return null;

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs sm:px-6">
        <span className="rounded-sm bg-amber-400/20 px-1.5 py-0.5 font-bold uppercase tracking-[0.14em] text-amber-200">
          Development mode
        </span>
        <span className="text-amber-100/80">
          {missing.join(" and ")} {missing.length > 1 ? "are" : "is"} not configured. Data and
          stream credentials on this page are stand-ins, not real.
        </span>
        <Link
          href="/admin/diagnostics"
          className="font-semibold text-amber-200 underline underline-offset-2 transition hover:text-amber-100"
        >
          Why?
        </Link>
      </div>
    </div>
  );
}
