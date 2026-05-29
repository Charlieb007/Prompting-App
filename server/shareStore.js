/* Persistent storage for shared prompts.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are
 * configured (durable across restarts/redeploys — the right choice for hosts
 * with an ephemeral filesystem like Render's free tier). Otherwise it falls
 * back to a local shares.json file + in-memory cache so local dev needs no
 * external service. The Redis client is imported lazily, so the dependency is
 * only loaded when creds are present.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const KEY_PREFIX = 'share:';

let redis = null;
let backend = 'file';
let sharesFile = null;
const memoryShares = {};

export async function initShareStore({ dataDir }) {
  try { mkdirSync(dataDir, { recursive: true }); } catch { /* already exists */ }
  sharesFile = join(dataDir, 'shares.json');

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    backend = 'upstash';
  } else {
    backend = 'file';
  }
  return backend;
}

export function shareBackend() {
  return backend;
}

function loadFile() {
  if (!sharesFile || !existsSync(sharesFile)) return {};
  try { return JSON.parse(readFileSync(sharesFile, 'utf8')); } catch { return {}; }
}

function saveFile(shares) {
  if (!sharesFile) return;
  try { writeFileSync(sharesFile, JSON.stringify(shares, null, 2), 'utf8'); }
  catch { /* read-only filesystem — memory cache still serves this session */ }
}

export async function saveShare(entry) {
  if (redis) {
    // @upstash/redis serializes objects to JSON automatically.
    await redis.set(KEY_PREFIX + entry.id, entry);
    return;
  }
  memoryShares[entry.id] = entry;
  const shares = loadFile();
  shares[entry.id] = entry;
  saveFile(shares);
}

export async function getShare(id) {
  if (redis) {
    return (await redis.get(KEY_PREFIX + id)) || null;
  }
  return memoryShares[id] || loadFile()[id] || null;
}
