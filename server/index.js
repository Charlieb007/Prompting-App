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

const DELIMITER = '<<<CHANGES_JSON>>>';

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/improve', async (req, res) => {
  const { prompt, category = 'general', model } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const safeModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const instruction = CATEGORY_INSTRUCTIONS[category] || CATEGORY_INSTRUCTIONS.general;

  const systemPrompt = `You are an expert at prompt engineering. ${instruction}

Your response has two parts, separated by a special delimiter:

PART 1: The refined prompt itself, written as plain text. No preamble, no markdown headers describing what you did. Just the refined prompt.

PART 2: A line containing only the delimiter "${DELIMITER}" on its own.

PART 3: A JSON array describing 3-6 of the most impactful changes you made. Format:
[
  { "title": "Short label (3-6 words)", "explanation": "One concise sentence." },
  { "title": "Another change", "explanation": "Another concise explanation." }
]

Rules:
- Always emit PART 1 first, then the delimiter, then the JSON array
- Each change describes ONE distinct improvement
- Titles are short (3-6 words), like "Specified the audience" or "Added output format"
- Explanations are ONE concise sentence
- Order changes from most impactful to least
- If the original prompt was already well-formed, include fewer changes (even 1-2)
- The JSON must be valid and parseable
- Do not wrap the JSON in markdown code fences`;

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
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Rough prompt:\n${prompt}` },
      ],
    });

    let buffer = '';
    let delimiterFound = false;
    let refinedSoFar = '';
    let changesRaw = '';

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
            changesRaw = buffer.slice(idx + DELIMITER.length);
            send('refined-done', {});
          }
        } else {
          changesRaw += chunk;
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
    if (changesRaw.trim()) {
      try {
        const cleaned = changesRaw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          changes = parsed;
        }
      } catch (parseError) {
        console.warn('Failed to parse changes JSON:', changesRaw);
      }
    }

    send('changes', { changes });
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
