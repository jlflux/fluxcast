import { signOutAction } from "@/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-md border border-ink-700 px-2.5 py-1 text-xs font-semibold text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
      >
        Sign out
      </button>
    </form>
  );
}
