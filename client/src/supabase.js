/**
 * Supabase client for Prompt Refina.
 *
 * Auth and cloud sync are OPT-IN and ADDITIVE: the app is fully usable
 * anonymously (local-only via localStorage). Supabase is only initialized when
 * both env vars are present, and even then signing in is optional — anonymous
 * visitors keep working exactly as before.
 *
 * Set in client/.env (see .env.example):
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon public key>
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// null when not configured — callers must treat a missing client as
// "anonymous / local-only mode", never assume it exists.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
