/**
 * Make a LiveKit failure actionable.
 *
 * The SDK's errors carry the useful part in different places depending on
 * whether the call was rejected by the API, by the network, or by auth, and the
 * default string is often just "fetch failed".
 */
export function describeLiveKitError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const parts = [error.message];
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) parts.push(cause.message);

  const message = parts.filter(Boolean).join(" — ");

  // Order matters. A spent monthly allowance and too many simultaneous
  // ingresses both say "exceeded", but the fixes are opposites: releasing a
  // destination frees a concurrency slot and does nothing at all for minutes.
  // Matching them together produced advice that wasted an operator's time.
  if (/minutes|usage|bandwidth|billing|plan/i.test(message)) {
    return `${message}. This is a usage allowance on the LiveKit plan, not a concurrency limit — releasing a destination will NOT help. Check usage in LiveKit Cloud; the allowance resets on the billing period, or the plan can be upgraded.`;
  }
  if (/concurrent|too many|limit reached|max/i.test(message)) {
    return `${message}. The project's limit on simultaneous stream destinations is reached. Release the destination on a finished broadcast to free one, or raise the limit in LiveKit Cloud.`;
  }
  if (/limit|quota|exceed/i.test(message)) {
    return `${message}. A LiveKit limit was hit. Check the project's usage and limits in LiveKit Cloud — if it names minutes or bandwidth, releasing a destination will not help.`;
  }
  if (/unauthorized|invalid api key|401|permission/i.test(message)) {
    return `${message}. Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET — a key from a different project will fail this way.`;
  }
  if (/not found|404/i.test(message)) {
    return `${message}. Check LIVEKIT_URL points at this project.`;
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    return `${message}. FluxCast could not reach LiveKit at all — check LIVEKIT_URL.`;
  }
  if (/ingress/i.test(message) && /enabled|disabled|not available/i.test(message)) {
    return `${message}. Ingress may not be enabled on this LiveKit project.`;
  }
  return message;
}
