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

// Per-MTok pricing — keep in sync with PRICING in client/src/constants.js.
const PRICING = {
  'claude-opus-4-8':           { input: 5.0,  output: 25.0 },
  'claude-opus-4-6':           { input: 5.0,  output: 25.0 },
  'claude-sonnet-4-6':         { input: 3.0,  output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0,  output:  5.0 },
};
function costFor(model, inputTokens, outputTokens) {
  const r = PRICING[model];
  return r ? (inputTokens / 1e6) * r.input + (outputTokens / 1e6) * r.output : null;
}

// Record a usage event server-side (trustworthy metering for billing). Writes
// as the user via their token so RLS's "insert own usage" policy applies.
// Best-effort and fire-and-forget — never throws, never blocks the response.
export async function recordUsageEvent(token, userId, { model, inputTokens = 0, outputTokens = 0, latencyMs = null, kind = null } = {}) {
  if (!supabaseAuthEnabled || !token || !userId) return;
  if (!inputTokens && !outputTokens) return;
  try {
    const client = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { error } = await client.from('usage_events').insert({
      user_id: userId,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: costFor(model, inputTokens, outputTokens),
      kind,
      latency_ms: latencyMs,
    });
    if (error) console.error('usage_events insert failed:', error.message);
  } catch (e) {
    console.error('recordUsageEvent error:', e.message);
  }
}
