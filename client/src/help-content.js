export const HELP_CONTENT = [
  // ─── Core workflow ───────────────────────────────────────
  {
    id: 'getting-started',
    title: 'Getting started',
    body: [
      { type: 'text', text: 'Prompt Refinery transforms rough, vague AI prompts into well-structured ones. Paste or type a rough idea, pick a category, and submit — Claude rewrites it and shows you every change it made and why.' },
      { type: 'step', n: 1, title: 'Type a rough prompt', text: 'Use the composer at the bottom of the screen. Don\'t try to be polished — vague, casual language is fine. "Help me write something for my landlord" is a good starting point.' },
      { type: 'step', n: 2, title: 'Pick a category', text: 'Choose General, Writing, Code, Analysis, or Brainstorm. The category shapes how the refiner approaches the rewrite — a Code prompt gets treated differently from a Writing one.' },
      { type: 'step', n: 3, title: 'Submit and watch it stream', text: 'Click the send button or press Cmd+Enter (Ctrl+Enter on Windows/Linux). The refined prompt streams in word by word. When it finishes, a "What changed" list and a quality scorecard appear below.' },
      { type: 'step', n: 4, title: 'Copy and use it', text: 'Click the copy button next to the refined prompt to copy it to your clipboard. Paste it into ChatGPT, Claude.ai, Gemini, or whichever AI tool you\'re using.' },
      { type: 'step', n: 5, title: 'Iterate if needed', text: 'Use the follow-up panel beneath the output to adjust: "make it shorter," "add an example," "make the tone more formal." Each follow-up refines the already-refined version.' },
      { type: 'note', text: 'Everything is stored locally in your browser. Nothing leaves your machine except the API call to Anthropic to do the actual refinement.' },
    ],
  },
  {
    id: 'composer',
    title: 'The composer',
    body: [
      { type: 'text', text: 'The composer is the text area at the bottom of the screen. It\'s where you write your rough prompt before submitting.' },
      {
        type: 'list',
        items: [
          { label: 'Category chips', text: 'The row of chips above the textarea (General, Writing, Code, Analysis, Brainstorm) changes how refinement is approached. Pick whichever fits best; you can change it on each submission.' },
          { label: 'Cmd+Enter to submit', text: 'Faster than clicking the button. Works from anywhere inside the textarea.' },
          { label: 'Auto-resize', text: 'The textarea expands as you type, up to about 200px, then scrolls internally. You\'ll never need to scroll the whole page.' },
          { label: 'Character count', text: 'Appears at the bottom-left once you start typing. No hard limit, but prompts over ~2,000 characters are often better split into smaller, focused requests.' },
          { label: 'Stop button', text: 'While the model is streaming, the send button turns into a stop button. Click it at any time to abort the current refinement.' },
          { label: 'Mic button', text: 'Dictate your rough prompt using the microphone. Appears when voice input is enabled in Settings and your browser supports speech recognition.' },
        ],
      },
      { type: 'text', text: 'The composer also supports template variables — placeholders written as {{variable_name}} that get filled in interactively before the prompt is sent. See the Template variables section for details.' },
    ],
  },
  {
    id: 'template-variables',
    title: 'Template variables',
    body: [
      { type: 'text', text: 'Template variables let you write reusable prompt templates with fill-in-the-blank slots. Put any placeholder name inside double curly braces, like {{audience}} or {{tone}}, and Prompt Refinery will ask you to fill each one in before sending.' },
      { type: 'step', n: 1, title: 'Write a prompt with placeholders', text: 'In the composer, type something like: "Write a {{tone}} email to {{audience}} explaining {{topic}}." Use any name inside {{}} — spaces are allowed too.' },
      { type: 'step', n: 2, title: 'Click Refine', text: 'Instead of going straight to the API, a modal appears listing every unique variable you used with a text input for each.' },
      { type: 'step', n: 3, title: 'Fill in the values', text: 'Type the value for each placeholder — e.g., tone: "friendly but professional", audience: "my building manager", topic: "a broken radiator." Press Tab to move between fields.' },
      { type: 'step', n: 4, title: 'Continue', text: 'Click Continue. The values are substituted into the prompt and refinement proceeds normally. The original placeholder names are replaced before the text is sent to Claude.' },
      { type: 'note', text: 'Variable names are case-sensitive: {{Name}} and {{name}} are treated as two different slots. You can use the same placeholder more than once — it gets the same value wherever it appears.' },
      { type: 'text', text: 'Tip: save a prompt with placeholders as a template via the star button. When you load it again and refine, the variable modal appears automatically, turning it into a structured, reusable workflow.' },
    ],
  },
  {
    id: 'follow-ups',
    title: 'Follow-up refinement',
    body: [
      { type: 'text', text: 'After every refinement, a follow-up panel appears below the output. Use it to iterate on the refined version without losing what was already improved.' },
      { type: 'text', text: 'The follow-up sends both the refined prompt and your new instruction to Claude. It doesn\'t start from scratch — it builds on the work that was already done.' },
      {
        type: 'list',
        items: [
          { label: 'Preset chips', text: '"Shorter", "More formal", "Simpler", "Add examples" — the most common adjustments as single-click buttons. Useful when you know what direction to push in.' },
          { label: 'Free-form feedback', text: 'Type anything: "Add a deadline of Friday." "Make it sound less corporate." "Remove the section about pricing." Free-form gives you full control.' },
          { label: 'Model selector', text: 'The model dropdown on the follow-up panel lets you switch model for this specific follow-up — useful for comparing how different models interpret the same feedback.' },
        ],
      },
      { type: 'note', text: 'Each follow-up creates a new history entry. If you go in a direction you don\'t like, open History and click any earlier entry to go back.' },
    ],
  },
  {
    id: 'what-changed',
    title: 'The "What changed" panel',
    body: [
      { type: 'text', text: 'After every refinement, a numbered list of changes appears below the refined prompt. This is the teaching layer of Prompt Refinery — each entry explains what was improved and why.' },
      { type: 'text', text: 'Changes typically fall into categories like: added specificity, clarified the audience, specified output format, added constraints, introduced an example, shortened or restructured, or removed ambiguity.' },
      { type: 'text', text: 'Reading the changes carefully is the fastest way to get better at writing prompts. Over a few dozen refinements, you\'ll start to anticipate what the refiner will flag, and your rough prompts will improve naturally.' },
      { type: 'note', text: 'If a change surprises you or seems wrong for your context, use the follow-up panel to push back: "Don\'t use bullet points — keep it as prose." The refiner will adjust.' },
    ],
  },
  {
    id: 'quality-score',
    title: 'Quality score',
    body: [
      { type: 'text', text: 'Every refinement is scored on five dimensions — before and after. The two radar charts let you see at a glance which dimensions improved and by how much. A larger filled area = a better prompt.' },
      {
        type: 'list',
        items: [
          { label: 'Specificity', text: 'How concrete and detailed the request is. Vague words like "some" or "a bit" lower this score. Named things, quantities, and concrete descriptions raise it.' },
          { label: 'Audience', text: 'Whether the intended reader or recipient is clear. A prompt that doesn\'t specify who it\'s for forces the AI to guess — often wrong.' },
          { label: 'Format', text: 'Whether the desired output format is stated. "Give me a list of..." scores higher than "Tell me about..." because the model knows what shape the answer should take.' },
          { label: 'Constraints', text: 'What limits, exclusions, or requirements are stated. "Under 200 words," "no jargon," "UK English only" — these all raise the constraints score.' },
          { label: 'Examples', text: 'Whether examples or step-by-step reasoning is requested. "Show your reasoning" or "for instance..." prompts tend to get better, more grounded responses.' },
        ],
      },
      { type: 'text', text: 'The green "lift" pill shows average score gain across all dimensions. A lift of 1.5+ usually means genuine improvement. Below 0.5 often means your rough prompt was already fairly solid.' },
      { type: 'text', text: 'Each dimension also has a rationale — hover or read the score detail to see Claude\'s explanation for why it gave that particular score.' },
      { type: 'note', text: 'You can add or remove scoring dimensions in Settings → Scoring dimensions. Custom dimensions are described to Claude in the system prompt and scored alongside the built-in ones.' },
    ],
  },
  // ─── Organisation ────────────────────────────────────────
  {
    id: 'history-and-saved',
    title: 'History & Saved prompts',
    body: [
      { type: 'text', text: 'Every refinement is automatically added to History. History keeps the 20 most recent refinements and never requires you to do anything — it\'s always up to date.' },
      {
        type: 'list',
        items: [
          { label: 'Load', text: 'Click any history entry to reload that rough prompt, category, and refined output into the main view. Everything is restored exactly as it was.' },
          { label: 'Re-refine', text: 'The "Re-refine" button next to each history entry loads the entry and immediately opens the follow-up panel, ready for you to add new feedback. Use this to pick up where you left off or take a refinement in a different direction.' },
          { label: 'Import / Export', text: 'The icon in the History panel header opens the export and import dialog. Back up your history or move it to another browser.' },
        ],
      },
      { type: 'text', text: 'To keep a prompt permanently, click the star (☆) button on the refined prompt header. Starred prompts move to the Saved panel and never get trimmed.' },
      {
        type: 'list',
        items: [
          { label: 'Rename', text: 'Click the pencil icon on any saved prompt to rename it with a descriptive label. Saved prompts are listed by name, so good names matter.' },
          { label: 'Remove', text: 'Click the trash icon to unsave a prompt. It stays in History until the rolling 20 pushes it out, so you won\'t lose it immediately.' },
          { label: 'Folders', text: 'Saved prompts can be organised into named folders. See the Folders section for details on creating and using them.' },
        ],
      },
    ],
  },
  {
    id: 'folders',
    title: 'Prompt folders',
    body: [
      { type: 'text', text: 'Saved prompts can be organised into named folders inside the Saved panel. All prompts start in "Uncategorized" and can be dragged into any folder you create.' },
      { type: 'step', n: 1, title: 'Create a folder', text: 'Open the Saved panel and click the "+ New folder" button in the header. Type a name (e.g., "Work emails", "Code snippets", "Client X") and press Enter or click Add.' },
      { type: 'step', n: 2, title: 'Move prompts into folders', text: 'Drag any saved prompt card and drop it onto a folder to move it there. To move a prompt back to Uncategorized, drag it onto the Uncategorized section at the bottom. You can see which folder a prompt belongs to by its position in the list.' },
      { type: 'step', n: 3, title: 'Manage folders', text: 'Each folder header has a pencil icon to rename it and a trash icon to delete it. Deleting a folder moves all its prompts back to Uncategorized — no prompts are lost.' },
      { type: 'note', text: 'Folders are stored in your browser\'s localStorage alongside your saved prompts. They survive page refreshes but not browser data clears — export regularly if your collection is important.' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    body: [
      { type: 'text', text: 'The Analytics panel (chart icon in the sidebar) shows trends and breakdowns derived from your refinement history. No API calls — it\'s all computed locally from your stored data.' },
      {
        type: 'list',
        items: [
          { label: 'Average score lift per dimension', text: 'For each scoring dimension, the average gain between your rough prompt score and the refined prompt score across all history. A high lift on "Format" means your rough prompts consistently lack format guidance.' },
          { label: 'Best improved dimension', text: 'The dimension with the highest average lift across your history. A quick signal for where the refiner adds the most value for your typical prompts.' },
          { label: 'Score trend chart', text: 'A bar chart of your overall refined score (average across all dimensions) for the last 10 refinements, ordered by date. Watch this trend over time — it reflects how your prompting is improving.' },
          { label: 'Category breakdown', text: 'A horizontal bar chart showing how many refinements you\'ve done in each category. Useful for seeing whether you\'re over-using General when a more specific category would give better results.' },
          { label: 'Summary cards', text: 'Total refinements, average refined score, and average score lift — your overall numbers at a glance.' },
        ],
      },
      { type: 'note', text: 'Analytics only shows data for refinements that have scores (those done with the scoring feature enabled). Imported entries may not have scores and won\'t appear in charts.' },
    ],
  },
  // ─── Models & comparison ─────────────────────────────────
  {
    id: 'compare-models',
    title: 'Compare models',
    body: [
      { type: 'text', text: 'After a refinement completes, a "Compare with other models" button appears. Click it to pick up to 3 additional Claude models — your rough prompt gets refined in parallel by each, and you can compare the results side by side.' },
      {
        type: 'list',
        items: [
          { label: 'Side-by-side columns', text: 'Each model gets its own column showing: the refined prompt text, the list of changes it made, its score, estimated cost for that call, and latency.' },
          { label: 'Use this version', text: 'Click "Use this version" in any column to swap that model\'s output into your main view, as if it had been the original refinement. The history and scorecard all update.' },
          { label: 'Cost awareness', text: 'Opus models are significantly more expensive than Haiku. Running a 4-model comparison with Opus can cost 4× a standard refinement — glance at the Usage panel afterwards if you\'re tracking spend.' },
        ],
      },
      { type: 'note', text: 'Comparison runs all selected models in parallel, so latency is roughly the slowest model\'s latency rather than the sum. Four models in parallel is about the same wall-clock time as one.' },
    ],
  },
  {
    id: 'ab-testing',
    title: 'A/B testing',
    body: [
      { type: 'text', text: 'Refinement improves how a prompt is written, but does it produce better output? The A/B test answers that directly by running both your rough and refined prompts through a model and showing the results side by side.' },
      { type: 'step', n: 1, title: 'Open A/B testing', text: 'After a refinement, click "Test this refined prompt (A/B vs rough)" below the output.' },
      { type: 'step', n: 2, title: 'Choose a mode', text: '"Run both" sends the rough prompt and the refined prompt in parallel — two API calls, two columns of output. "Refined only" sends just the refined prompt, useful when you only want to see what it produces.' },
      { type: 'step', n: 3, title: 'Compare the outputs', text: 'Read both columns and judge which is more useful, accurate, or on-target for your use case. The structural improvement in the prompt often — but not always — translates into a better response.' },
      { type: 'note', text: 'The test runner model (set in Settings, independent from the refinement model) determines which model produces the test outputs. Use Haiku for fast/cheap tests, Opus for high-stakes ones.' },
    ],
  },
  // ─── New power features ──────────────────────────────────
  {
    id: 'multi-pass',
    title: 'Multi-pass refinement',
    body: [
      { type: 'text', text: 'Multi-pass mode runs your prompt through the refiner multiple times automatically. Each pass takes the previous refined output as its new rough input, compounding the improvements.' },
      { type: 'step', n: 1, title: 'Enable multi-pass', text: 'Below the composer, toggle "Multi-pass" on. A pass count selector (2–5) appears next to it. Choose how many passes you want.' },
      { type: 'step', n: 2, title: 'Submit normally', text: 'Click the send button or Cmd+Enter as usual. A progress indicator shows "Pass 1 of 3…" etc. as each pass completes.' },
      { type: 'step', n: 3, title: 'Review the result', text: 'After all passes complete, the final refined output is shown. The scorecard reflects the cumulative improvement from all passes.' },
      { type: 'text', text: 'Multi-pass is most useful for prompts that are very rough or complex. For already-decent prompts, a single pass is usually enough — diminishing returns set in quickly after 2–3 passes.' },
      { type: 'note', text: 'Each pass is a separate API call with its own cost and latency. A 3-pass refinement costs approximately 3× a standard single refinement.' },
    ],
  },
  {
    id: 'prompt-chain',
    title: 'Prompt chaining',
    body: [
      { type: 'text', text: 'The Prompt Chain panel (chain icon in the sidebar) lets you build a sequence of prompts where each step\'s output feeds into the next. Useful for multi-step workflows: research → summarise → draft → review.' },
      { type: 'step', n: 1, title: 'Open the Chain panel', text: 'Click the chain icon in the left sidebar to open the Prompt Chain view.' },
      { type: 'step', n: 2, title: 'Add steps', text: 'Click "Add step" to add a prompt card. Each card has a textarea for your prompt and controls to move it up or down in the sequence or delete it.' },
      { type: 'step', n: 3, title: 'Reference the previous output', text: 'Type {{previous_output}} inside any step\'s prompt to insert the output from the step before it. For example: "Summarise this text: {{previous_output}}".' },
      { type: 'step', n: 4, title: 'Run the chain', text: 'Click "Run chain." Steps execute one by one. Each step\'s output appears inline below its prompt card as it streams in. Once a step finishes, the next step starts.' },
      { type: 'step', n: 5, title: 'Copy the final output', text: 'The last step\'s output is highlighted as the chain\'s final result and includes a copy button.' },
      { type: 'note', text: 'Chains use the test runner model (set in Settings). Long chains with complex prompts can be expensive — Haiku is a good default for chaining tasks.' },
    ],
  },
  {
    id: 'share',
    title: 'Sharing prompts',
    body: [
      { type: 'text', text: 'After a refinement, the Share button (upload icon) in the refined prompt header lets you share your work in two ways: a local shareable link, or a formatted markdown block for pasting into Slack, email, or documents.' },
      {
        type: 'list',
        items: [
          { label: 'Shareable link', text: 'Generates a URL like http://localhost:3001/share/abc12345. Anyone who opens that URL (with the backend running) sees your rough prompt, refined prompt, changes, and scores in a clean read-only page. Copy the link with the copy button in the share modal.' },
          { label: 'Copy as Markdown', text: 'Creates a formatted markdown block containing the original prompt, the refined version, and the list of changes. Paste it into Notion, Slack, GitHub, or any markdown-capable tool.' },
        ],
      },
      { type: 'note', text: 'Share links are stored in a local file on your machine (server/shares.json) and require the backend server to be running to view. They\'re intended for sharing between tabs and quick team handoffs, not for public internet sharing.' },
    ],
  },
  // ─── Quality & safety tools ──────────────────────────────
  {
    id: 'custom-dimensions',
    title: 'Custom scoring dimensions',
    body: [
      { type: 'text', text: 'By default, every prompt is scored on five dimensions: Specificity, Audience, Format, Constraints, and Examples. In Settings → Scoring dimensions, you can add your own dimensions and remove any built-in ones that aren\'t relevant to your work.' },
      { type: 'step', n: 1, title: 'Open Settings', text: 'Click the gear icon in the sidebar to open Settings, then scroll to the "Scoring dimensions" section.' },
      { type: 'step', n: 2, title: 'Remove built-in dimensions', text: 'Click the × on any built-in dimension chip to hide it from scoring. "Reset defaults" restores all built-in dimensions.' },
      { type: 'step', n: 3, title: 'Add a custom dimension', text: 'Fill in the "Label" field (e.g., "Creativity") and the "Description" field (e.g., "Whether the prompt encourages novel, unexpected, or imaginative responses"). Click Add.' },
      { type: 'step', n: 4, title: 'Refine as normal', text: 'Your custom dimensions are passed to Claude alongside the built-in ones. The scorecard will include your new dimension with a score and rationale.' },
      { type: 'note', text: 'Custom dimension descriptions should be clear and specific — Claude scores them based on the description you provide. Vague descriptions produce inconsistent scores.' },
    ],
  },
  {
    id: 'prompt-linter',
    title: 'Prompt linter',
    body: [
      { type: 'text', text: 'The linter runs locally in your browser as you type, checking your rough prompt for common issues before you submit. Hints appear in a panel below the composer, colour-coded by severity.' },
      {
        type: 'list',
        items: [
          { label: 'Critical (red)', text: 'Prompt is too short (under 8 words). A prompt this brief almost never gives a useful refined output.' },
          { label: 'Warning (gold) — audience', text: 'Prompt is 15+ words but doesn\'t mention who the output is for. Adding "for a technical audience" or "to send to my manager" substantially changes refinement quality.' },
          { label: 'Warning (gold) — format', text: 'Prompt asks for output ("write," "generate," "create") but doesn\'t say what format. "Write a summary" is much weaker than "Write a 3-bullet summary."' },
          { label: 'Warning (gold) — concrete nouns', text: 'Short prompt (8–25 words) with no specific subjects. "Help me with something for work" → unclear. "Help me draft a performance review for a junior designer" → clear.' },
          { label: 'Info (grey) — length hint', text: 'Prompt asks for output but doesn\'t specify how long. Adding "in under 100 words" or "a paragraph" prevents unexpectedly long or short responses.' },
          { label: 'Info (grey) — constraints', text: 'Long prompt (25+ words) with no constraints. Consider what to exclude, limit, or require.' },
          { label: 'Info (grey) — examples', text: 'Long prompt (40+ words) with no examples or request for reasoning. "Show your work" or "for example…" often improves response quality significantly.' },
          { label: 'Info (grey) — hedge words', text: 'Prompt contains vague words like "something," "stuff," "things," "a bit." These are prime candidates for the refiner to tighten up.' },
        ],
      },
      { type: 'text', text: 'Each hint has an × dismiss button. Dismissed hints won\'t reappear until you change your prompt text. Toggle the linter entirely in Settings → Prompt linter.' },
      { type: 'note', text: 'The linter fires 400ms after you stop typing (debounced). It\'s heuristic, not exhaustive — it catches common patterns but isn\'t a substitute for the actual refinement.' },
    ],
  },
  {
    id: 'pii-scanner',
    title: 'PII scanner',
    body: [
      { type: 'text', text: 'Before each prompt is sent to the API, your browser scans it for sensitive-looking content. If anything is found, a warning modal appears so you can review and decide whether to proceed.' },
      {
        type: 'list',
        items: [
          { label: 'Credentials (critical)', text: 'OpenAI and Anthropic API keys, GitHub personal access tokens (ghp_/gho_), Slack tokens (xox…), AWS access key IDs (AKIA…), and generic key=value patterns that look like secrets. These should almost never appear in a prompt.' },
          { label: 'Financial (critical)', text: 'Credit card numbers (Luhn-validated, so random strings of digits rarely false-positive), US Social Security Numbers (range-validated), and IBANs.' },
          { label: 'Contact (warning)', text: 'Email addresses, US and international phone numbers, and street addresses. Often intentional ("draft a reply to person@company.com") but flagged so you can confirm.' },
        ],
      },
      { type: 'text', text: 'The modal gives you two options: "Edit first" returns you to the composer with the flagged content highlighted so you can remove or redact it. "Send anyway" bypasses the warning and proceeds normally.' },
      { type: 'text', text: 'The scanner runs entirely in your browser before any network request. Disable it in Settings → Privacy / PII scanner if it creates false positives for your specific workflow.' },
      { type: 'note', text: 'The scanner uses conservative regex patterns with checksum validation. It\'s a first line of defence — it won\'t catch obfuscated secrets or data written in natural language.' },
    ],
  },
  // ─── Conversation mode ────────────────────────────────────
  {
    id: 'conversations',
    title: 'Conversations',
    body: [
      { type: 'text', text: 'The Conversations panel (chat bubble icon in the sidebar) gives you a full multi-turn chat interface — separate from the refinement workflow. Use it to explore ideas, ask Claude questions, or run back-and-forth dialogue without the scoring/changes overhead.' },
      { type: 'step', n: 1, title: 'Start a conversation', text: 'Open the Conversations panel. Type in the input at the bottom and press Enter to send. Claude responds in a message bubble with full Markdown rendering — code blocks, bullet lists, bold text, tables, all supported.' },
      { type: 'step', n: 2, title: 'Continue the thread', text: 'Keep typing to continue the conversation. Each message and response is part of the same thread — Claude has context from everything said before.' },
      { type: 'step', n: 3, title: 'Browse past conversations', text: 'Click the list icon in the panel header to switch to conversation history. Every conversation is saved automatically with an auto-generated title from the first message. Click any conversation to reopen it.' },
      {
        type: 'list',
        items: [
          { label: 'Code syntax highlighting', text: 'Code blocks in Claude\'s responses are highlighted with the appropriate language and include a copy button.' },
          { label: 'Rename', text: 'Hover a conversation in the list view and click the pencil to give it a better title.' },
          { label: 'Delete', text: 'Click the trash icon next to a conversation to remove it permanently.' },
          { label: 'Model', text: 'The model used for conversations is the Test runner model, set in Settings.' },
        ],
      },
    ],
  },
  // ─── Input methods ────────────────────────────────────────
  {
    id: 'templates',
    title: 'Templates',
    body: [
      { type: 'text', text: 'Templates (the document icon in the sidebar) are starter prompts for common scenarios — email drafts, code reviews, brainstorming sessions, SQL queries, and more. They\'re organised by category.' },
      { type: 'text', text: 'Clicking a template fills the composer with the starter text and automatically selects the matching category. From there you can edit it before submitting or submit as-is and let the refiner shape it.' },
      { type: 'note', text: 'Templates are intentionally rough — they\'re starting points, not finished prompts. Treat them as a rough prompt that benefits from refinement, not as a final product.' },
    ],
  },
  {
    id: 'voice-input',
    title: 'Voice input',
    body: [
      { type: 'text', text: 'Dictate rough prompts using your microphone. The mic button appears next to the send button when voice input is enabled in Settings and your browser supports the Web Speech API.' },
      {
        type: 'list',
        items: [
          { label: 'Click to start', text: 'Click the mic. The first time, your browser asks for microphone permission. The button turns red and an indicator shows it\'s listening.' },
          { label: 'Speak naturally', text: 'Words transcribe in real time into the composer. Don\'t worry about perfect grammar or punctuation — the refiner handles cleanup.' },
          { label: 'Click to stop', text: 'Click the mic again to stop. The transcription stays in the composer; edit or submit it normally.' },
          { label: 'Append mode', text: 'If there\'s already text in the composer, voice input appends to it (with a space) rather than overwriting.' },
        ],
      },
      { type: 'note', text: 'Privacy note: Chrome routes speech recognition through Google\'s servers. Safari processes it on-device. Firefox doesn\'t support the Web Speech API at all. If on-device privacy matters, use Safari or type manually.' },
    ],
  },
  // ─── Data & export ───────────────────────────────────────
  {
    id: 'export-import',
    title: 'Export & Import',
    body: [
      { type: 'text', text: 'Open the Export/Import dialog from the icon in the History panel header. Use it to back up your history and saved prompts, move data to another browser, or load prompts from a file.' },
      {
        type: 'list',
        items: [
          { label: 'JSON (.json)', text: 'Lossless backup — includes every field (rough prompt, refined prompt, changes, scores per dimension, model, timestamps). Best for re-importing later. All data survives the round-trip.' },
          { label: 'Markdown (.md)', text: 'Human-readable format. Good for reviewing your library, sharing with someone who doesn\'t use the app, or including in documentation. Some nested data (scores, changes) becomes prose.' },
          { label: 'CSV (.csv)', text: 'Flat spreadsheet format. Best for opening in Excel or Google Sheets to filter, sort, or chart. Nested data (scores, change details) is dropped — use JSON for full fidelity.' },
        ],
      },
      { type: 'text', text: 'Import auto-detects the file format from the extension. Duplicate detection uses the rough + refined + model combination as a composite key — duplicates are skipped, not imported twice. Imported entries get an "Imported" badge in History.' },
      { type: 'note', text: 'Export regularly if your prompt library matters — localStorage is cleared by "Clear site data" in browser settings. A JSON export is a complete, importable backup.' },
    ],
  },
  {
    id: 'pdf-export',
    title: 'PDF export',
    body: [
      { type: 'text', text: 'Export the current refinement as a polished PDF — for sharing with clients, colleagues, or including in a report. The PDF button (file icon) sits in the refined prompt header, next to the Copy button.' },
      {
        type: 'list',
        items: [
          { label: 'Preview before downloading', text: 'Clicking the button opens a preview modal showing what the PDF will look like. Takes 1–2 seconds to generate. No download happens until you confirm.' },
          { label: 'Toggle sections', text: 'In the preview modal you can turn sections on or off — rough prompt, refined prompt, what changed, scores and radar charts, A/B test results, model comparison. The preview updates within 250ms of each toggle.' },
          { label: 'Custom filename', text: 'Defaults to prompt-refinery-YYYY-MM-DD-HHMM.pdf. Click the filename field to change it before downloading. Illegal filesystem characters are stripped automatically.' },
          { label: 'Real text in the PDF', text: 'The prompt text is real, selectable, copyable text — not an image. Recipients can copy the refined prompt directly from the PDF. (Radar charts are rasterized images, but the prompt text is not.)' },
        ],
      },
      { type: 'note', text: 'For archiving or re-importing, prefer Markdown or JSON export — they\'re smaller, searchable, and round-trip back into the app. PDF is specifically for sharing with people who won\'t open Prompt Refinery.' },
    ],
  },
  {
    id: 'usage-tracking',
    title: 'Usage & cost tracking',
    body: [
      { type: 'text', text: 'Open the Usage panel (clock icon in the sidebar) to see your token consumption, estimated cost, and latency over the last 24 hours, 7 days, and 30 days.' },
      {
        type: 'list',
        items: [
          { label: 'Cost estimate', text: 'Calculated from Anthropic\'s published per-million-token pricing applied to your local token counts. Treat it as a useful approximation — the actual bill from Anthropic may differ slightly due to rounding and pricing updates.' },
          { label: 'Daily cost chart', text: 'A bar chart showing your spending day by day over the last week. Useful for spotting expensive sessions.' },
          { label: 'Latency', text: 'Average time from submit to final response. Useful for knowing which models feel slow at your current usage level.' },
          { label: 'Reset', text: 'Click "Reset usage" to clear all tracked data. The usage history rolls at 500 records; older records drop automatically.' },
        ],
      },
      { type: 'note', text: 'Each refinement, comparison column, A/B test call, and conversation message is tracked separately. Multi-model comparisons are the fastest way to accumulate cost — each model is a separate billable API call.' },
    ],
  },
  // ─── Settings & extension ────────────────────────────────
  {
    id: 'settings',
    title: 'Settings',
    body: [
      { type: 'text', text: 'Open Settings from the gear icon in the sidebar.' },
      {
        type: 'list',
        items: [
          { label: 'Prompt linter', text: 'Toggle the real-time hint panel below the composer on or off. Useful to disable if you\'re an experienced prompter who finds the hints distracting.' },
          { label: 'Privacy / PII scanner', text: 'Toggle the pre-send scan for credentials, financial data, and contact info. Disable only if you\'re confident your prompts never contain sensitive data.' },
          { label: 'Voice input', text: 'Toggle the microphone button. Auto-disabled if your browser doesn\'t support the Web Speech API.' },
          { label: 'Refinement model', text: 'Which Claude model handles /api/improve (the main refinement). Sonnet 4.6 is the default — good balance of quality and cost. Opus 4.7 gives noticeably better results for complex prompts at higher cost.' },
          { label: 'Test runner model', text: 'Which model handles A/B tests, conversations, and prompt chains. Independent from the refinement model — mix and match as needed.' },
          { label: 'Scoring dimensions', text: 'Add custom dimensions or hide built-in ones. See the Custom scoring dimensions section for details.' },
          { label: 'Reset', text: 'Reverts all settings to their defaults. Does not clear history, saved prompts, or usage data.' },
        ],
      },
    ],
  },
  {
    id: 'browser-extension',
    title: 'Browser extension',
    body: [
      { type: 'text', text: 'A lightweight Chromium extension is included in the project under the extension/ folder. Install it to refine prompts from any web page without switching tabs.' },
      { type: 'step', n: 1, title: 'Install the extension', text: 'Open chrome://extensions in Chrome or Chromium. Enable "Developer mode" (top right toggle). Click "Load unpacked" and select the extension/ folder from the project directory.' },
      { type: 'step', n: 2, title: 'Use it', text: 'Click the Prompt Refinery icon in your browser toolbar. The popup mirrors the main composer: type a rough prompt, pick a category, submit. Results appear in the popup itself.' },
      { type: 'step', n: 3, title: 'Backend must be running', text: 'The extension calls the same /api/improve endpoint as the main app. The backend server (cd server && npm run dev) must be running on port 3001.' },
      { type: 'note', text: 'The extension buffers the full SSE stream before displaying results, so there\'s no streaming animation — results appear all at once when complete. This is a known limitation of the extension\'s simpler architecture.' },
    ],
  },
];
