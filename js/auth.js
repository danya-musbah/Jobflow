// ============================================================
// JOBFLOW — js/auth.js
// Thin wrapper around Supabase Auth. All password handling is
// delegated entirely to Supabase — this app never stores or
// touches raw passwords itself.
// ============================================================

import { supabase } from './supabase.js';

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || email.split('@')[0] },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Sends a password-recovery email. Supabase redirects the user back
 * to `redirectTo` with a recovery token in the URL, which the app
 * detects (via detectSessionInUrl) and shows the "set new password" form.
 */
export async function resetPasswordForEmail(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname}?view=reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Called from the reset-password screen once the user is in a recovery session. */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to auth state changes (SIGNED_IN, SIGNED_OUT, PASSWORD_RECOVERY, TOKEN_REFRESHED). */
export function listenForAuthChanges(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}
