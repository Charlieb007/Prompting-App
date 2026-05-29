/* Server-side Supabase auth (accounts/DB milestone 5).
 *
 * Validates the Supabase access token sent by the client so AI routes can tie
 * a request to a real user. Soft by design: if Supabase isn't configured or no
 * valid token is present, requests still proceed anonymously (the app allows
 * anonymous use). Needs server env SUPABASE_URL + SUPABASE_ANON_KEY (falls back
 * to the VITE_ names for convenience in local dev).
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const supabaseAuthEnabled = Boolean(URL && ANON);

const base = supabaseAuthEnabled
  ? createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// Validate a Supabase access token; return the user object or null. Best-effort
// — never throws, so a flaky auth check can't take down an AI request.
export async function getUserFromToken(token) {
  if (!base || !token) return null;
  try {
    const { data, error } = await base.auth.getUser(token);
    if (error) return null;
    return data.user || null;
  } catch {
    return null;
  }
}
