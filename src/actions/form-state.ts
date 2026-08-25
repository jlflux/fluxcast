/**
 * Shared shapes for `useActionState`.
 *
 * Kept out of the `"use server"` module because a Server Actions file may only
 * export async functions — a plain constant there is a build error.
 */

export interface CreateBroadcastState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

export const emptyCreateBroadcastState: CreateBroadcastState = {
  error: null,
  fieldErrors: {},
};
