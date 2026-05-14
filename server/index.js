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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/improve', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an expert at prompt engineering. Take the user's rough prompt and rewrite it to be clear, specific, and well-structured. Return ONLY the improved prompt, no preamble or explanation.\n\nRough prompt:\n${prompt}`,
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
