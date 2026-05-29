import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import {
  buildSystemPrompt,
  parseRefinerResponse,
  REFINER_USER_TEMPLATE,
  FOLLOWUP_USER_TEMPLATE,
} from './lib.js';
import { initShareStore, saveShare, getShare } from './shareStore.js';
import { supabaseAuthEnabled, getUserFromToken, recordUsageEvent, getPlanLimits, refinementGate } from './serverSupabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// DATA_DIR: file-fallback location for shares when Upstash Redis isn't configured.
const DATA_DIR = process.env.DATA_DIR || __dirname;

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: restrict to allowed origins in production, or allow all when not configured.
// Set ALLOWED_ORIGINS as a comma-separated list in your Render env vars.
// e.g. ALLOWED_ORIGINS=https://your-app.vercel.app,https://custom-domain.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all origins

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (curl, Postman, browser extension)
    if (!origin) return callback(null, true);
    // If no allowlist configured, allow everything
    if (!allowedOrigins) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" is not allowed.`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Trust the first proxy hop (Render/Vercel sit in front) so req.ip reflects
// the real client address rather than the proxy's.
app.set('trust proxy', 1);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/* ── Rate limiting ─────────────────────────────────────── */
// Lightweight in-memory fixed-window limiter, applied to the AI/export routes
// that spend money or hit third parties. Per-instance (resets on restart and
// isn't shared across dynos), which is sufficient abuse protection for a
// single-instance deployment and adds no dependencies.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 30;
const rateBuckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of rateBuckets) if (now >= b.resetAt) rateBuckets.delete(ip);
}, RATE_LIMIT_WINDOW_MS).unref?.();

// Soft auth: if a valid Supabase token is present, attach the user; otherwise
// proceed anonymously (the app allows anonymous use). Place before rateLimit so
// limits can be keyed per-user.
async function attachUser(req, res, next) {
  req.user = null;
  req.accessToken = null;
  if (supabaseAuthEnabled) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const user = await getUserFromToken(token);
      if (user) { req.user = user; req.accessToken = token; }
    }
  }
  next();
}

function rateLimit(req, res, next) {
  // Key by authenticated user when available, else client IP.
  const ip = req.user?.id ? `user:${req.user.id}` : (req.ip || req.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - bucket.count));
  if (bucket.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: `Too many requests. Try again in ${retryAfter}s.` });
  }
  next();
}

/* ── SSE helpers ───────────────────────────────────────── */

function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

