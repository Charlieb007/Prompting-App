import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabase, isSupabaseConfigured } from './supabase.js';

// With no VITE_SUPABASE_* env vars, the app must stay in anonymous/local-only
// mode: the client is null and callers can detect that it's unconfigured.
test('supabase is unconfigured (anonymous mode) when env vars are absent', () => {
  assert.equal(isSupabaseConfigured, false);
  assert.equal(supabase, null);
});
