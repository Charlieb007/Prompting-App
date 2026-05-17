// Help & Documentation content.
// Rendered inside the 300px sidebar drawer, so keep blocks narrow and short.
// Block types:
//   { type: 'text', text }
//   { type: 'step', n, title, text }
//   { type: 'list', items: [{ label, text }] }
//   { type: 'note', text }
// Audience: someone returning to the app after a break who needs to remember
// what something does. Not a tutorial for strangers, not a dev reference.

export const HELP_CONTENT = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: [
      {
        type: 'text',
        text: 'Prompt Refinery turns rough, half-formed prompts into well-structured ones. You type a rough idea, it produces a refined version, explains what changed, and scores both.',
      },
      {
        type: 'step',
        n: 1,
        title: 'Type a rough prompt',
        text: 'Whatever you would have sent to ChatGPT, Claude, or Gemini if you were in a hurry. No need to be polished — that is the whole point.',
      },
      {
        type: 'step',
        n: 2,
        title: 'Pick a category (optional)',
        text: 'General, Writing, Code, Analysis, or Brainstorm. The refiner adjusts its instructions based on which you pick.',
      },
      {
        type: 'step',
        n: 3,
        title: 'Hit Refine (or Cmd+Enter)',
        text: 'The refined version streams in. Below it: what changed, quality scores for both versions, and an estimated cost.',
      },
      {
        type: 'step',
        n: 4,
        title: 'Copy and use',
        text: 'Click Copy. Paste into the AI tool of your choice. The refined prompt is what you actually wanted to send all along.',
      },
      {
        type: 'note',
        text: 'Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) sends from anywhere in the composer.',
      },
    ],
  },

  {
    id: 'refinement-flow',
    title: 'How refinement works',
    body: [
      {
        type: 'text',
        text: 'When you refine a prompt, three things happen at once: the refined version is generated, a list of changes is produced, and both versions are scored against five quality dimensions.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Refined prompt',
            text: 'Streams in word by word. You can stop it mid-stream if it goes the wrong direction.',
          },
          {
            label: 'What changed',
            text: 'A numbered list of the most impactful edits the refiner made, each with a short explanation.',
          },
          {
            label: 'Quality score',
            text: 'Two radar charts — your rough prompt vs the refined version — plus a per-dimension breakdown with rationales.',
          },
          {
            label: 'Refine further',
            text: 'Four preset adjustments (Shorter / More formal / Simpler / Add examples) or a free-form follow-up box for anything else.',
          },
        ],
      },
      {
        type: 'note',
        text: 'A follow-up is a new refinement using your previous refined version plus your feedback. It runs a fresh API call and shows up as a "follow-up" entry in history.',
      },
    ],
  },

  {
    id: 'quality-score',
    title: 'Quality score',
    body: [
      {
        type: 'text',
        text: 'Every refinement is scored against five dimensions on a 1-5 scale. The radar charts show your rough prompt (gray) and refined version (orange) so you can see exactly where the lift came from.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Specificity',
            text: 'How concrete and detailed is the request? Named entities, quantities, context.',
          },
          {
            label: 'Audience',
            text: 'Who is the response for? Their expertise level, role, context.',
          },
          {
            label: 'Format',
            text: 'Is the desired output shape stated? Email, list, paragraph, code, table, etc.',
          },
          {
            label: 'Constraints',
            text: 'Limits, exclusions, edge cases, things to avoid.',
          },
          {
            label: 'Examples',
            text: 'Concrete examples of good output, or instructions to think step-by-step.',
          },
        ],
      },
      {
        type: 'note',
        text: 'The same five dimensions are used by the linter (live hints) and the refiner (final scoring). Learning them once helps everywhere.',
      },
    ],
  },

  {
    id: 'linter',
    title: 'Prompt linter',
    body: [
      {
        type: 'text',
        text: 'As you type a rough prompt, the linter runs in your browser and surfaces hints about what might be missing. No API call, no cost — just instant feedback.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Critical',
            text: 'Red dot. Prompt is too short or too vague to refine well. Address before sending.',
          },
          {
            label: 'Warning',
            text: 'Amber dot. An important dimension (audience, format) is missing in a prompt long enough that it should have one.',
          },
          {
            label: 'Info',
            text: 'Gray dot. A nice-to-have addition, but the prompt is usable.',
          },
        ],
      },
      {
        type: 'text',
        text: 'Hints update 400ms after you stop typing. They disappear as you address them. You can also dismiss any hint with the × button — but it comes back if you edit the prompt further, which is intentional.',
      },
      {
        type: 'note',
        text: 'Toggle the linter off in Settings if you find it noisy. The refiner still works without it.',
      },
    ],
  },

  {
    id: 'pii-scanner',
    title: 'PII scanner',
    body: [
      {
        type: 'text',
        text: 'When you click Refine, your prompt is scanned locally for things you probably did not mean to send to an AI service — API keys, credit cards, phone numbers, emails, addresses. If anything is found, a warning modal appears before the prompt leaves your browser.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'API keys & secrets',
            text: 'OpenAI, Anthropic, GitHub, Slack, AWS-shaped keys. Flagged as critical — almost never intentional.',
          },
          {
            label: 'Financial info',
            text: 'Credit card numbers (Luhn-validated to cut false positives), US SSNs, IBANs. Critical.',
          },
          {
            label: 'Contact info',
            text: 'Email addresses, phone numbers (international and US), street addresses. Warning — often intentional.',
          },
        ],
      },
      {
        type: 'text',
        text: 'You always have two options: Edit prompt (returns you to the composer with the prompt preserved) or Send anyway / Send as-is. The button color changes based on severity — yellow for critical findings, orange for warnings.',
      },
      {
        type: 'note',
        text: 'The scanner runs entirely in your browser. Nothing flagged is sent unless you confirm. Toggle it off in Settings if it nags you on legitimate content.',
      },
    ],
  },

  {
    id: 'cost-tracking',
    title: 'Cost & latency',
    body: [
      {
        type: 'text',
        text: 'Every refinement and comparison column shows its estimated cost and how long it took, right next to the model badge. Click the Usage icon in the rail (bar chart) to see aggregate stats.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Per-refinement tags',
            text: 'Cost and latency appear inline. Sub-cent costs show 4 decimals so you can actually see them.',
          },
          {
            label: 'Today / 7 days / 30 days',
            text: 'Three rolling totals at the top of the Usage panel.',
          },
          {
            label: '7-day bar chart',
            text: 'Quick visual of where your spending sat each day.',
          },
          {
            label: 'By model',
            text: 'Which models cost what — useful when deciding if Opus is worth it for the next refinement.',
          },
          {
            label: 'Average latency',
            text: 'How long refinements typically take. Opus is usually 2-3x slower than Sonnet.',
          },
        ],
      },
      {
        type: 'note',
        text: 'Costs are estimates based on Anthropic\'s published per-token rates. Your Anthropic Console is the source of truth for actual billing — these usually match closely but rounding can differ.',
      },
    ],
  },

  {
    id: 'saved-prompts',
    title: 'Saved prompts',
    body: [
      {
        type: 'text',
        text: 'Click the star icon next to a refined prompt to keep it permanently. Saved prompts live in their own sidebar view and survive forever, unlike history which only keeps the last 20.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Rename',
            text: 'Hover a saved prompt and click the pencil icon to give it a memorable name.',
          },
          {
            label: 'Remove',
            text: 'Hover and click the trash icon. Confirms before deleting.',
          },
          {
            label: 'Load',
            text: 'Click a saved prompt to load it into the main view, exactly as it was when you saved it — scores, changes, even comparison columns.',
          },
        ],
      },
    ],
  },

  {
    id: 'templates',
    title: 'Templates',
    body: [
      {
        type: 'text',
        text: 'Pre-written starter prompts for common scenarios — email drafts, code review, summaries, brainstorms. Open the Templates view in the sidebar and click one to load it into the composer.',
      },
      {
        type: 'text',
        text: 'Templates are starting points, not finished prompts. Edit them, add your specific context, then refine.',
      },
    ],
  },

  {
    id: 'history',
    title: 'History',
    body: [
      {
        type: 'text',
        text: 'Your last 20 refinements, automatically saved. Click any entry to load it back into the main view.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'follow-up tag',
            text: 'Appears on entries that were follow-up refinements (used your previous refined version as input).',
          },
          {
            label: 'compare tag',
            text: 'Appears on entries that have a cross-model comparison attached.',
          },
          {
            label: 'imported tag',
            text: 'Appears on entries that came from an Export/Import roundtrip.',
          },
        ],
      },
      {
        type: 'note',
        text: 'When you hit 20 entries, the oldest rolls off. Star anything you want to keep before that happens.',
      },
    ],
  },

  {
    id: 'export-import',
    title: 'Export / Import',
    body: [
      {
        type: 'text',
        text: 'In the History view, click "Export / Import" to back up or restore your prompts. Three formats are supported.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Markdown (.md)',
            text: 'Human-readable. Best for reviewing your prompts or sharing them. Includes refined text, changes, and scores in prose form.',
          },
          {
            label: 'JSON (.json)',
            text: 'Lossless. Best for re-importing later — every field is preserved including comparison columns and score rationales.',
          },
          {
            label: 'CSV (.csv)',
            text: 'Flat spreadsheet format. Best for analysis in Excel or Google Sheets. Loses nested data like comparisons.',
          },
        ],
      },
      {
        type: 'text',
        text: 'Imports are always merged with your existing data — never overwrite. Duplicates (same rough text + same refined text + same model) are skipped automatically. Imported entries appear with an "imported" tag.',
      },
    ],
  },

  {
    id: 'comparison',
    title: 'Cross-model comparison',
    body: [
      {
        type: 'text',
        text: 'After a refinement completes, a "Compare with other models" button appears. Click it, pick 1-3 other models, run comparison. The same rough prompt gets refined by each model in parallel.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Side-by-side columns',
            text: 'Each model produces its own refined version, score, changes, cost, and latency.',
          },
          {
            label: 'Use this version',
            text: 'Promote any column to primary — replaces the main refined view with that model\'s output.',
          },
          {
            label: 'Show details',
            text: 'Expand any column to see what each model changed and why.',
          },
        ],
      },
      {
        type: 'note',
        text: 'Comparisons cost N times more than a single refinement (one API call per model). Worth doing when picking a model for a recurring task — not for every refinement.',
      },
    ],
  },

  {
    id: 'browser-extension',
    title: 'Browser extension',
    body: [
      {
        type: 'text',
        text: 'A Chrome extension lives in the extension/ folder of your project. Click the toolbar icon from any webpage to open a quick-refine popup.',
      },
      {
        type: 'step',
        n: 1,
        title: 'Load it once',
        text: 'In Chrome, go to chrome://extensions/, enable Developer mode, click "Load unpacked", and select the extension folder.',
      },
      {
        type: 'step',
        n: 2,
        title: 'Backend must be running',
        text: 'The extension talks to localhost:3001, so npm run dev must be active in the server folder. Without it, the extension shows an error with instructions.',
      },
      {
        type: 'step',
        n: 3,
        title: 'Use anywhere',
        text: 'Click the toolbar icon. Type a rough prompt. Refine. Copy. Done — without leaving the page you were on.',
      },
      {
        type: 'note',
        text: 'The extension has no history or comparison features by design. It is for the quick "I need this refined right now" moment, not for everything the main app does.',
      },
    ],
  },

  {
    id: 'how-refiner-works',
    title: 'How the refiner works',
    body: [
      {
        type: 'text',
        text: 'Under the hood, the refiner sends your rough prompt to a Claude model with detailed instructions about what makes prompts good. It rewrites your prompt, identifies the changes, and scores both versions in a single API call.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Category-specific instructions',
            text: 'Each category (General, Writing, Code, etc.) adjusts what the refiner pays attention to.',
          },
          {
            label: 'Universal heuristics',
            text: 'Three rules apply to every refinement regardless of category: use clear delimiters (XML-style tags) for multi-part prompts, add uncertainty handling for factual tasks, put the key instruction last in long prompts.',
          },
          {
            label: 'Streaming',
            text: 'The refined version streams in as it is generated. Scores and changes arrive at the end, after the refined text completes.',
          },
        ],
      },
      {
        type: 'note',
        text: 'These heuristics come from prompt-engineering documentation by OpenAI, Google, and Anthropic. They are what reliably makes prompts work better across model families.',
      },
    ],
  },

  {
    id: 'categories',
    title: 'Categories',
    body: [
      {
        type: 'text',
        text: 'The category chip above the composer tells the refiner what kind of prompt you are writing. Each adjusts the refinement instructions.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'General',
            text: 'The catch-all. Makes prompts clear and well-structured without assuming a specific use case.',
          },
          {
            label: 'Writing',
            text: 'Tunes for creative or professional writing. Adds audience, tone, voice, length guidance.',
          },
          {
            label: 'Code',
            text: 'Tunes for software tasks. Adds language, input/output, edge cases, code style. Tells the eventual model to ask clarifying questions instead of guessing.',
          },
          {
            label: 'Analysis',
            text: 'Tunes for research and analysis. Asks for citations, reasoning, and explicit uncertainty handling — "say I do not know" rather than fabricating findings.',
          },
          {
            label: 'Brainstorm',
            text: 'Tunes for idea generation. Specifies number of ideas, categorization, evaluation criteria.',
          },
        ],
      },
    ],
  },

  {
    id: 'models',
    title: 'Models',
    body: [
      {
        type: 'text',
        text: 'Choose which model refines your prompts in Settings. Each has different trade-offs between capability, speed, and cost.',
      },
      {
        type: 'list',
        items: [
          {
            label: 'Sonnet 4.6 (default)',
            text: 'Balanced. Best general choice. $3 input / $15 output per million tokens.',
          },
          {
            label: 'Opus 4.7',
            text: 'Most capable. Best for complex prompts. $5 / $25 per million tokens. Noticeably slower.',
          },
          {
            label: 'Opus 4.6',
            text: 'Previous flagship. Still very strong. Same pricing as 4.7.',
          },
          {
            label: 'Haiku 4.5',
            text: 'Fastest and cheapest. Good for simple rough prompts. $1 / $5 per million tokens.',
          },
        ],
      },
      {
        type: 'note',
        text: 'Output tokens cost 5x input across all current Anthropic models. Refinements use both — the input is your rough prompt plus the refiner\'s system instructions, the output is the refined version plus changes plus scores.',
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
          {
            label: 'Cmd/Ctrl + Enter',
            text: 'Submit the current rough prompt for refinement.',
          },
          {
            label: 'Esc',
            text: 'Close any open modal (PII warning, Export/Import).',
          },
          {
            label: 'Enter (in rename)',
            text: 'When renaming a saved prompt, commits the name.',
          },
          {
            label: 'Esc (in rename)',
            text: 'When renaming, cancels and keeps the old name.',
          },
        ],
      },
    ],
  },

  {
    id: 'about',
    title: 'About',
    body: [
      {
        type: 'text',
        text: 'Prompt Refinery is a personal tool, built from scratch and run locally. The frontend is React, the backend is Express, the model is Claude via the Anthropic API.',
      },
      {
        type: 'text',
        text: 'All your prompts, history, saved items, and usage data live in your browser\'s localStorage. Nothing is sent to any server other than Anthropic\'s API when you click Refine, and even then only the prompt itself plus refinement instructions.',
      },
      {
        type: 'note',
        text: 'Export your data regularly. localStorage is browser-scoped — if you clear browser data or switch machines, the data is gone unless you have an export.',
      },
    ],
  },
];