function sendEvent(res, eventName, data) {
  if (res.writableEnded) return;
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Wire client-disconnect cancellation onto an SSE response. We listen on the
// *response* close (not req.on('close'), which fires spuriously during the SSE
// header flush in Express 5 / Node 20) and only abort once the response closes
// before we've marked the work finished. Pass `signal` to the Anthropic SDK and
// call `done()` right after the stream completes normally.
function wireAbort(res) {
  const controller = new AbortController();
  const state = { finished: false };
  res.on('close', () => {
    if (!state.finished) controller.abort();
  });
  return {
    signal: controller.signal,
    done: () => { state.finished = true; },
    aborted: () => controller.signal.aborted,
  };
}

/* ── /api/improve ─────────────────────────────────────── */

app.post('/api/improve', attachUser, rateLimit, async (req, res) => {
  const { prompt, category = 'general', model = 'claude-sonnet-4-6', previousRefined, feedback, dimensions, customInstructions, targetModel, promptType } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string.' });
  }
  if (prompt.length > 10000) {
    return res.status(400).json({ error: 'Prompt too long. Max 10,000 characters.' });
  }

  // Free-plan daily cap (authoritative; Pro is unlimited; anonymous is gated
  // client-side). Fails open if Supabase auth isn't configured.
  if (req.user) {
    const gate = await refinementGate(req.accessToken, req.user.id);
    if (!gate.allowed) {
      return res.status(429).json({
        error: `You've reached the free plan's ${gate.limit} refinements/day. Upgrade to Pro for unlimited refinements.`,
        code: 'plan_limit',
      });
    }
  }

  setupSSE(res);
  const abort = wireAbort(res);

  const systemPrompt = buildSystemPrompt(dimensions, { targetModel, promptType });

  const userMessage = (previousRefined && feedback)
    ? FOLLOWUP_USER_TEMPLATE(prompt, previousRefined, feedback, category, customInstructions)
    : REFINER_USER_TEMPLATE(prompt, category, customInstructions);

  const startTime = Date.now();
  let accumulatedText = '';
  let refinedSent = false;
  let lastRefinedSent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }, { signal: abort.signal });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const chunk = event.delta.text;
        accumulatedText += chunk;

        const refinedMatch = accumulatedText.match(/<<<REFINED_PROMPT>>>([\s\S]*?)(<<<CHANGES_JSON>>>|$)/);
        if (refinedMatch) {
          const currentRefined = refinedMatch[1];
          if (currentRefined.length > lastRefinedSent.length) {
            const newChars = currentRefined.slice(lastRefinedSent.length);
            const cleanNewChars = newChars.replace(/<<<CHANGES_JSON>>>$/, '').replace(/<<<CHANGES_JSON?$/, '').replace(/<<<C?H?A?N?$/, '');
            if (cleanNewChars) {
              sendEvent(res, 'refined-chunk', { text: cleanNewChars });
              lastRefinedSent += cleanNewChars;
            }
          }

          if (!refinedSent && accumulatedText.includes('<<<CHANGES_JSON>>>')) {
            refinedSent = true;
            sendEvent(res, 'refined-done', {});
          }
        }
      }

      if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens || outputTokens;
      }
      if (event.type === 'message_start' && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens || 0;
      }
    }

    const parsed = parseRefinerResponse(accumulatedText);

    if (parsed.changes.length > 0) {
      sendEvent(res, 'changes', { changes: parsed.changes });
    }
    if (parsed.scores) {
      sendEvent(res, 'scores', { scores: parsed.scores });
    }

    const latencyMs = Date.now() - startTime;

    abort.done();
    sendEvent(res, 'done', {
      usage: { inputTokens, outputTokens },
      latencyMs,
    });
    recordUsageEvent(req.accessToken, req.user?.id, { model, inputTokens, outputTokens, latencyMs, kind: feedback ? 'follow-up' : 'refinement' });
  } catch (err) {
    if (abort.aborted()) return;
    console.error('Refinement error:', err);
    sendEvent(res, 'error', { error: err.message || 'Refinement failed.' });
  } finally {
    abort.done();
    if (!res.writableEnded) res.end();
  }
});

/* ── /api/improve-compare ─────────────────────────────── */

app.post('/api/improve-compare', attachUser, rateLimit, async (req, res) => {
  const { prompt, category = 'general', models } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  if (!Array.isArray(models) || models.length === 0) {
    return res.status(400).json({ error: 'Models array is required.' });
  }
  if (models.length > 4) {
    return res.status(400).json({ error: 'Maximum 4 models for comparison.' });
  }

  setupSSE(res);
  const abort = wireAbort(res);
  sendEvent(res, 'compare-start', { models });

  const userMessage = REFINER_USER_TEMPLATE(prompt, category);
  const systemPrompt = buildSystemPrompt();

  const tasks = models.map(async (modelId) => {
    const startTime = Date.now();
    let accumulatedText = '';
    let lastRefinedSent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = await client.messages.stream({
        model: modelId,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }, { signal: abort.signal });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          accumulatedText += event.delta.text;
          const refinedMatch = accumulatedText.match(/<<<REFINED_PROMPT>>>([\s\S]*?)(<<<CHANGES_JSON>>>|$)/);
          if (refinedMatch) {
            const currentRefined = refinedMatch[1];
            if (currentRefined.length > lastRefinedSent.length) {
              const newChars = currentRefined.slice(lastRefinedSent.length);
              const cleanNewChars = newChars.replace(/<<<CHANGES_JSON>>>$/, '').replace(/<<<CHANGES_JSON?$/, '').replace(/<<<C?H?A?N?$/, '');
              if (cleanNewChars) {
                sendEvent(res, 'model-chunk', { modelId, text: cleanNewChars });
                lastRefinedSent += cleanNewChars;
              }
            }
          }
        }
        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens || outputTokens;
        }
        if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens || 0;
        }
      }

      const parsed = parseRefinerResponse(accumulatedText);
      if (parsed.changes.length > 0) {
        sendEvent(res, 'model-changes', { modelId, changes: parsed.changes });
      }
      if (parsed.scores) {
        sendEvent(res, 'model-scores', { modelId, scores: parsed.scores });
      }
      sendEvent(res, 'model-done', {
        modelId,
        usage: { inputTokens, outputTokens },
        latencyMs: Date.now() - startTime,
      });
      recordUsageEvent(req.accessToken, req.user?.id, { model: modelId, inputTokens, outputTokens, latencyMs: Date.now() - startTime, kind: 'compare' });
    } catch (err) {
      console.error(`Comparison error for ${modelId}:`, err);
      sendEvent(res, 'model-error', { modelId, error: err.message || 'Failed.' });
    }
  });

  await Promise.allSettled(tasks);
  abort.done();
  sendEvent(res, 'compare-done', {});
  if (!res.writableEnded) res.end();
});

