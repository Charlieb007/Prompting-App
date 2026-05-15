export const HELP_CONTENT = [
  {
    id: 'welcome',
    title: 'Welcome to Prompt Refinery',
    body: [
      { type: 'text', text: 'Prompt Refinery takes your rough ideas and refines them into clear, well-structured prompts you can use with any AI assistant. Better prompts produce better results.' },
      { type: 'text', text: 'You type a casual prompt, pick a category, and watch the refined version stream in word by word — alongside a list of exactly what changed and why. You can then refine it further with one-click options or your own feedback. Prompt Refinery is built to teach, not just transform.' },
    ],
  },
  {
    id: 'tutorial',
    title: 'Step-by-step tutorial',
    body: [
      { type: 'step', n: 1, title: 'Pick a category', text: 'Above the input area, you\'ll see five category chips. Click the one that matches your task. Or pick a template (next step) which sets the category for you.' },
      { type: 'step', n: 2, title: 'Type a rough prompt — or use a template', text: 'Don\'t worry about being polished. "Write me an email about a project delay" is enough.' },
      { type: 'step', n: 3, title: 'Submit', text: 'Click the arrow button on the right, or press Cmd+Enter (Ctrl+Enter on Windows/Linux). The refined prompt will start streaming in within milliseconds.' },
      { type: 'step', n: 4, title: 'Watch it appear and read what changed', text: 'The refined text streams in word by word. Once it finishes, a "What changed" panel shows the specific improvements made.' },
      { type: 'step', n: 5, title: 'Refine further if needed', text: 'Below the "What changed" panel, use the quick presets (Shorter, More formal, etc.) or type your own feedback. The refinement updates in place.' },
      { type: 'step', n: 6, title: 'Copy or save the final version', text: 'Once you\'re happy, click Copy to copy the refined prompt or the star to save it permanently.' },
    ],
  },
  {
    id: 'followup',
    title: 'Refine further',
    body: [
      { type: 'text', text: 'After each refinement, a "Refine further" panel appears below the "What changed" section. Use it to iterate without starting over.' },
      { type: 'list', items: [
        { label: 'Quick presets', text: '"Shorter," "More formal," "Simpler," and "Add examples" each apply a common feedback in one click. Hover any preset to see the exact instruction it sends.' },
        { label: 'Custom feedback', text: 'Type any feedback into the input field. "Add a section on cost," "make it more friendly," "include constraints around tone" — anything you\'d say to a colleague editing a draft.' },
        { label: 'Submitting', text: 'Press Enter or click the arrow button. The refinement streams in, replacing the previous version. The "What changed" panel updates to reflect this iteration\'s changes.' },
      ]},
      { type: 'note', text: 'Each follow-up replaces the previous result rather than adding to a thread. If you want to keep an earlier version, save it (with the star) before refining further. History also keeps each iteration as a separate entry, marked "follow-up."' },
      { type: 'text', text: 'Tip: Quick presets are the fastest way to discover what kinds of feedback work well. After a few uses, you\'ll start typing your own feedback in patterns you\'ve seen.' },
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
        { label: 'The stop button', text: 'The send button becomes a stop button (square) during streaming. Click it to cancel.' },
        { label: 'Locked controls', text: 'While streaming, the textarea, category chips, and action buttons are disabled to prevent confusing state changes.' },
      ]},
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
      { type: 'note', text: 'Saved prompts are stored locally in your browser. Clearing browser data will remove them.' },
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
        { label: 'Refine and save', text: 'After refining a template and using "Refine further" to dial it in, star the final version. You now have your own customized prompt.' },
      ]},
    ],
  },
  {
    id: 'whatchanged',
    title: 'The "What changed" panel',
    body: [
      { type: 'text', text: 'This is the feature that makes Prompt Refinery different from a simple AI wrapper. Every time the app refines your prompt — including follow-up refinements — it returns a numbered list of the specific changes made and why each one helps.' },
      { type: 'text', text: 'The panel appears after the refined prompt has finished streaming. It shows 3-6 changes per refinement, ordered from most impactful to least.' },
      { type: 'list', items: [
        { label: 'Read every time', text: 'Don\'t just copy the refined prompt — read what changed. Over time, you\'ll absorb the patterns.' },
        { label: 'Follow-ups have their own', text: 'When you refine further, the panel updates to show what changed in that iteration specifically. This is how you learn to give better feedback over time.' },
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
      { type: 'text', text: 'Your last 20 refinements — including follow-up iterations — are saved locally in your browser.' },
      { type: 'text', text: 'Open history from the left rail. Click any entry to reload both the rough prompt and its refined version. Entries that were follow-ups are marked with a small "follow-up" tag.' },
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
      { type: 'note', text: 'Follow-up refinements use the same model as the initial refinement. Switching models in the middle of an iteration sequence may produce stylistically inconsistent results.' },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    body: [
      { type: 'list', items: [
        { label: 'Cmd+Enter (in composer)', text: 'Submit a new refinement.' },
        { label: 'Cmd+Enter (in follow-up)', text: 'Apply your feedback to refine further.' },
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
        { label: 'Use follow-ups iteratively', text: 'Refine, evaluate the result, then refine further. Each iteration teaches the AI more about what you actually want.' },
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
        { label: 'Follow-up ignored my feedback', text: 'Try more specific feedback. "Make it shorter" works; "make it better" usually doesn\'t. Quick presets are good starting points.' },
        { label: 'Missing "What changed" panel', text: 'Occasionally the AI emits an unparseable changes block. The refined prompt still works.' },
        { label: 'History/Saved disappeared', text: 'Most likely your browser cleared its local data.' },
      ]},
    ],
  },
];
