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

export interface SignInState {
  error: string | null;
}

export const emptySignInState: SignInState = { error: null };

export interface FormResultState {
  error: string | null;
  fieldErrors: Record<string, string>;
  /** Set on success so the form can confirm without navigating away. */
  success: string | null;
}

export const emptyFormResultState: FormResultState = {
  error: null,
  fieldErrors: {},
  success: null,
};