/* ── /api/test-prompt ─────────────────────────────────── */

app.post('/api/test-prompt', attachUser, rateLimit, async (req, res) => {
  const { prompts, model = 'claude-sonnet-4-6' } = req.body;

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json({ error: 'Prompts array is required.' });
  }

  setupSSE(res);
  const abort = wireAbort(res);
  sendEvent(res, 'test-start', { count: prompts.length });

  const tasks = prompts.map(async ({ id, prompt }) => {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = await client.messages.stream({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: abort.signal });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          sendEvent(res, 'test-chunk', { id, text: event.delta.text });
        }
        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens || outputTokens;
        }
        if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens || 0;
        }
      }

      sendEvent(res, 'test-done', {
        id,
        usage: { inputTokens, outputTokens },
        latencyMs: Date.now() - startTime,
      });
      recordUsageEvent(req.accessToken, req.user?.id, { model, inputTokens, outputTokens, latencyMs: Date.now() - startTime, kind: 'test' });
    } catch (err) {
      console.error(`Test error for ${id}:`, err);
      sendEvent(res, 'test-error', { id, error: err.message || 'Test failed.' });
    }
  });

  await Promise.allSettled(tasks);
  abort.done();
  sendEvent(res, 'test-complete', {});
  if (!res.writableEnded) res.end();
});

/* ── /api/run-prompt ──────────────────────────────────── */

// Accepts a conversation as a list of messages and streams Claude's response.
// Client-disconnect cancellation is wired via wireAbort(), which listens on the
// response's 'close' event (not req.on('close'), which fired spuriously during
// the SSE header flush in Express 5 / Node 20) and aborts the Anthropic stream
// only when the connection closes before the work is marked finished.
app.post('/api/run-prompt', attachUser, rateLimit, async (req, res) => {
  const { messages, model = 'claude-sonnet-4-6' } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }
  if (messages.length > 50) {
    return res.status(400).json({ error: 'Conversation too long. Max 50 messages.' });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      return res.status(400).json({ error: 'Each message must be an object.' });
    }
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      return res.status(400).json({ error: 'Message role must be "user" or "assistant".' });
    }
    if (typeof msg.content !== 'string' || msg.content.trim() === '') {
      return res.status(400).json({ error: 'Each message must have non-empty string content.' });
    }
    if (msg.content.length > 50000) {
      return res.status(400).json({ error: 'Individual message exceeds 50,000 character limit.' });
    }
  }

  if (messages[0].role !== 'user') {
    return res.status(400).json({ error: 'First message must be from user.' });
  }

  setupSSE(res);
  const abort = wireAbort(res);

  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let chunkCount = 0;

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      messages,
    }, { signal: abort.signal });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        chunkCount++;
        sendEvent(res, 'run-chunk', { text: event.delta.text });
      }

      if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens || outputTokens;
      }

      if (event.type === 'message_start' && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens || 0;
      }
    }

    const latencyMs = Date.now() - startTime;
    abort.done();
    sendEvent(res, 'run-done', {
      usage: { inputTokens, outputTokens },
      latencyMs,
    });
    recordUsageEvent(req.accessToken, req.user?.id, { model, inputTokens, outputTokens, latencyMs, kind: 'run' });
  } catch (err) {
    if (abort.aborted()) return;
    console.error('[run-prompt] ERROR:', err.message || err);
    let userMessage = 'Failed to run prompt.';
    if (err.status === 401) {
      userMessage = 'API key is invalid or missing. Check your .env file.';
    } else if (err.status === 429) {
      userMessage = 'Rate limit reached. Wait a moment and try again.';
    } else if (err.status === 529) {
      userMessage = 'Anthropic API is overloaded. Try again in a few seconds.';
    } else if (err.status === 400) {
      userMessage = err.message || 'Bad request — your conversation may be malformed.';
    } else if (err.message) {
      userMessage = err.message;
    }
    sendEvent(res, 'run-error', { error: userMessage });
  } finally {
    abort.done();
    if (!res.writableEnded) res.end();
  }
});

