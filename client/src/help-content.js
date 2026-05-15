export const HELP_CONTENT = [
  {
    id: 'welcome',
    title: 'Welcome to Prompt Refinery',
    body: [
      { type: 'text', text: 'Prompt Refinery takes your rough ideas and refines them into clear, well-structured prompts you can use with any AI assistant. Better prompts produce better results.' },
      { type: 'text', text: 'You type a casual prompt, pick a category, and get back two things: a refined version of your prompt, and a list of exactly what changed and why. Prompt Refinery is built to teach, not just transform.' },
    ],
  },
  {
    id: 'tutorial',
    title: 'Step-by-step tutorial',
    body: [
      { type: 'step', n: 1, title: 'Pick a category', text: 'Above the input area, you\'ll see five category chips. Click the one that matches your task. Or pick a template (next step) which sets the category for you.' },
      { type: 'step', n: 2, title: 'Type a rough prompt — or use a template', text: 'Don\'t worry about being polished. "Write me an email about a project delay" is enough. If you\'re not sure what to type, open Templates from the left rail and pick a starting point.' },
      { type: 'step', n: 3, title: 'Submit', text: 'Click the arrow button on the right, or press Cmd+Enter (Ctrl+Enter on Windows/Linux). The refined prompt will appear within a few seconds.' },
      { type: 'step', n: 4, title: 'Read what changed', text: 'Below the refined prompt, you\'ll see a "What changed" panel listing the specific improvements that were made and why.' },
      { type: 'step', n: 5, title: 'Copy or save it', text: 'Click the Copy button to copy the refined prompt. Or click the star icon to save it permanently to your Saved prompts.' },
      { type: 'step', n: 6, title: 'Revisit later', text: 'History keeps your last 20 refinements automatically. Saved prompts keeps any you\'ve starred indefinitely. Both live in the left rail.' },
    ],
  },
  {
    id: 'saved',
    title: 'Saved prompts',
    body: [
      { type: 'text', text: 'History is automatic but rolling — only your last 20 refinements stay. Saved prompts are the ones you want to keep permanently.' },
      { type: 'text', text: 'To save a refinement, click the star icon at the top right of any refined prompt. The icon fills in to confirm it\'s saved. Click again to unsave.' },
      { type: 'list', items: [
        { label: 'View saved prompts', text: 'Open Saved from the left rail (the star icon). All your saved prompts appear there, newest first.' },
        { label: 'Rename them', text: 'Hover any saved prompt to reveal Rename and Remove buttons. Click the pencil to give it a memorable name like "Weekly status update" or "Client follow-up."' },
        { label: 'Reload a saved prompt', text: 'Click any saved prompt to load it into the composer along with its refined version and "What changed" panel. Useful for reviewing or building on previous work.' },
        { label: 'Remove when done', text: 'Click the trash icon on any saved prompt to remove it. There\'s no quota, but a tidy list is easier to scan.' },
      ]},
      { type: 'note', text: 'Saved prompts are stored locally in your browser, separate from history. Clearing browser data will remove them. There\'s currently no cloud sync.' },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    body: [
      { type: 'text', text: 'If you\'re not sure where to start, open Templates from the left rail. You\'ll find common scenarios grouped by category — drafting a difficult email, writing a function, summarizing research, brainstorming ideas, and more.' },
      { type: 'text', text: 'Click any template to load it into the composer. The rough prompt and matching category are filled in for you. You can edit before submitting or just hit submit to see what the refined version looks like.' },
      { type: 'list', items: [
        { label: 'Edit before submitting', text: 'Templates are starting points, not exact prompts. Replace placeholders with your actual situation for better results.' },
        { label: 'Compare categories', text: 'Try the same template under different categories to see how the refinement changes.' },
        { label: 'Save the good ones', text: 'After refining a template and getting a good result, star it. Now you have your own customized version in Saved prompts.' },
      ]},
    ],
  },
  {
    id: 'whatchanged',
    title: 'The "What changed" panel',
    body: [
      { type: 'text', text: 'This is the feature that makes Prompt Refinery different from a simple AI wrapper. Every time the app refines your prompt, it also returns a numbered list of the specific changes it made and why each one helps.' },
      { type: 'text', text: 'The panel shows 3-6 changes per refinement, ordered from most impactful to least. Each item has a short title and a one-sentence explanation.' },
      { type: 'list', items: [
        { label: 'Read every time', text: 'Don\'t just copy the refined prompt — read what changed. Over time, you\'ll absorb the patterns.' },
        { label: 'Compare across categories', text: 'Try the same rough prompt with different categories. The differences in what changes tell you a lot about each category\'s philosophy.' },
        { label: 'Notice the empty cases', text: 'If a prompt was already well-formed, the app may show only 1-2 changes. That\'s a signal you\'re writing good prompts already.' },
      ]},
    ],
  },
  {
    id: 'categories',
    title: 'Categories',
    body: [
      { type: 'text', text: 'Each category gives the AI different instructions for how to refine your prompt:' },
      { type: 'list', items: [
        { label: 'General', text: 'Adds structure, specificity, and clear output format. Use when none of the others quite fit.' },
        { label: 'Writing', text: 'Tunes for creative or professional writing tasks. Adds audience, tone, length, and voice guidance.' },
        { label: 'Code', text: 'Tunes for software tasks. Adds language, input/output spec, edge cases, and constraints.' },
        { label: 'Analysis', text: 'Tunes for research and analysis. Adds output structure, questions to answer, and asks for citations.' },
        { label: 'Brainstorm', text: 'Tunes for idea generation. Specifies number of ideas, categorization, and evaluation criteria.' },
      ]},
    ],
  },
  {
    id: 'history',
    title: 'History',
    body: [
      { type: 'text', text: 'Your last 20 refinements are saved locally in your browser. They survive page refreshes and stay private to your device.' },
      { type: 'text', text: 'Open history from the left rail. Click any entry to reload both the rough prompt and its refined version, along with the "What changed" panel.' },
      { type: 'note', text: 'History is a rolling list — older entries drop off as new ones come in. To keep a prompt permanently, star it to add it to Saved prompts.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & model selection',
    body: [
      { type: 'text', text: 'Open Settings from the left rail. You can choose which AI model refines your prompts. Claude Sonnet 4.6 is the default — a strong balance of capability and cost.' },
      { type: 'list', items: [
        { label: 'Claude Opus 4.7', text: 'Most capable. Best for complex prompts where you need the most thoughtful refinement.' },
        { label: 'Claude Sonnet 4.6', text: 'Default. Balanced workhorse. Recommended for most use cases.' },
        { label: 'Claude Opus 4.6', text: 'The previous flagship. Still highly capable.' },
        { label: 'Claude Haiku 4.5', text: 'Fastest and cheapest. Good for short, simple prompts at volume.' },
      ]},
      { type: 'text', text: 'Other providers (OpenAI GPT, Google Gemini) are listed as "coming soon."' },
      { type: 'note', text: 'Pro vs API billing: A Claude Pro subscription covers chat at claude.ai. This app uses Anthropic\'s API through a separate console account, so every refinement uses your API credits regardless of which model you select.' },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    body: [
      { type: 'list', items: [
        { label: 'Cmd+Enter', text: 'Submit the prompt (Ctrl+Enter on Windows/Linux).' },
        { label: 'Enter (in rename)', text: 'Save a new name for a saved prompt.' },
        { label: 'Escape (in rename)', text: 'Cancel renaming and keep the previous name.' },
      ]},
    ],
  },
  {
    id: 'tips',
    title: 'Tips for better prompts',
    body: [
      { type: 'text', text: 'Even the rough version benefits from a little context. The more specific your input, the more useful the refined version will be.' },
      { type: 'list', items: [
        { label: 'Mention the audience', text: 'Who will read or use the result? Their expertise level matters.' },
        { label: 'Mention the format', text: 'Email, blog post, code review, summary, table — say it.' },
        { label: 'Mention constraints', text: 'Length limits, tone, what to avoid.' },
        { label: 'Use the right category', text: 'Picking "Code" for a writing task wastes the refinement.' },
      ]},
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    body: [
      { type: 'list', items: [
        { label: '"Something went wrong"', text: 'Usually means the backend server isn\'t running, or your API key is invalid.' },
        { label: '"Unexpected response format"', text: 'Occasionally the AI returns something we can\'t parse. Just try again — almost always works on retry.' },
        { label: 'Slow responses', text: 'Each refinement calls the AI over the network. 2-5 seconds is normal. Opus models can take longer for complex prompts.' },
        { label: 'History/Saved disappeared', text: 'Most likely your browser cleared its local data.' },
        { label: 'Model error', text: 'If a specific Claude model fails, switch back to the default in Settings.' },
      ]},
    ],
  },
];
