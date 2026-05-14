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

const CATEGORY_INSTRUCTIONS = {
  general:
    'Rewrite the prompt to be clear, specific, and well-structured. Add concrete details where the original is vague, specify the desired output format, and break complex tasks into steps.',
  writing:
    'Rewrite the prompt for a creative or professional writing task. Specify the audience, tone, length, and format. Add guidance on voice, structure, and any constraints. If useful, suggest the writing should include sensory detail, specific examples, or a clear point of view.',
  code:
    'Rewrite the prompt as a software engineering task. Specify the programming language, expected input and output, edge cases to handle, constraints (performance, libraries to avoid, etc.), and the desired code style. Ask for explanation of non-obvious decisions.',
  analysis:
    'Rewrite the prompt for an analysis or research task. Specify the data or source material, the questions to answer, the output structure (executive summary, findings, recommendations), and ask for citations or reasoning. Encourage the response to acknowledge uncertainty.',
  brainstorm:
    'Rewrite the prompt as a brainstorming request. Specify the number of ideas wanted, any categorization (low-cost vs premium, short-term vs long-term, etc.), and the criteria each idea should be evaluated against. Encourage variety over redundancy.',
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/improve', async (req, res) => {
  const { prompt, category = 'general' } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const instruction = CATEGORY_INSTRUCTIONS[category] || CATEGORY_INSTRUCTIONS.general;

  const systemPrompt = `You are an expert at prompt engineering. ${instruction} Return ONLY the improved prompt itself, no preamble, no explanation, no markdown headers describing what you did.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Rough prompt:\n${prompt}`,
        },
      ],
    });

    const improvedPrompt = message.content[0].text;
    res.json({ improvedPrompt });
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Failed to improve prompt.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
