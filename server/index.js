import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const ALLOWED_MODELS = new Set([
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]);

const CATEGORY_INSTRUCTIONS = {
  general:
    'Rewrite the prompt to be clear, specific, and well-structured. Add concrete details where the original is vague, specify the desired output format, and break complex tasks into steps.',
  writing:
    'Rewrite the prompt for a creative or professional writing task. Specify the audience, tone, length, and format. Add guidance on voice, structure, and any constraints.',
  code:
    'Rewrite the prompt as a software engineering task. Specify the programming language, expected input and output, edge cases to handle, constraints, and the desired code style.',
  analysis:
    'Rewrite the prompt for an analysis or research task. Specify the data or source material, the questions to answer, the output structure, and ask for citations or reasoning.',
  brainstorm:
    'Rewrite the prompt as a brainstorming request. Specify the number of ideas wanted, any categorization, and the criteria each idea should be evaluated against.',
};

const SCORING_RUBRIC = `Score each prompt against five dimensions on a 1-5 integer scale:

1. specificity — How concrete and detailed is the request?
   1 = vague, abstract, or generic; 5 = highly specific with named entities, quantities, and context.

2. audience — Does the prompt establish who the response is for and what they need?
   1 = no audience mentioned; 5 = audience explicitly named with their expertise level and context.

3. format — Is the desired output format explicitly specified?
   1 = no format mentioned; 5 = format, length, structure, and any required sections clearly defined.

4. constraints — Are limits, exclusions, requirements, and edge cases clearly stated?
   1 = no constraints; 5 = comprehensive constraints (length, tone, what to avoid, edge cases).

5. examples — Does the prompt include examples or ask for step-by-step reasoning?
   1 = no examples or reasoning guidance; 5 = clear examples provided or chain-of-thought explicitly requested.

For each dimension, return an integer score 1-5 and a single concise sentence rationale.`;

const DELIMITER = '<<<CHANGES_JSON>>>';

function buildSystemPrompt(category, isFollowUp) {
  const instruction = CATEGORY_INSTRUCTIONS[category] || CATEGORY_INSTRUCTIONS.general;
  const baseTask = isFollowUp
    ? `You previously refined a prompt for the user. They have feedback on the refinement and want another iteration. Apply their feedback while keeping the prompt clear, specific, and well-structured. ${instruction}`
    : `You are an expert at prompt engineering. ${instruction}`;

  return `${baseTask}

Your response has two parts, separated by a special delimiter:

PART 1: The refined prompt itself, written as plain text. No preamble, no markdown headers describing what you did. Just the refined prompt.

PART 2: A line containing only the delimiter "${DELIMITER}" on its own.

PART 3: A JSON object with two fields, "changes" and "scores":

{
  "changes": [
    { "title": "Short label (3-6 words)", "explanation": "One concise sentence." }
  ],
  "scores": {
    "rough": {
      "specificity":  { "score": 1, "rationale": "..." },
      "audience":     { "score": 1, "rationale": "..." },
      "format":       { "score": 1, "rationale": "..." },
      "constraints":  { "score": 1, "rationale": "..." },
      "examples":     { "score": 1, "rationale": "..." }
    },
    "refined": {
      "specificity":  { "score": 5, "rationale": "..." },
      "audience":     { "score": 5, "rationale": "..." },
      "format":       { "score": 5, "rationale": "..." },
      "constraints":  { "score": 5, "rationale": "..." },
      "examples":     { "score": 5, "rationale": "..." }
    }
  }
}

Rules for the changes array:
- Include 3-6 changes maximum
- Each change describes ONE distinct improvement
- Titles are short (3-6 words)
- Explanations are ONE concise sentence
- Order changes from most impactful to least
- If few changes were needed, include fewer (even 1-2)

Rules for the scores object:
- Score the rough prompt AS-PROVIDED, not as you wish it had been written
- Score the refined prompt as you produced it
- Use integers 1-5 only
- Each rationale is ONE concise sentence

${SCORING_RUBRIC}

The JSON must be valid and parseable. Do not wrap it in markdown code fences.`;
}

function buildUserContent({ prompt, isFollowUp, previousRefined, feedback }) {
  if (isFollowUp) {
    return `Original rough prompt:
${prompt}

Previous refined version:
${previousRefined}

User feedback for this iteration:
${feedback}

Produce a new refined version that addresses the feedback. Score the original rough prompt and your new refined version.`;
  }
  return `Rough prompt:
${prompt}`;
}

function parsePayload(payloadRaw) {
  let changes = [];
  let scores = null;
  if (!payloadRaw.trim()) return { changes, scores };

  try {
    const cleaned = payloadRaw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.changes)) changes = parsed.changes;
    if (parsed.scores && typeof parsed.scores === 'object') scores = parsed.scores;
  } catch (parseError) {
    console.warn('Failed to parse payload JSON:', payloadRaw.slice(0, 200));
  }

  return { changes, scores };
}