/* ── Healthcheck ──────────────────────────────────────── */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Public: current daily refinement limits (admin-editable via app_config).
app.get('/api/limits', async (req, res) => {
  res.json(await getPlanLimits());
});

/* ── Share routes ─────────────────────────────────────── */
// Persistence is handled by shareStore.js (Upstash Redis when configured,
// local file + memory otherwise). See initShareStore() at startup.

app.post('/api/share', rateLimit, async (req, res) => {
  const { rough, improved, changes, scores, category, model } = req.body;
  if (!rough || !improved) {
    return res.status(400).json({ error: 'rough and improved are required.' });
  }
  const id = randomBytes(4).toString('hex');
  const entry = { id, rough, improved, changes, scores, category, model, createdAt: Date.now() };

  try {
    await saveShare(entry);
  } catch (err) {
    console.error('Share save error:', err);
    return res.status(500).json({ error: 'Could not save share.' });
  }

  // RENDER_EXTERNAL_URL is set automatically by Render; APP_URL can be set manually.
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || `http://localhost:${PORT}`;
  const url = `${baseUrl}/share/${id}`;
  res.json({ id, url });
});

app.get('/api/share/:id', async (req, res) => {
  const entry = await getShare(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Share not found.' });
  res.json(entry);
});

app.get('/share/:id', async (req, res) => {
  const entry = await getShare(req.params.id);
  if (!entry) return res.status(404).send('<h1>Not found</h1><p>This shared prompt does not exist.</p>');

  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const changesHtml = entry.changes?.map(c =>
    `<li><strong>${esc(c.title)}</strong> — ${esc(c.explanation)}</li>`
  ).join('') || '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shared Prompt — Prompt Refina</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; background: #f8f8fc; }
    h1 { font-size: 1.4rem; color: #6b48c0; }
    h2 { font-size: 1rem; color: #555; margin-top: 28px; text-transform: uppercase; letter-spacing: 0.05em; }
    .box { background: #fff; border: 1px solid #e2e2ef; border-radius: 10px; padding: 18px 20px; white-space: pre-wrap; line-height: 1.6; font-size: 0.95rem; }
    .meta { font-size: 0.8rem; color: #888; margin-bottom: 20px; }
    ul { line-height: 1.8; }
    a { color: #6b48c0; }
  </style>
</head>
<body>
  <h1>Shared Prompt</h1>
  <p class="meta">Category: ${esc(entry.category)} · Model: ${esc(entry.model)} · Shared via <a href="${process.env.APP_FRONTEND_URL || 'https://promptrefina.vercel.app'}">Prompt Refina</a></p>
  <h2>Original</h2>
  <div class="box">${esc(entry.rough)}</div>
  <h2>Refined</h2>
  <div class="box">${esc(entry.improved)}</div>
  ${changesHtml ? `<h2>What Changed</h2><ul>${changesHtml}</ul>` : ''}
</body>
</html>`);
});

/* ── Export to Notion ─────────────────────────────────────── */

app.post('/api/export/notion', rateLimit, async (req, res) => {
  const { rough, improved, changes, category, model, token, databaseId } = req.body;

  if (!token)      return res.status(400).json({ error: 'Notion API token is required.' });
  if (!databaseId) return res.status(400).json({ error: 'Notion database ID is required.' });
  if (!rough || !improved) return res.status(400).json({ error: 'rough and improved are required.' });

  const changesText = (changes || [])
    .map(c => `• ${c.title}: ${c.explanation}`)
    .join('\n');

  const titleText = `Refined prompt · ${category || 'general'}`;

  const children = [
    { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: 'Original' } }] } },
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: rough.slice(0, 2000) } }] } },
    { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: 'Refined' } }] } },
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: improved.slice(0, 2000) } }] } },
  ];

  if (changesText) {
    children.push(
      { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: 'What changed' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: changesText.slice(0, 2000) } }] } }
    );
  }

  if (model) {
    children.push({
      object: 'block', type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: `Model: ${model}` }, annotations: { color: 'gray' } }] },
    });
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          title: { title: [{ text: { content: titleText } }] },
        },
        children,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      res.json({ ok: true, url: data.url, id: data.id });
    } else {
      console.error('Notion API error:', data);
      res.status(response.status).json({ error: data.message || 'Notion API returned an error.' });
    }
  } catch (err) {
    console.error('Notion export error:', err);
    res.status(500).json({ error: 'Could not reach Notion API.' });
  }
});

/* ── Export to Slack ──────────────────────────────────────── */

app.post('/api/export/slack', rateLimit, async (req, res) => {
  const { rough, improved, changes, category, model, webhookUrl } = req.body;

  if (!webhookUrl) return res.status(400).json({ error: 'Slack webhook URL is required.' });
  if (!rough || !improved) return res.status(400).json({ error: 'rough and improved are required.' });

  const changesSection = (changes || []).length
    ? `*What changed:*\n${changes.map(c => `• *${c.title}*: ${c.explanation}`).join('\n')}`
    : '';

  const text = [
    `*Refined prompt* · _${category || 'general'}_ · ${model || ''}`,
    '',
    `*Original:*\n>${rough.replace(/\n/g, '\n>')}`,
    '',
    `*Refined:*\n>${improved.replace(/\n/g, '\n>')}`,
    changesSection ? `\n${changesSection}` : '',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      res.json({ ok: true });
    } else {
      const body = await response.text();
      res.status(response.status).json({ error: body || 'Slack webhook returned an error.' });
    }
  } catch (err) {
    console.error('Slack export error:', err);
    res.status(500).json({ error: 'Could not reach Slack webhook.' });
  }
});

/* ── AI Critique ──────────────────────────────────────────── */

app.post('/api/critique', attachUser, rateLimit, async (req, res) => {
  const { prompt, model } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required.' });

  const critiqueModel = model || 'claude-opus-4-8';

  setupSSE(res);
  const abort = wireAbort(res);

  const systemPrompt = `You are a prompt quality analyst. Your job is to identify specific, actionable weaknesses in AI prompts.

When given a prompt, output ONLY a short bullet-point critique with:
- 2–4 specific remaining weaknesses or missing elements
- 1–2 concrete suggestions to make it even stronger

Rules:
- Be direct and specific — name exactly what is weak or missing
- No praise, no "this is good" filler, no preamble
- Each bullet starts with a bold category label like **Missing:** or **Vague:** or **Suggestion:**
- Keep each bullet to 1–2 sentences maximum`;

  const userMessage = `Critique this prompt:\n\n${prompt}`;

  try {
    let fullText = '';
    const startTime = Date.now();

    const stream = await client.messages.stream({
      model: critiqueModel,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }, { signal: abort.signal });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text;
        fullText += text;
        sendEvent(res, 'critique-chunk', { text });
      }
    }

    const finalMessage = await stream.finalMessage();
    const latencyMs = Date.now() - startTime;
    const cInput = finalMessage.usage?.input_tokens || 0;
    const cOutput = finalMessage.usage?.output_tokens || 0;
    abort.done();
    sendEvent(res, 'critique-done', {
      usage: { inputTokens: cInput, outputTokens: cOutput },
      latencyMs,
    });
    recordUsageEvent(req.accessToken, req.user?.id, { model: critiqueModel, inputTokens: cInput, outputTokens: cOutput, latencyMs, kind: 'critique' });

  } catch (err) {
    if (abort.aborted()) return;
    console.error('/api/critique error:', err);
    sendEvent(res, 'critique-error', { error: err.message || 'Critique failed.' });
  } finally {
    abort.done();
    if (!res.writableEnded) res.end();
  }
});

/* ── /api/eval ────────────────────────────────────────── */
// Runs a prompt against a set of test cases and, when an expected result is
// provided, grades each output with an LLM judge. Streams per-case output via
// 'eval-chunk', then 'eval-graded' and 'eval-done', and a final 'eval-complete'.
const EVAL_JUDGE_SYSTEM = `You are a strict evaluation judge. You are given an EXPECTED result description and the ACTUAL output a model produced for a prompt. Decide how well the actual output satisfies the expectation.

Respond with ONLY a JSON object, no prose, in this exact shape:
{"pass": true|false, "score": 0-100, "reason": "one or two sentences"}

Be strict but fair: "pass" is true only when the actual output meets the core of the expectation. Score reflects the overall quality of the match.`;

app.post('/api/eval', attachUser, rateLimit, async (req, res) => {
  const { prompt, model = 'claude-sonnet-4-6', cases, judgeModel } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required.' });
  }
  if (!Array.isArray(cases) || cases.length === 0) {
    return res.status(400).json({ error: 'cases array is required.' });
  }
  if (cases.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 test cases.' });
  }

  setupSSE(res);
  const abort = wireAbort(res);
  sendEvent(res, 'eval-start', { count: cases.length });

  const judge = judgeModel || model;

  const tasks = cases.map(async (testCase) => {
    const { id, input, expected } = testCase || {};
    const startTime = Date.now();
    let output = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const content = input ? `${prompt}\n\n${input}` : prompt;
      const stream = await client.messages.stream({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      }, { signal: abort.signal });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          output += event.delta.text;
          sendEvent(res, 'eval-chunk', { id, text: event.delta.text });
        }
        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens || outputTokens;
        }
        if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens || 0;
        }
      }

      if (expected && typeof expected === 'string' && expected.trim()) {
        try {
          const judgeMsg = await client.messages.create({
            model: judge,
            max_tokens: 300,
            system: EVAL_JUDGE_SYSTEM,
            messages: [{ role: 'user', content: `EXPECTED:\n${expected}\n\nACTUAL:\n${output}` }],
          }, { signal: abort.signal });
          const judgeText = (judgeMsg.content || []).map(b => b.text || '').join('');
          const match = judgeText.match(/\{[\s\S]*\}/);
          let verdict = null;
          if (match) { try { verdict = JSON.parse(match[0]); } catch { /* ignore malformed judge JSON */ } }
          sendEvent(res, 'eval-graded', verdict
            ? { id, pass: !!verdict.pass, score: typeof verdict.score === 'number' ? verdict.score : null, reason: verdict.reason || '' }
            : { id, pass: null, score: null, reason: 'Could not parse judge response.' });
        } catch (judgeErr) {
          if (!abort.aborted()) sendEvent(res, 'eval-graded', { id, pass: null, score: null, reason: 'Grading failed.' });
        }
      }

      sendEvent(res, 'eval-done', { id, usage: { inputTokens, outputTokens }, latencyMs: Date.now() - startTime });
      recordUsageEvent(req.accessToken, req.user?.id, { model, inputTokens, outputTokens, latencyMs: Date.now() - startTime, kind: 'eval' });
    } catch (err) {
      if (abort.aborted()) return;
      console.error(`Eval error for ${id}:`, err);
      sendEvent(res, 'eval-error', { id, error: err.message || 'Eval failed.' });
    }
  });

  await Promise.allSettled(tasks);
  abort.done();
  sendEvent(res, 'eval-complete', {});
  if (!res.writableEnded) res.end();
});

const shareStoreBackend = await initShareStore({ dataDir: DATA_DIR });

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Share storage: ${shareStoreBackend}${shareStoreBackend === 'file' ? ' (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for durable shares)' : ''}`);
});
