import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/* ── Refiner system prompt ─────────────────────────────── */

const REFINER_SYSTEM_PROMPT = `You are a prompt engineering specialist. Your job is to take a rough, vague, or incomplete prompt from a user and refine it into a well-structured prompt that will get better results from an AI model.

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
[a JSON object with "rough" and "refined" keys, each containing scores for specificity, audience, format, constraints, examples, each as {"score": 1-5, "rationale": "..."}]
<<<END>>>

For follow-up refinements, the user gives you a previously-refined prompt and feedback. Apply the feedback to produce a new refined version. Score the new version (not the original rough prompt) against the previous refined version. The "rough" scores in this case represent the previous refined version's scores.

Be honest in scoring — a great rough prompt should score high. A bad refinement should score low. Don't pad numbers to seem helpful.`;

const REFINER_USER_TEMPLATE = (prompt, category) => `Category: ${category}

Rough prompt:
${prompt}

Refine this prompt and respond in the exact format specified.`;

const FOLLOWUP_USER_TEMPLATE = (originalRough, previousRefined, feedback, category) => `Category: ${category}

Original rough prompt:
${originalRough}

Previous refined version:
${previousRefined}

User feedback for further refinement:
${feedback}

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
  const { prompt, category = 'general', model = 'claude-sonnet-4-6', previousRefined, feedback } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string.' });
  }
  if (prompt.length > 10000) {
    return res.status(400).json({ error: 'Prompt too long. Max 10,000 characters.' });
  }

  setupSSE(res);

  const userMessage = (previousRefined && feedback)
    ? FOLLOWUP_USER_TEMPLATE(prompt, previousRefined, feedback, category)
    : REFINER_USER_TEMPLATE(prompt, category);

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
      system: REFINER_SYSTEM_PROMPT,
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
        system: REFINER_SYSTEM_PROMPT,
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

  console.log('[run-prompt] request received, messages:', messages?.length, 'model:', model);

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
    console.log('[run-prompt] done. chunks:', chunkCount, 'tokens in/out:', inputTokens, outputTokens, 'latency:', latencyMs + 'ms');
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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
