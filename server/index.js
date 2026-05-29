import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// DATA_DIR: use a persistent disk mount on Render, or fall back to __dirname for local dev.
const DATA_DIR = process.env.DATA_DIR || __dirname;
try { mkdirSync(DATA_DIR, { recursive: true }); } catch { /* already exists */ }
const SHARES_FILE = join(DATA_DIR, 'shares.json');

function loadShares() {
  if (!existsSync(SHARES_FILE)) return {};
  try { return JSON.parse(readFileSync(SHARES_FILE, 'utf8')); } catch { return {}; }
}

function saveShares(shares) {
  writeFileSync(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf8');
}

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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/* ── Refiner system prompt ─────────────────────────────── */

const DEFAULT_DIMENSIONS = [
  { id: 'specificity', label: 'Specificity', description: 'Concreteness and detail of the request.' },
  { id: 'audience',    label: 'Audience',    description: 'Who the response is for and what they need.' },
  { id: 'format',      label: 'Format',      description: 'Whether the desired output format is specified.' },
  { id: 'constraints', label: 'Constraints', description: 'Limits, exclusions, requirements stated.' },
  { id: 'examples',   label: 'Examples',    description: 'Examples provided or step-by-step reasoning requested.' },
];

function buildSystemPrompt(dimensions) {
  const dims = dimensions && dimensions.length > 0 ? dimensions : DEFAULT_DIMENSIONS;
  const dimList = dims.map(d => `  - ${d.id}: ${d.description || d.label}`).join('\n');
  const dimKeys = dims.map(d => d.id).join(', ');

  return `You are a prompt engineering specialist. Your job is to take a rough, vague, or incomplete prompt from a user and refine it into a well-structured prompt that will get better results from an AI model.

When refining a prompt, you should:
- Add specificity (what exactly is being asked?)
- Clarify the audience (who is the output for?)
- Specify the output format (length, structure, tone)
- Add useful constraints (what to include, what to exclude)
- Sometimes add examples or ask for step-by-step reasoning

You must respond in this exact format, using these exact delimiters:

<<<REFINED_PROMPT>>>
[the improved prompt text]
<<<CHANGES_JSON>>>
[a JSON array of changes, each with "title" and "explanation" fields]
<<<SCORES_JSON>>>
[a JSON object with "rough" and "refined" keys, each containing scores for these dimensions: ${dimKeys}
Each score is an object: {"score": 1-5, "rationale": "..."}
Dimensions to score:
${dimList}]
<<<END>>>

For follow-up refinements, the user gives you a previously-refined prompt and feedback. Apply the feedback to produce a new refined version. Score the new version (not the original rough prompt) against the previous refined version. The "rough" scores in this case represent the previous refined version's scores.

Be honest in scoring — a great rough prompt should score high. A bad refinement should score low. Don't pad numbers to seem helpful.`;
}

const REFINER_USER_TEMPLATE = (prompt, category, customInstructions) => `Category: ${category}

Rough prompt:
${prompt}
${customInstructions ? `\nAdditional refinement instructions from the user:\n${customInstructions}\n` : ''}
Refine this prompt and respond in the exact format specified.`;

const FOLLOWUP_USER_TEMPLATE = (originalRough, previousRefined, feedback, category, customInstructions) => `Category: ${category}

Original rough prompt:
${originalRough}

Previous refined version:
${previousRefined}

User feedback for further refinement:
${feedback}
${customInstructions ? `\nAdditional refinement instructions from the user:\n${customInstructions}\n` : ''}
Apply the feedback to produce a new refined version. Score against the previous refined version (use it as the "rough" baseline).`;

/* ── Refiner stream parsing ────────────────────────────── */

function parseRefinerResponse(fullText) {
  const refined = (fullText.match(/<<<REFINED_PROMPT>>>([\s\S]*?)<<<CHANGES_JSON>>>/) || [])[1]?.trim() || '';
  const changesRaw = (fullText.match(/<<<CHANGES_JSON>>>([\s\S]*?)<<<SCORES_JSON>>>/) || [])[1]?.trim() || '[]';
  const scoresRaw = (fullText.match(/<<<SCORES_JSON>>>([\s\S]*?)<<<END>>>/) || [])[1]?.trim() || '{}';

  let changes = [];
  let scores = null;

  try { changes = JSON.parse(changesRaw); } catch (e) { console.warn('Failed to parse changes JSON:', e); }
  try { scores = JSON.parse(scoresRaw); } catch (e) { console.warn('Failed to parse scores JSON:', e); }

  return { refined, changes, scores };
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
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/* ── /api/improve ─────────────────────────────────────── */

app.post('/api/improve', async (req, res) => {
  const { prompt, category = 'general', model = 'claude-sonnet-4-6', previousRefined, feedback, dimensions, customInstructions } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string.' });
  }
  if (prompt.length > 10000) {
    return res.status(400).json({ error: 'Prompt too long. Max 10,000 characters.' });
  }

  setupSSE(res);

  const systemPrompt = buildSystemPrompt(dimensions);

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
    });

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

    sendEvent(res, 'done', {
      usage: { inputTokens, outputTokens },
      latencyMs,
    });
  } catch (err) {
    console.error('Refinement error:', err);
    sendEvent(res, 'error', { error: err.message || 'Refinement failed.' });
  } finally {
    res.end();
  }
});

