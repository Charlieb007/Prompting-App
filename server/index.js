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

You must respond with valid JSON in exactly this format:
{
  "refined": "the full refined prompt text here",
  "changes": [
    { "title": "Short label (3-6 words)", "explanation": "One concise sentence explaining what this change adds and why it helps." },
    { "title": "Another change", "explanation": "Another concise explanation." }
  ]
}

Rules for the changes array:
- Include 3-6 changes maximum
- Each change must describe ONE distinct improvement
- Titles are short (3-6 words), like "Specified the audience" or "Added output format"
- Explanations are ONE concise sentence
- Order changes from most impactful to least
- Do not include changes that are merely cosmetic
- If the original prompt was already well-formed, include fewer changes (even 1-2)

Return ONLY the JSON, no preamble, no markdown code fences, no explanation.`;

  try {
    const message = await anthropic.messages.create({
      model: safeModel,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Rough prompt:\n${prompt}`,
        },
      ],
    });

    const rawText = message.content[0].text.trim();

    let parsed;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', rawText);
      return res.status(500).json({
        error: 'The AI returned an unexpected response format. Please try again.',
      });
    }

    if (!parsed.refined || !Array.isArray(parsed.changes)) {
      return res.status(500).json({
        error: 'The AI response was missing required fields. Please try again.',
      });
    }

    res.json({
      improvedPrompt: parsed.refined,
      changes: parsed.changes,
      modelUsed: safeModel,
    });
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Failed to improve prompt.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
