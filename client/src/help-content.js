export const HELP_CONTENT = [
  {
    id: 'welcome',
    title: 'Welcome to Prompt Refinery',
    body: [
      { type: 'text', text: 'Prompt Refinery takes your rough ideas and refines them into clear, well-structured prompts you can use with any AI assistant. Better prompts produce better results.' },
      { type: 'text', text: 'You type a casual prompt, pick a category, and watch the refined version stream in word by word — alongside a list of exactly what changed and why. Prompt Refinery is built to teach, not just transform.' },
    ],
  },
  {
    id: 'tutorial',
    title: 'Step-by-step tutorial',
    body: [
      { type: 'step', n: 1, title: 'Pick a category', text: 'Above the input area, you\'ll see five category chips. Click the one that matches your task. Or pick a template (next step) which sets the category for you.' },
      { type: 'step', n: 2, title: 'Type a rough prompt — or use a template', text: 'Don\'t worry about being polished. "Write me an email about a project delay" is enough.' },
      { type: 'step', n: 3, title: 'Submit', text: 'Click the arrow button on the right, or press Cmd+Enter (Ctrl+Enter on Windows/Linux). The refined prompt will start streaming in within milliseconds.' },
      { type: 'step', n: 4, title: 'Watch it appear', text: 'The refined text streams in word by word, like a real-time conversation. A pulsing dot in the header confirms the AI is still working. Click the stop button (square) any time to cancel mid-stream.' },
      { type: 'step', n: 5, title: 'Read what changed', text: 'Once the refinement finishes, a "What changed" panel appears with the specific improvements that were made and why.' },
      { type: 'step', n: 6, title: 'Copy or save it', text: 'Click the Copy button to copy the refined prompt. Or click the star icon to save it permanently.' },
    ],
  },
  {
    id: 'streaming',
    title: 'How streaming works',
    body: [
      { type: 'text', text: 'When you submit a prompt, the refined version streams in word by word rather than appearing all at once. This is the same pattern used by claude.ai and other modern AI tools.' },
      { type: 'list', items: [
        { label: 'The pulsing dot', text: 'A small dot next to "Refined prompt" pulses while the AI is generating. When it disappears, the response is complete.' },
        { label: 'The caret', text: 'The blinking line at the end of the text shows where the next character will land. It disappears when streaming completes.' },
        { label: 'The stop button', text: 'The send button becomes a stop button (square) during streaming. Click it to cancel — what was generated so far stays on screen but the rest is discarded.' },
        { label: 'Locked controls', text: 'While streaming, the textarea, category chips, and action buttons are disabled to prevent confusing state changes. Wait for completion or click stop.' },
      ]},
      { type: 'note', text: 'Streaming doesn\'t make the total response faster — it just shows progress as it happens. The "What changed" panel still appears after the refined prompt is complete, since it needs to be parsed as structured data.' },
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
        { label: 'Rename them', text: 'Hover any saved prompt to reveal Rename and Remove buttons. Click the pencil to give it a memorable name.' },
        { label: 'Reload a saved prompt', text: 'Click any saved prompt to load it into the composer along with its refined version and "What changed" panel.' },
        { label: 'Remove when done', text: 'Click the trash icon on any saved prompt to remove it.' },
      ]},
      { type: 'note', text: 'Saved prompts are stored locally in your browser. Clearing browser data will remove them. There\'s currently no cloud sync.' },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    body: [
      { type: 'text', text: 'If you\'re not sure where to start, open Templates from the left rail. You\'ll find common scenarios grouped by category.' },
      { type: 'text', text: 'Click any template to load it into the composer. The rough prompt and matching category are filled in for you.' },
      { type: 'list', items: [
        { label: 'Edit before submitting', text: 'Templates are starting points, not exact prompts. Replace placeholders with your actual situation for better results.' },
        { label: 'Compare categories', text: 'Try the same template under different categories to see how the refinement changes.' },
        { label: 'Save the good ones', text: 'After refining a template and getting a good result, star it. Now you have your own customized version.' },
      ]},
    ],
  },
  {
    id: 'whatchanged',
    title: 'The "What changed" panel',
    body: [
      { type: 'text', text: 'This is the feature that makes Prompt Refinery different from a simple AI wrapper. Every time the app refines your prompt, it also returns a numbered list of the specific changes made and why each one helps.' },
      { type: 'text', text: 'The panel appears after the refined prompt has finished streaming. It shows 3-6 changes per refinement, ordered from most impactful to least.' },
      { type: 'list', items: [
        { label: 'Read every time', text: 'Don\'t just copy the refined prompt — read what changed. Over time, you\'ll absorb the patterns.' },
        { label: 'Compare across categories', text: 'Try the same rough prompt with different categories to see the differences.' },
        { label: 'Notice the empty cases', text: 'If a prompt was already well-formed, you may see only 1-2 changes. That\'s a signal you\'re writing good prompts already.' },
      ]},
    ],
  },
  {
    id: 'categories',
    title: 'Categories',
    body: [
      { type: 'text', text: 'Each category gives the AI different instructions for how to refine your prompt:' },
      { type: 'list', items: [
        { label: 'General', text: 'Adds structure, specificity, and clear output format.' },
        { label: 'Writing', text: 'Tunes for creative or professional writing. Adds audience, tone, length, voice.' },
        { label: 'Code', text: 'Tunes for software tasks. Adds language, input/output spec, edge cases.' },
        { label: 'Analysis', text: 'Tunes for research and analysis. Adds output structure, questions, asks for citations.' },
        { label: 'Brainstorm', text: 'Tunes for idea generation. Specifies number of ideas, categorization, criteria.' },
      ]},
    ],
  },
  {
    id: 'history',
    title: 'History',
    body: [
      { type: 'text', text: 'Your last 20 refinements are saved locally in your browser. They survive page refreshes and stay private to your device.' },
      { type: 'text', text: 'Open history from the left rail. Click any entry to reload both the rough prompt and its refined version.' },
      { type: 'note', text: 'History is a rolling list. To keep a prompt permanently, star it to add it to Saved prompts.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & model selection',
    body: [
      { type: 'text', text: 'Open Settings from the left rail. You can choose which AI model refines your prompts. Claude Sonnet 4.6 is the default.' },
      { type: 'list', items: [
        { label: 'Claude Opus 4.7', text: 'Most capable. Best for complex prompts.' },
        { label: 'Claude Sonnet 4.6', text: 'Default. Balanced workhorse.' },
        { label: 'Claude Opus 4.6', text: 'The previous flagship.' },
        { label: 'Claude Haiku 4.5', text: 'Fastest and cheapest.' },
      ]},
      { type: 'note', text: 'Pro vs API billing: A Claude Pro subscription covers chat at claude.ai. This app uses the API through a separate console account.' },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    body: [
      { type: 'list', items: [
        { label: 'Cmd+Enter', text: 'Submit the prompt (Ctrl+Enter on Windows/Linux).' },
        { label: 'Enter (in rename)', text: 'Save a new name for a saved prompt.' },
        { label: 'Escape (in rename)', text: 'Cancel renaming.' },
      ]},
    ],
  },
  {
    id: 'tips',
    title: 'Tips for better prompts',
    body: [
      { type: 'text', text: 'Even the rough version benefits from a little context.' },
      { type: 'list', items: [
        { label: 'Mention the audience', text: 'Who will read the result? Their expertise level matters.' },
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
        { label: 'Stream cuts off mid-response', text: 'Network glitches can interrupt a stream. Resubmit — usually works on retry.' },
        { label: 'Missing "What changed" panel', text: 'Occasionally the AI emits an unparseable changes block. The refined prompt still works.' },
        { label: 'Slow first chunk', text: 'The AI takes a moment to start. After the first words appear, streaming should be smooth.' },
        { label: 'History/Saved disappeared', text: 'Most likely your browser cleared its local data.' },
      ]},
    ],
  },
];
