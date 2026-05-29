/**
 * Supabase data access for logged-in users (accounts/DB milestone 4).
 *
 * Synced collections (refinements/saved_prompts/conversations) are stored as
 * { id, user_id, data } where `data` is the full app entry — lossless, no field
 * mapping. usage_events are typed (metering). All functions no-op when Supabase
 * isn't configured, so anonymous/local-only mode is never affected.
 */

import { supabase } from './supabase.js';

function rowToUsage(r) {
  return {
    id: r.id,
    timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUSD: r.cost != null ? Number(r.cost) : null,
    latencyMs: r.latency_ms,
    kind: r.kind,
  };
}

// Load everything for a user. Returns null when Supabase isn't configured.
export async function cloudFetchAll(userId) {
  if (!supabase) return null;
  const [ref, sav, conv, use, set] = await Promise.all([
    supabase.from('refinements').select('data,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('saved_prompts').select('data,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('conversations').select('data,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('usage_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('settings').select('data').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    history: (ref.data || []).map(r => r.data),
    saved: (sav.data || []).map(r => r.data),
    conversations: (conv.data || []).map(r => r.data),
    usage: (use.data || []).map(rowToUsage),
    settings: set.data?.data ?? null,
  };
}

function idList(ids) {
  // PostgREST `in` filter value list, with each id quoted.
  return `(${ids.map(id => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
}

/**
 * Reconcile a synced collection to the cloud: upsert the current items, then
 * delete rows the user no longer has. Upsert-first means a failed prune only
 * leaves a stale row — never data loss. `idOf` returns each item's stable id.
 */
export async function cloudReplaceCollection(table, userId, items, idOf) {
  if (!supabase) return;
  const rows = items.map(item => ({ id: String(idOf(item)), user_id: userId, data: item }));

  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) { console.error(`cloud upsert ${table} failed:`, error.message); return; }
  }

  let del = supabase.from(table).delete().eq('user_id', userId);
  if (rows.length) del = del.not('id', 'in', idList(rows.map(r => r.id)));
  const { error } = await del;
  if (error) console.error(`cloud prune ${table} failed:`, error.message);
}

// Usage metering is recorded server-side (see server recordUsageEvent), so the
// client no longer writes usage_events directly.

export async function cloudUpsertSettings(userId, data) {
  if (!supabase) return;
  const { error } = await supabase.from('settings').upsert({ user_id: userId, data }, { onConflict: 'user_id' });
  if (error) console.error('cloud settings upsert failed:', error.message);
}