/**
 * Stream a single refinement run.
 * Calls callbacks with chunks. Does not write to the response directly —
 * lets the caller decide how to format SSE events.
 *
 * @returns Promise<{ refined: string, changes: array, scores: object }>
 */
async function runRefinement({ model, system, userContent, onChunk, onRefinedDone }) {
  const stream = await anthropic.messages.stream({
    model,
    max_tokens: 2200,
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  let buffer = '';
  let delimiterFound = false;
  let refinedSoFar = '';
  let payloadRaw = '';

  for await (const event of stream) {
    if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta') continue;
    const chunk = event.delta.text;
    buffer += chunk;

    if (!delimiterFound) {
      const idx = buffer.indexOf(DELIMITER);
      if (idx === -1) {
        // Hold back the last DELIMITER.length characters so we don't accidentally
        // emit half of the delimiter string.
        const safeEmitLen = Math.max(0, buffer.length - DELIMITER.length);
        const toEmit = buffer.slice(refinedSoFar.length, safeEmitLen);
        if (toEmit) {
          refinedSoFar += toEmit;
          onChunk?.(toEmit);
        }
      } else {
        const remaining = buffer.slice(refinedSoFar.length, idx);
        if (remaining) {
          refinedSoFar += remaining;
          onChunk?.(remaining);
        }
        delimiterFound = true;
        payloadRaw = buffer.slice(idx + DELIMITER.length);
        onRefinedDone?.();
      }
    } else {
      payloadRaw += chunk;
    }
  }

  // If delimiter never appeared, flush remaining buffer as refined text.
  if (!delimiterFound) {
    const remaining = buffer.slice(refinedSoFar.length);
    if (remaining) onChunk?.(remaining);
    onRefinedDone?.();
  }

  const { changes, scores } = parsePayload(payloadRaw);
  return { refined: refinedSoFar, changes, scores };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Single-model refinement endpoint.
 * Unchanged from the previous version.
 */
app.post('/api/improve', async (req, res) => {
  const { prompt, category = 'general', model, previousRefined, feedback } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const safeModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const isFollowUp = Boolean(previousRefined && feedback);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const system = buildSystemPrompt(category, isFollowUp);
    const userContent = buildUserContent({ prompt, isFollowUp, previousRefined, feedback });

    const { changes, scores } = await runRefinement({
      model: safeModel,
      system,
      userContent,
      onChunk: (text) => send('refined-chunk', { text }),
      onRefinedDone: () => send('refined-done', {}),
    });

    send('changes', { changes });
    send('scores', { scores });
    send('done', { modelUsed: safeModel });
    res.end();
  } catch (error) {
    console.error('Anthropic API error:', error);
    send('error', { error: 'Failed to refine prompt.' });
    res.end();
  }
});

/**
 * Multi-model comparison endpoint.
 * Spawns N parallel runs and streams interleaved events tagged by modelId.
 * Each event includes a `modelId` field so the frontend routes to the right column.
 */
app.post('/api/improve-compare', async (req, res) => {
  const { prompt, category = 'general', models } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!Array.isArray(models) || models.length === 0) {
    return res.status(400).json({ error: 'At least one model is required.' });
  }

  // Filter to allowed models, deduplicate.
  const safeModels = [...new Set(models.filter((m) => ALLOWED_MODELS.has(m)))];
  if (safeModels.length === 0) {
    return res.status(400).json({ error: 'No valid models provided.' });
  }

  // Cap the number of parallel models to prevent runaway costs.
  // 4 is the maximum reasonable number for visual comparison anyway.
  if (safeModels.length > 4) {
    return res.status(400).json({ error: 'Maximum 4 models per comparison.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Locked-writes wrapper: in parallel streaming, multiple awaits could
  // theoretically interleave at the byte level, breaking SSE framing.
  // We serialize through a tiny promise chain.
  let writeChain = Promise.resolve();
  function send(event, data) {
    writeChain = writeChain.then(() => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        // If the client disconnected, writes will throw — that's fine.
      }
    });
    return writeChain;
  }

  send('compare-start', { models: safeModels });

  const system = buildSystemPrompt(category, false);
  const userContent = buildUserContent({ prompt, isFollowUp: false });

  // Run all models in parallel. Each one streams its own events.
  const runs = safeModels.map(async (modelId) => {
    try {
      const { changes, scores } = await runRefinement({
        model: modelId,
        system,
        userContent,
        onChunk: (text) => send('model-chunk', { modelId, text }),
        onRefinedDone: () => send('model-refined-done', { modelId }),
      });
      await send('model-changes', { modelId, changes });
      await send('model-scores', { modelId, scores });
      await send('model-done', { modelId });
    } catch (error) {
      console.error(`Model ${modelId} failed:`, error);
      await send('model-error', { modelId, error: 'This model failed to respond.' });
    }
  });

  // Wait for all to complete (or fail) before closing the response.
  await Promise.allSettled(runs);
  await send('compare-done', {});
  res.end();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
