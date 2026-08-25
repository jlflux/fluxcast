import type { StreamCredentials } from "@/lib/livekit/service";
import { CopyButton } from "@/components/ui/CopyButton";
import { SecretField } from "@/components/ui/SecretField";

/**
 * The RTMP destination an operator pastes into OBS or Restream.
 *
 * The stream key is masked by default and read back from LiveKit on each view —
 * FluxCast never stores it.
 */
export function StreamDestination({ credentials }: { credentials: StreamCredentials }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold tracking-tight text-ink-100">Stream destination</h2>
        {credentials.mock && (
          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
            Development only
          </span>
        )}
      </div>

      {credentials.mock && (
        <p className="mb-4 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          These are placeholder values. Nothing is listening on this address. Configure
          LiveKit to get a real destination.
        </p>
      )}

      <div className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="stream-url"
            className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink-400"
          >
            Stream URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code
              id="stream-url"
              className="min-w-0 flex-1 overflow-x-auto rounded-md border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-sm text-ink-100"
            >
              {credentials.streamUrl}
            </code>
            <CopyButton value={credentials.streamUrl} />
          </div>
        </div>

        <div>
          <label
            htmlFor="stream-key"
            className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink-400"
          >
            Stream key
          </label>
          <SecretField id="stream-key" value={credentials.streamKey} />
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-400">
        In OBS: <span className="text-ink-200">Settings → Stream</span>, choose{" "}
        <span className="text-ink-200">Custom…</span>, then paste the URL into{" "}
        <span className="text-ink-200">Server</span> and the key into{" "}
        <span className="text-ink-200">Stream Key</span>. Treat the key like a password.
      </p>
    </div>
  );
}
