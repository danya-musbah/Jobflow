// ============================================================
// JOBFLOW — js/supabase.js
// Single shared Supabase client instance. Every other module
// imports `supabase` from here instead of creating its own client.
// The Supabase JS library itself is loaded from a CDN in index.html
// (window.supabase), so no npm install is required.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configurationErrorMessage =
  "Supabase is not configured yet. Copy config.example.js to js/config.js and add your project URL and anon key.";

function makeUnavailableSupabase() {
  const fail = async () => {
    throw new Error(configurationErrorMessage);
  };

  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: fail,
    signUp: fail,
    signOut: fail,
    resetPasswordForEmail: fail,
    updateUser: fail,
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
      error: null,
    }),
  };

  const from = () => {
    const query = {
      select() {
        return Promise.reject(new Error(configurationErrorMessage));
      },
      insert() {
        return Promise.reject(new Error(configurationErrorMessage));
      },
      update() {
        return Promise.reject(new Error(configurationErrorMessage));
      },
      delete() {
        return Promise.reject(new Error(configurationErrorMessage));
      },
      eq() {
        return query;
      },
      ilike() {
        return query;
      },
      or() {
        return query;
      },
      order() {
        return query;
      },
      range() {
        return query;
      },
      limit() {
        return query;
      },
      gte() {
        return query;
      },
      lt() {
        return query;
      },
      maybeSingle() {
        return Promise.reject(new Error(configurationErrorMessage));
      },
      single() {
        return Promise.reject(new Error(configurationErrorMessage));
      },
    };
    return query;
  };

  return {
    auth,
    from,
    functions: {
      invoke: fail,
    },
  };
}

const placeholderValues = new Set([
  "YOUR_SUPABASE_URL",
  "YOUR_SUPABASE_ANON_KEY",
  "https://example-project.supabase.co",
  "your-anon-key-here",
  "public-anon-key-placeholder",
]);

const hasPlaceholderCredentials =
  placeholderValues.has(SUPABASE_URL) ||
  placeholderValues.has(SUPABASE_ANON_KEY) ||
  !/^https?:\/\//i.test(String(SUPABASE_URL || "").trim()) ||
  !String(SUPABASE_ANON_KEY || "").trim();

const hasSupabaseLibrary = !!(
  window.supabase && typeof window.supabase.createClient === "function"
);

if (!hasSupabaseLibrary) {
  console.warn(
    "[JobFlow] Supabase client library not loaded. The app will run in a safe, non-connected mode until credentials are configured.",
  );
}

if (hasPlaceholderCredentials) {
  console.warn(
    "[JobFlow] js/config.js still has placeholder Supabase credentials. Copy config.example.js to js/config.js and add your project URL/anon key.",
  );
}

export const supabase =
  hasSupabaseLibrary && !hasPlaceholderCredentials
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : makeUnavailableSupabase();

export const isSupabaseConfigured =
  hasSupabaseLibrary && !hasPlaceholderCredentials;
