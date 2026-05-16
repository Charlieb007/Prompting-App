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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/improve', async (req, res) => {
  const { prompt, category = 'general', model, previousRefined, feedback } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const safeModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const instruction = CATEGORY_INSTRUCTIONS[category] || CATEGORY_INSTRUCTIONS.general;
  const isFollowUp = Boolean(previousRefined && feedback);

  const baseTask = isFollowUp
    ? `You previously refined a prompt for the user. They have feedback on the refinement and want another iteration. Apply their feedback while keeping the prompt clear, specific, and well-structured. ${instruction}`
    : `You are an expert at prompt engineering. ${instruction}`;

  const systemPrompt = `${baseTask}

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

  const userContent = isFollowUp
    ? `Original rough prompt:
${prompt}

Previous refined version:
${previousRefined}

User feedback for this iteration:
${feedback}

Produce a new refined version that addresses the feedback. Score the original rough prompt and your new refined version.`
    : `Rough prompt:
${prompt}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const stream = await anthropic.messages.stream({
      model: safeModel,
      max_tokens: 2200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    let buffer = '';
    let delimiterFound = false;
    let refinedSoFar = '';
    let payloadRaw = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const chunk = event.delta.text;
        buffer += chunk;

        if (!delimiterFound) {
          const idx = buffer.indexOf(DELIMITER);
          if (idx === -1) {
            const safeEmitLen = Math.max(0, buffer.length - DELIMITER.length);
            const toEmit = buffer.slice(refinedSoFar.length, safeEmitLen);
            if (toEmit) {
              refinedSoFar += toEmit;
              send('refined-chunk', { text: toEmit });
            }
          } else {
            const remaining = buffer.slice(refinedSoFar.length, idx);
            if (remaining) {
              refinedSoFar += remaining;
              send('refined-chunk', { text: remaining });
            }
            delimiterFound = true;
            payloadRaw = buffer.slice(idx + DELIMITER.length);
            send('refined-done', {});
          }
        } else {
          payloadRaw += chunk;
        }
      }
    }

    if (!delimiterFound) {
      const remaining = buffer.slice(refinedSoFar.length);
      if (remaining) {
        send('refined-chunk', { text: remaining });
      }
      send('refined-done', {});
    }

    let changes = [];
    let scores = null;
    if (payloadRaw.trim()) {
      try {
        const cleaned = payloadRaw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.changes)) {
          changes = parsed.changes;
        }
        if (parsed.scores && typeof parsed.scores === 'object') {
          scores = parsed.scores;
        }
      } catch (parseError) {
        console.warn('Failed to parse payload JSON:', payloadRaw);
      }
    }

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