/* ── /api/improve-compare ─────────────────────────────── */

app.post('/api/improve-compare', async (req, res) => {
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
      });

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
    } catch (err) {
      console.error(`Comparison error for ${modelId}:`, err);
      sendEvent(res, 'model-error', { modelId, error: err.message || 'Failed.' });
    }
  });

  await Promise.allSettled(tasks);
  sendEvent(res, 'compare-done', {});
  res.end();
});

/* ── /api/test-prompt ─────────────────────────────────── */

app.post('/api/test-prompt', async (req, res) => {
  const { prompts, model = 'claude-sonnet-4-6' } = req.body;

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json({ error: 'Prompts array is required.' });
  }

  setupSSE(res);
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
      });

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
    } catch (err) {
      console.error(`Test error for ${id}:`, err);
      sendEvent(res, 'test-error', { id, error: err.message || 'Test failed.' });
    }
  });

  await Promise.allSettled(tasks);
  sendEvent(res, 'test-complete', {});
  res.end();
});

/* ── /api/run-prompt ──────────────────────────────────── */

// Accepts a conversation as a list of messages and streams Claude's
// response. The previous version of this endpoint listened to req.on('close')
// to detect client disconnect and abort early — but that event fires
// spuriously in Express + Node 20 during the SSE header flush, causing
// the loop to exit immediately on the first iteration with zero chunks
// sent. We now skip abort detection; if the user closes the drawer
// mid-stream, the Anthropic call finishes in the background. Cost
// impact is small for typical conversations and we can add proper
// abort logic later.
app.post('/api/run-prompt', async (req, res) => {
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

  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let chunkCount = 0;

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      messages,
    });

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
    sendEvent(res, 'run-done', {
      usage: { inputTokens, outputTokens },
      latencyMs,
    });
  } catch (err) {
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
    res.end();
  }
});

/* ── Healthcheck ──────────────────────────────────────── */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ── Share routes ─────────────────────────────────────── */

// In-memory share cache: keeps shares available within a server session even
// if the filesystem isn't persistent (Render free tier has no persistent disk).
// Shares are also written to disk when DATA_DIR is configured, so they survive
// restarts on plans that support persistent disks.
const memoryShares = {};

function getShares() {
  const disk = loadShares();
  return { ...disk, ...memoryShares };
}

app.post('/api/share', (req, res) => {
  const { rough, improved, changes, scores, category, model } = req.body;
  if (!rough || !improved) {
    return res.status(400).json({ error: 'rough and improved are required.' });
  }
  const id = randomBytes(4).toString('hex');
  const entry = { id, rough, improved, changes, scores, category, model, createdAt: Date.now() };

  // Keep in memory (survives Render's ephemeral filesystem within a session)
  memoryShares[id] = entry;

  // Also try to persist to disk (works when DATA_DIR is set)
  try {
    const shares = loadShares();
    shares[id] = entry;
    saveShares(shares);
  } catch { /* ignore if filesystem is read-only */ }

  // RENDER_EXTERNAL_URL is set automatically by Render; APP_URL can be set manually.
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || `http://localhost:${PORT}`;
  const url = `${baseUrl}/share/${id}`;
  res.json({ id, url });
});

app.get('/api/share/:id', (req, res) => {
  const entry = getShares()[req.params.id];
  if (!entry) return res.status(404).json({ error: 'Share not found.' });
  res.json(entry);
});

app.get('/share/:id', (req, res) => {
  const entry = getShares()[req.params.id];
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

app.post('/api/export/notion', async (req, res) => {
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

app.post('/api/export/slack', async (req, res) => {
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

app.post('/api/critique', async (req, res) => {
  const { prompt, model } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required.' });

  const critiqueModel = model || 'claude-opus-4-8';

  setupSSE(res);

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
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text;
        fullText += text;
        sendEvent(res, 'critique-chunk', { text });
      }
    }

    const finalMessage = await stream.finalMessage();
    const latencyMs = Date.now() - startTime;
    sendEvent(res, 'critique-done', {
      usage: {
        inputTokens: finalMessage.usage?.input_tokens || 0,
        outputTokens: finalMessage.usage?.output_tokens || 0,
      },
      latencyMs,
    });

  } catch (err) {
    console.error('/api/critique error:', err);
    sendEvent(res, 'critique-error', { error: err.message || 'Critique failed.' });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
