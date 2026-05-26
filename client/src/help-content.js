export const HELP_CONTENT = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: [
      { type: 'text', text: 'Prompt Refinery turns rough, vague prompts into well-structured ones that work better with AI models. The workflow is straightforward: type a rough idea, pick a category, submit, and review what changed.' },
      { type: 'step', n: 1, title: 'Type a rough prompt', text: 'Use the composer at the bottom. Don\'t worry about being polished — that\'s the point. "Help me write an email to my landlord" is a fine starting place.' },
      { type: 'step', n: 2, title: 'Pick a category', text: 'General, Writing, Code, Analysis, or Brainstorm. The category guides the refinement style.' },
      { type: 'step', n: 3, title: 'Submit', text: 'Click the send button, or press Cmd+Enter (Ctrl+Enter on Windows/Linux). You\'ll see the refined prompt stream in, followed by a list of what changed and a quality score.' },
      { type: 'step', n: 4, title: 'Iterate', text: 'Use the follow-up panel underneath to refine further — "make it shorter," "add examples," or whatever you need. Or copy the refined prompt and use it directly in your AI tool of choice.' },
      { type: 'note', text: 'All your refinements are saved locally in your browser. Nothing leaves your machine except the API call to Anthropic to actually refine the prompt.' },
    ],
  },
  {
    id: 'composer',
    title: 'The composer',
    body: [
      { type: 'text', text: 'The composer is where you type rough prompts. A few things to know:' },
      {
        type: 'list',
        items: [
          { label: 'Categories', text: 'The chip row above the textarea changes how the refinement is approached. Pick the one that best fits your task.' },
          { label: 'Cmd+Enter to submit', text: 'Faster than reaching for the mouse. Works from anywhere inside the textarea.' },
          { label: 'Auto-resize', text: 'The textarea grows as you type, up to about 200px tall, then scrolls.' },
          { label: 'Character count', text: 'Shows at the bottom-left once you start typing. There\'s no hard limit, but if you\'re past ~2000 characters, you might want to break your prompt into smaller pieces.' },
          { label: 'Stop button', text: 'During streaming, the send button turns into a stop button. Click it to abort the current refinement.' },
        ],
      },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    body: [
      { type: 'text', text: 'Templates are starter prompts for common scenarios — email drafts, code reviews, brainstorming sessions, and so on. Open the Templates panel from the sidebar.' },
      { type: 'text', text: 'Clicking a template fills the composer with the starter text and selects the right category. From there, you can edit it before submitting, or submit as-is.' },
      { type: 'note', text: 'Templates are a starting point, not a finished product. Treat them as rough prompts — they\'re meant to be refined further.' },
    ],
  },
  {
    id: 'what-changed',
    title: 'The "What changed" panel',
    body: [
      { type: 'text', text: 'After every refinement, you\'ll see a numbered list of changes the refiner made to your rough prompt. This is the teaching layer — over time, reading these changes helps you write better rough prompts.' },
      { type: 'text', text: 'Each change includes a title (the type of change) and an explanation (what specifically was done and why). Common change types include adding specificity, clarifying the audience, specifying output format, adding constraints, and requesting examples.' },
    ],
  },
  {
    id: 'quality-score',
    title: 'Quality score',
    body: [
      { type: 'text', text: 'Every refinement is scored on five dimensions, before and after. The two radar charts show the shape of the rough prompt versus the refined one — bigger area = better prompt.' },
      {
        type: 'list',
        items: [
          { label: 'Specificity', text: 'How concrete and detailed the request is.' },
          { label: 'Audience', text: 'Whether the intended reader / recipient is clear.' },
          { label: 'Format', text: 'Whether the desired output format is specified.' },
          { label: 'Constraints', text: 'What limits, exclusions, or requirements are stated.' },
          { label: 'Examples', text: 'Whether examples are provided or step-by-step reasoning is requested.' },
        ],
      },
      { type: 'text', text: 'The "lift" number (green pill) shows how many points the refinement gained on average. A lift of 1.5+ usually means the refiner found genuine improvements. A lift below 0.5 might mean your rough prompt was already pretty good.' },
      { type: 'note', text: 'The scores come from Claude itself, so they\'re not perfectly objective. Treat them as a rough signal, not a verdict. The teaching value is in the rationale text, not the numbers.' },
    ],
  },
  {
    id: 'follow-ups',
    title: 'Follow-up refinement',
    body: [
      { type: 'text', text: 'After a refinement completes, a follow-up panel appears. Use it to iterate further on the same refined prompt — without losing the work you\'ve done.' },
      {
        type: 'list',
        items: [
          { label: 'Preset chips', text: 'Shorter, More formal, Simpler, Add examples — common refinements you\'ll want often.' },
          { label: 'Free-form input', text: 'Type any feedback in your own words. "Less casual." "Add a deadline." "Make the tone match the recipient."' },
        ],
      },
      { type: 'text', text: 'The follow-up replaces the current refined prompt with a new version that incorporates your feedback. Use the History panel to go back to a previous version if needed.' },
    ],
  },
  {
    id: 'history-and-saved',
    title: 'History & Saved prompts',
    body: [
      { type: 'text', text: 'Every refinement is automatically added to History (rolling 20). To keep a prompt permanently, click the star button on its message header — it moves to Saved.' },
      {
        type: 'list',
        items: [
          { label: 'History', text: 'Recent refinements. Click any entry to reload it. Auto-trims to the 20 most recent.' },
          { label: 'Saved', text: 'Permanent collection. No item limit. Each saved prompt can be renamed (pencil icon) or removed (trash icon).' },
        ],
      },
      { type: 'text', text: 'Both are stored in your browser\'s localStorage. They survive page refreshes, but not browser data clears. Use Export to back them up.' },
    ],
  },
  {
    id: 'compare-models',
    title: 'Compare models',
    body: [
      { type: 'text', text: 'After a refinement completes, you\'ll see a "Compare with other models" button. Click it to pick up to 3 additional models — your rough prompt gets refined in parallel by each, and you can see the results side by side.' },
      { type: 'text', text: 'Each comparison column shows the refined prompt, the score, the cost, and the latency for that model. Click "Use this version" to swap the comparison result into your main view.' },
      { type: 'note', text: 'Comparison costs add up — each additional model is a separate API call. Glance at the Usage panel after a comparison run to see the impact.' },
    ],
  },
  {
    id: 'ab-testing',
    title: 'A/B Testing',
    body: [
      { type: 'text', text: 'Refinement helps your prompt score better, but does it produce better output? A/B Testing answers that. After a refinement, click "Test this refined prompt (A/B vs rough)" to run both the rough and refined versions through a model and see the results side by side.' },
      {
        type: 'list',
        items: [
          { label: 'Run both mode', text: 'Sends the rough prompt and the refined prompt to the test model in parallel. Two columns, two outputs. Compare quality directly.' },
          { label: 'Refined only mode', text: 'Just the refined prompt. Useful when you only want to see what your prompt produces, without paying for two calls.' },
          { label: 'Test runner model', text: 'Set in Settings, independent of the refinement model. Match it to the task complexity — Haiku for simple, Opus for complex.' },
        ],
      },
      { type: 'note', text: 'Each test is a real API call with real cost. Use it on prompts where the answer matters — not every refinement needs to be tested.' },
    ],
  },
  {
    id: 'voice-input',
    title: 'Voice input',
    body: [
      { type: 'text', text: 'Dictate rough prompts using your microphone instead of typing. The mic button appears next to the send button when voice input is enabled in Settings and your browser supports speech recognition.' },
      {
        type: 'list',
        items: [
          { label: 'Click to start', text: 'Click the mic. First time, your browser will ask for microphone permission. The mic turns red while listening.' },
          { label: 'Speak naturally', text: 'Words appear in the composer as you speak. Don\'t worry about punctuation — the refiner cleans it up.' },
          { label: 'Click to stop', text: 'Click the mic again to stop. Whatever was transcribed stays in the composer and you can edit or submit it normally.' },
          { label: 'Append mode', text: 'If you already have text typed, voice transcription is appended (with a space). It doesn\'t overwrite what you typed.' },
        ],
      },
      { type: 'note', text: 'Honest disclosure: on Chrome, speech recognition routes through Google\'s servers. On Safari, it stays on-device. Firefox doesn\'t support it. If privacy matters to you, use Safari or disable voice input in Settings.' },
    ],
  },
  {
    id: 'prompt-linter',
    title: 'Prompt linter',
    body: [
      { type: 'text', text: 'The linter runs locally in your browser as you type, flagging common issues in rough prompts before you submit. Hints appear in a panel below the composer.' },
      {
        type: 'list',
        items: [
          { label: 'Critical hints (red)', text: 'Things that almost always hurt prompt quality — like being too vague, or asking for an opinion without context.' },
          { label: 'Warning hints (gold)', text: 'Things to consider — like missing audience information, or no specified format.' },
          { label: 'Info hints (gray)', text: 'Gentle suggestions — like adding examples or asking for step-by-step reasoning.' },
          { label: 'Dismiss button', text: 'Each hint has an × button. Dismissed hints don\'t come back until you change your prompt.' },
        ],
      },
      { type: 'text', text: 'The linter runs about 400ms after you stop typing — it\'s debounced so it doesn\'t flicker on every keystroke. Toggle it off entirely in Settings if you find it distracting.' },
      { type: 'note', text: 'The linter is heuristic, not exhaustive. It catches obvious issues but doesn\'t guarantee a good prompt. The real check is the quality score after refinement.' },
    ],
  },
  {
    id: 'pii-scanner',
    title: 'PII scanner',
    body: [
      { type: 'text', text: 'Before each prompt is sent to the AI, your browser scans it for sensitive-looking content. If anything is found, a warning modal appears so you can review and decide whether to send anyway.' },
      {
        type: 'list',
        items: [
          { label: 'Credentials (critical)', text: 'API keys, access tokens, private keys, anything that looks like a secret. These should almost never be in a prompt — the warning is strong.' },
          { label: 'Financial (critical)', text: 'Credit card numbers (Luhn-validated, so false positives are rare). Bank account numbers and similar.' },
          { label: 'Contact (warning)', text: 'Email addresses, phone numbers. Often intentional ("draft a reply to john@example.com") but flagged so you can confirm.' },
        ],
      },
      { type: 'text', text: 'The scanner runs entirely in your browser before any network request. Nothing is sent until you click "Send anyway" or "Send as-is." You can disable the scanner in Settings if you find it annoying for your use case.' },
      { type: 'note', text: 'The scanner uses regex patterns and a Luhn check for cards. It catches the common cases but isn\'t bulletproof — it won\'t catch a credit card written as "four-eight-zero-zero..." or a key obfuscated with spaces. Treat it as a first line of defense, not a guarantee.' },
    ],
  },
  {
    id: 'export-import',
    title: 'Export & Import',
    body: [
      { type: 'text', text: 'Open the Export/Import dialog from the History panel header. You can save a copy of all your history and saved prompts to a file, or load prompts from a previously exported file.' },
      {
        type: 'list',
        items: [
          { label: 'Markdown (.md)', text: 'Human-readable. Best for reviewing your prompt library or sharing snippets with someone.' },
          { label: 'JSON (.json)', text: 'Lossless backup with every field. Best for re-importing later — keeps scores, changes, model info, everything.' },
          { label: 'CSV (.csv)', text: 'Flat spreadsheet format. Best for opening in Excel or Google Sheets to filter or sort.' },
        ],
      },
      { type: 'text', text: 'Imports are merged with your existing data — duplicates are detected and skipped. You can import a file from any of the three formats; the importer auto-detects.' },
    ],
  },
  {
    id: 'pdf-export',
    title: 'PDF export',
    body: [
      { type: 'text', text: 'Export the current refined prompt as a polished PDF — for sharing with clients, sending to colleagues who don\'t use the app, or including in larger documents. The PDF button (file icon) sits next to the Copy button in the refined prompt header.' },
      {
        type: 'list',
        items: [
          { label: 'Preview first', text: 'Clicking the PDF button opens a preview modal showing exactly what the PDF will look like. Takes 1-2 seconds to generate. No download happens yet.' },
          { label: 'What\'s included', text: 'Title, your rough prompt (for context), the refined prompt as the main content, the "What changed" list, and the quality scores including the radar charts.' },
          { label: 'Filename', text: 'Defaults to prompt-refinery-YYYY-MM-DD-HHMM.pdf. You can edit it before downloading; illegal filesystem characters are stripped automatically.' },
          { label: 'Real text, not images', text: 'The prompt text in the PDF is real, copyable text — recipients can paste it into their own AI tool. (The radar charts are rasterized as images, but the chart labels aren\'t the important part.)' },
        ],
      },
      { type: 'text', text: 'The PDF uses standard system fonts (Helvetica-family) rather than embedded custom fonts. This keeps file size small and rendering reliable across all PDF viewers — Adobe Reader, Preview, browser viewers, mobile readers.' },
      { type: 'note', text: 'For archival or re-import, prefer Markdown export — it\'s smaller, searchable, and round-trips back into the app. PDF is specifically for the sharing use case where the recipient won\'t open the app.' },
    ],
  },
  {
    id: 'usage-tracking',
    title: 'Usage & cost tracking',
    body: [
      { type: 'text', text: 'Open the Usage panel from the sidebar to see token counts, estimated cost, and latency over the last 24 hours, 7 days, and 30 days. The chart shows daily cost over the past week.' },
      { type: 'text', text: 'Cost is estimated from Anthropic\'s published per-million-token rates, applied to your local token counts. The final bill from Anthropic may differ slightly — treat the numbers here as a useful estimate, not an invoice.' },
      { type: 'text', text: 'Click "Reset" to clear all tracked usage. The data is stored in localStorage, rolling 500 records.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    body: [
      {
        type: 'list',
        items: [
          { label: 'Prompt linter', text: 'Toggle the inline hints panel on/off.' },
          { label: 'Privacy / PII scanner', text: 'Toggle the pre-send scan for sensitive content.' },
          { label: 'Voice input', text: 'Toggle the microphone button. Disabled automatically if your browser doesn\'t support speech recognition.' },
          { label: 'Refinement model', text: 'Which Claude model does the refinement. Sonnet 4.6 is the default — good balance of quality and cost.' },
          { label: 'Test runner model', text: 'Which Claude model runs your A/B tests. Independent from the refinement model.' },
          { label: 'Reset', text: 'Reverts all settings to their defaults.' },
        ],
      },
    ],
  },
  {
    id: 'browser-extension',
    title: 'Browser extension',
    body: [
      { type: 'text', text: 'A lightweight Chromium extension is included in the project under the extension/ folder. Install it as an unpacked extension to refine prompts from any web page without switching tabs.' },
      { type: 'text', text: 'The extension popup mirrors the composer: rough prompt input, category picker, and submit. Results are shown in the popup itself. Same API key, same backend.' },
      { type: 'note', text: 'The extension requires the local backend to be running. It calls the same /api/improve endpoint as the main app.' },
    ],
  },
];
