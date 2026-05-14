export const HELP_CONTENT = [
  {
    id: 'welcome',
    title: 'Welcome to Prompt Improver',
    body: [
      {
        type: 'text',
        text: 'Prompt Improver takes your rough ideas and rewrites them into clear, well-structured prompts you can use with any AI assistant. Better prompts produce better results — this tool removes the guesswork.',
      },
      {
        type: 'text',
        text: 'You type a casual prompt like "help me write an email," pick a category, and get back a detailed, professional version. The app remembers your last 20 improvements so you can revisit them anytime.',
      },
    ],
  },
  {
    id: 'tutorial',
    title: 'Step-by-step tutorial',
    body: [
      {
        type: 'step',
        n: 1,
        title: 'Pick a category',
        text: 'Above the input area, you\'ll see five category chips: General, Writing, Code, Analysis, and Brainstorm. Click the one that matches your task. Each category tunes the improvement to that kind of writing.',
      },
      {
        type: 'step',
        n: 2,
        title: 'Type a rough prompt',
        text: 'Don\'t worry about being polished. "Write me an email about a project delay" is enough. The app will fill in the structure for you.',
      },
      {
        type: 'step',
        n: 3,
        title: 'Submit',
        text: 'Click the arrow button on the right, or press Cmd+Enter (Ctrl+Enter on Windows/Linux). The improved prompt will appear above the input area within a few seconds.',
      },
      {
        type: 'step',
        n: 4,
        title: 'Copy and use it',
        text: 'Click the Copy button at the top of the result to copy the improved prompt to your clipboard. Paste it into Claude, ChatGPT, or wherever you\'re working.',
      },
      {
        type: 'step',
        n: 5,
        title: 'Revisit history',
        text: 'Every improvement is automatically saved. Click the History icon in the left rail to see your recent prompts, and click any entry to reload it.',
      },
    ],
  },
  {
    id: 'categories',
    title: 'Categories',
    body: [
      {
        type: 'text',
        text: 'Each category gives the AI different instructions for how to improve your prompt:',
      },
      {
        type: 'list',
        items: [
          { label: 'General', text: 'Adds structure, specificity, and clear output format. Use when none of the others quite fit.' },
          { label: 'Writing', text: 'Tunes for creative or professional writing tasks. Adds audience, tone, length, and voice guidance.' },
          { label: 'Code', text: 'Tunes for software tasks. Adds language, input/output spec, edge cases, and constraints.' },
          { label: 'Analysis', text: 'Tunes for research and analysis. Adds output structure, questions to answer, and asks for citations.' },
          { label: 'Brainstorm', text: 'Tunes for idea generation. Specifies number of ideas, categorization, and evaluation criteria.' },
        ],
      },
    ],
  },
  {
    id: 'history',
    title: 'History',
    body: [
      {
        type: 'text',
        text: 'Your last 20 improvements are saved locally in your browser. They survive page refreshes and stay private to your device — nothing is sent anywhere except the request to improve a prompt.',
      },
      {
        type: 'text',
        text: 'Open history from the left rail by clicking the clock icon. Click any entry to reload both the rough prompt and its improved version. Use the "Clear all" button at the top of the panel to wipe everything.',
      },
      {
        type: 'note',
        text: 'Clearing your browser data also clears history. If you want to keep an improved prompt long-term, copy it somewhere safe.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & model selection',
    body: [
      {
        type: 'text',
        text: 'Open Settings from the left rail (the gear icon). You can choose which AI model improves your prompts. Claude Sonnet 4.6 is the default — a strong balance of capability and cost for most prompts.',
      },
      {
        type: 'list',
        items: [
          { label: 'Claude Opus 4.7', text: 'Anthropic\'s flagship as of April 2026. Most capable but most expensive ($5/$25 per million tokens). Best for complex or high-stakes prompts.' },
          { label: 'Claude Sonnet 4.6', text: 'Default. Balanced workhorse ($3/$15 per million tokens). Recommended for most use cases.' },
          { label: 'Claude Opus 4.6', text: 'The previous flagship. Still highly capable, useful for comparison.' },
          { label: 'Claude Haiku 4.5', text: 'Fastest and cheapest Claude model ($1/$5 per million tokens). Good for short, simple prompts at volume.' },
        ],
      },
      {
        type: 'text',
        text: 'Other providers (OpenAI GPT, Google Gemini) are listed as "coming soon" — they\'ll be added in a future update once API integration is in place. For now, Claude is the only working option, and it\'s a great one.',
      },
      {
        type: 'note',
        text: 'Pro vs API billing: A Claude Pro subscription covers chat at claude.ai. This app uses Anthropic\'s API through a separate console account, so every improvement uses your API credits regardless of which model you select. Opus 4.7 costs roughly 5x more per request than Haiku 4.5.',
      },
      {
        type: 'note',
        text: 'Your model choice is saved in your browser and persists across sessions. If a model returns an error, switch back to the default — that model may not yet be enabled on your API account.',
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    body: [
      {
        type: 'list',
        items: [
          { label: 'Cmd+Enter', text: 'Submit the prompt (Ctrl+Enter on Windows/Linux).' },
        ],
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips for better prompts',
    body: [
      {
        type: 'text',
        text: 'Even the rough version benefits from a little context. The more specific your input, the more useful the improved version will be.',
      },
      {
        type: 'list',
        items: [
          { label: 'Mention the audience', text: 'Who will read or use the result? Their expertise level matters.' },
          { label: 'Mention the format', text: 'Email, blog post, code review, summary, table — say it.' },
          { label: 'Mention constraints', text: 'Length limits, tone, what to avoid.' },
          { label: 'Use the right category', text: 'Picking "Code" for a writing task wastes the improvement.' },
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    body: [
      {
        type: 'list',
        items: [
          { label: '"Something went wrong"', text: 'Usually means the backend server isn\'t running, or your API key is invalid. Check that the server terminal is still showing "Server running on http://localhost:3001".' },
          { label: 'Slow responses', text: 'Each improvement calls the AI over the network. 2-5 seconds is normal for Sonnet and Haiku. Opus 4.7 can take longer for complex prompts — that\'s expected.' },
          { label: 'History disappeared', text: 'Most likely your browser cleared its local data. Some private/incognito modes don\'t persist localStorage either.' },
          { label: 'Model error', text: 'If a specific Claude model fails, switch back to the default in Settings. Some newer models may not yet be enabled on your specific API account.' },
        ],
      },
    ],
  },
];
