# Prompt Refina — CLAUDE.md

Project context for Claude Code and Claude.ai. Keep this file updated when architecture or patterns change.

---

## What This Project Does

**Prompt Refina** is a developer tool that transforms rough, vague AI prompts into well-structured ones using Claude. Users paste a rough prompt, choose a category, and receive a refined version with:
- An explanation of every change made
- A quality scorecard (5 dimensions, 1–5 scale, with radar charts)
- Options to iterate (follow-up feedback), compare models, A/B test outputs, and run multi-turn conversations

The product name throughout the UI is "Prompt Refina". The repo folder is `prompt-improver` (historical name — do not rename).

---

## Architecture: 3-Tier

```
extension/      Chrome/Chromium Manifest V3 popup (vanilla JS)
    │
    └──► server/index.js   Express 5 API (port 3001, SSE streaming)
                                │
client/src/     React 19 SPA   │
    └──────────────────────────┘
                calls /api/* endpoints
```

All three tiers are independent sub-apps. The browser extension and React client both talk to the same backend. There is no shared code between tiers.

---

## Dev Setup

### Backend
```bash
cd server
npm install
# Create server/.env with:
#   ANTHROPIC_API_KEY=sk-ant-...
npm run dev        # nodemon, port 3001
```

### Frontend
```bash
cd client
npm install
npm run dev        # Vite dev server, port 5173
# Optional: set VITE_API_URL in client/.env to point at a non-localhost backend
```

### Browser Extension
Load unpacked from `extension/` in `chrome://extensions` with Developer Mode on.
No build step — vanilla JS. The extension talks to `http://localhost:3001` by default.
To point it elsewhere, set `window.PROMPT_REFINERY_CONFIG.apiUrl` in `extension/config.js`
(loaded as a `<script>` in `popup.html` before `popup.js`).

---

## Key Files

| File | Role |
|---|---|
| `server/index.js` | Backend entrypoint (~720 lines). All API routes, rate limiting, SSE + abort helpers, Notion/Slack export, eval, share routes. |
| `server/lib.js` | Pure refiner helpers: `buildSystemPrompt`, `parseRefinerResponse`, user templates, `targetModelGuidance`, `promptTypeGuidance`. Unit-tested (`lib.test.js`). |
| `server/shareStore.js` | Share persistence: Upstash Redis when configured, file + memory fallback otherwise. |
| `client/src/App.jsx` | Root React component (~2500 lines). All app state, event handlers, and main layout. Imports from all the modules below. |
| `client/src/constants.js` | All application constants (MODELS, PRICING, STORAGE_*, DEFAULT_SETTINGS, etc.). No imports. |
| `client/src/utils.js` | Pure utility functions (formatTime, computeCost, computeWordDiff, etc.). Imports from constants only. |
| `client/src/sse.js` | SSE streaming client functions (consumeSSE, streamRefinement, etc.). No React deps. |
| `client/src/PDFPreviewModal.jsx` | PDF preview + download modal. Uses jsPDF + html2canvas. |
| `client/src/LeftRailViews.jsx` | All left-rail drawer views: History, Saved, Templates, Usage, Analytics, Chain, Help, Settings, ImportExport. |
| `client/src/ScoreComponents.jsx` | Skeletons, LintHintsPanel, RoughPromptMessage, ChangesPanel, RadarChart, ScoresPanel. |
| `client/src/ComparisonPanels.jsx` | CompareInvite, ComparisonColumn, ComparisonStrip. |
| `client/src/ABTestPanels.jsx` | ABTestInvite, ABTestPanel, ABTestResults, ABTestColumn, FollowUpPanel. |
| `client/src/Modals.jsx` | PIIWarningModal, TemplateVariablesModal, ShareModal, PromptDiffPanel, ConfirmDialog, ToastList. |
| `client/src/RunDrawer.jsx` | Slide-out conversation panel. Markdown rendering, syntax highlighting, conversation list. |
| `client/src/lint.js` | Client-side prompt linter. 8 heuristic checks, no API call. |
| `client/src/scan.js` | Client-side PII scanner. Regex patterns with Luhn/SSN validation. No API call. |
| `client/src/io.js` | Export (MD/JSON/CSV) and import logic. Includes a hand-rolled RFC-4180 CSV parser. |
| `client/src/icons.jsx` | All SVG icons as React components. Add new icons here. |
| `client/src/help-content.js` | Static help documentation data (no logic). |
| `client/src/templates-content.js` | Starter prompt templates grouped by category. |
| `extension/popup.js` | Extension logic (~270 lines). Buffers the full SSE stream before rendering (no progressive display). |
| `extension/manifest.json` | Manifest V3. Host permissions limited to `http://localhost:3001/*`. |

---

## Backend: API Routes

All routes stream responses over **Server-Sent Events (SSE)**. The `setupSSE` / `sendEvent` helpers handle headers and formatting.

**Rate limiting:** all AI/export routes (everything except `/api/health` and the share GETs) pass through the in-memory per-IP `rateLimit` middleware in `server/index.js` (default 30 req/min, tunable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`). It's per-instance and resets on restart.

**Abort:** streaming routes use `wireAbort(res)` to cancel the Anthropic call when the client disconnects (listens on response `close`, passes an `AbortSignal` to the SDK). `sendEvent` is a no-op once the response has ended.

### `POST /api/improve`
Main refinement endpoint. Accepts `{ prompt, category, model, previousRefined?, feedback?, dimensions?, customInstructions?, targetModel?, promptType? }`.
`targetModel` tailors the refined output to a destination model's idioms (claude/gpt/gemini prefix); `promptType: 'system'` refines as a system prompt rather than a one-off request.

SSE event sequence:
1. `refined-chunk` — streaming text of the refined prompt (many events)
2. `refined-done` — signals the refined text is complete
3. `changes` — `{ changes: [{title, explanation}] }`
4. `scores` — `{ scores: { rough: {...}, refined: {...} } }`
5. `done` — `{ usage: {inputTokens, outputTokens}, latencyMs }`
6. `error` — only on failure

Follow-up refinements use `FOLLOWUP_USER_TEMPLATE` instead of `REFINER_USER_TEMPLATE`.
The `previousRefined` and `feedback` fields trigger this path.

### `POST /api/improve-compare`
Multi-model comparison. Accepts `{ prompt, category, models: [id, ...] }` (max 4 models).
Runs all models in parallel via `Promise.allSettled`. Each model emits:
`model-chunk`, `model-changes`, `model-scores`, `model-done`, `model-error`
Followed by a final `compare-done` event.

### `POST /api/test-prompt`
A/B test runner. Accepts `{ prompts: [{id, prompt}], model }`.
Runs all prompts in parallel. Emits `test-chunk`, `test-done`, `test-error` per prompt,
then `test-complete`.

### `POST /api/run-prompt`
Multi-turn conversation. Accepts `{ messages: [{role, content}], model }`.
Streams a single assistant turn. Emits `run-chunk`, `run-done`, `run-error`.
Client-disconnect cancellation is handled by `wireAbort` (see the Abort note above).

### `POST /api/critique`
AI critique of a prompt. Accepts `{ prompt, model? }` (defaults to Opus 4.8).
Streams `critique-chunk`, then `critique-done` / `critique-error`.

### `POST /api/eval`
Prompt eval runner. Accepts `{ prompt, model?, judgeModel?, cases: [{id, input?, expected?}] }` (max 20 cases).
Runs the prompt per case in parallel; cases with an `expected` are graded by an LLM judge.
Emits `eval-chunk`, `eval-graded`, `eval-done`, `eval-error` per case, then `eval-complete`.

### `GET /api/health`
Returns `{ ok: true, time: "..." }`. No auth, not rate-limited.

### Share routes
`POST /api/share` (rate-limited), `GET /api/share/:id` (JSON), `GET /share/:id` (HTML page).
Persistence lives in `server/shareStore.js` — Upstash Redis when `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN` are set, else a local `shares.json` file + memory cache.

---

## The Refiner System Prompt

Claude is instructed to return responses using **custom delimiters**, not plain JSON.
This allows streaming the refined text progressively while the JSON sections arrive later.

```
<<<REFINED_PROMPT>>>
[the improved prompt text]
<<<CHANGES_JSON>>>
[JSON array of {title, explanation} objects]
<<<SCORES_JSON>>>
[JSON object with "rough" and "refined" keys, each with per-dimension {score, rationale}]
<<<END>>>
```

`parseRefinerResponse()` in `server/lib.js` extracts these sections via regex.
The server streams `REFINED_PROMPT` in real time as `refined-chunk` events, then emits
`changes` and `scores` as complete JSON after the full response arrives.
The pure refiner helpers (`buildSystemPrompt`, `parseRefinerResponse`, the user templates,
and the `targetModelGuidance` / `promptTypeGuidance` builders) live in `server/lib.js` and are unit-tested.

Score dimensions (5 total): `specificity`, `audience`, `format`, `constraints`, `examples`
Each scored 1–5 with a rationale string.

---

## Frontend: State & Storage

### State management
No external store (no Redux, Zustand, etc.). Everything is `useState` in the root `App` component.
Key state groups:
- **Refinement**: `roughPrompt`, `submittedPrompt`, `improvedPrompt`, `changes`, `scores`, `streaming`, `loading`
- **Comparison**: `comparison` (columns array), `comparing`
- **A/B test**: `abTest`, `abTesting`, `abTestOpen`
- **Conversation**: `currentConvo`, `conversations`, `running`, `convoDrawerOpen`
- **UI**: `activeView` (left drawer), `settings`, `lintHints`, `piiFindings`
- **Persistence**: `history`, `saved`, `usage`

### localStorage keys
| Key | Content | Cap |
|---|---|---|
| `prompt-improver-history` | Array of refinement records | 20 entries |
| `prompt-improver-saved` | Array of starred prompts | Unlimited |
| `prompt-improver-settings` | Settings object | — |
| `prompt-improver-usage` | Array of usage/cost records | 500 entries |
| `prompt-refina-current-convo` | Active conversation object | — |
| `prompt-refina-conversations` | Array of past conversations | 50 entries |

### AbortControllers
Each async operation has its own ref: `abortRef` (refinement), `compareAbortRef` (comparison),
`testAbortRef` (A/B test), `runAbortRef` (conversation). The Stop button aborts all active ones.

---

## Frontend: SSE Client

`consumeSSE(response, handlers)` in `App.jsx` is a generic SSE reader.
It reads the response body as a stream, splits on `\n\n`, parses `event:` and `data:` lines,
JSON-parses the data, and dispatches to `handlers[eventName]`.

Four typed wrappers sit on top: `streamRefinement`, `streamComparison`, `streamTest`, `streamRunPrompt`.

---

## Models & Pricing

Available Claude models (defined in `MODELS` array in `App.jsx`):
- `claude-opus-4-8` — most capable, default for refinement
- `claude-sonnet-4-6` — balanced speed and capability
- `claude-opus-4-6` — previous flagship
- `claude-haiku-4-5-20251001` — fastest/cheapest

GPT-4, GPT-4 Turbo, Gemini Pro are listed as "coming soon" placeholders (not wired up).

Pricing in `PRICING` map (per MTok, as of May 2026 — update when rates change):
- Opus 4.8 / Opus 4.6: $5.00 input / $25.00 output (Opus 4.8 rates confirmed)
- Sonnet 4.6: $3.00 input / $15.00 output
- Haiku 4.5: $1.00 input / $5.00 output

Two separate model settings in Settings:
- **Refinement model** — used for `/api/improve` and `/api/improve-compare`
- **Test runner model** — used for `/api/test-prompt` and `/api/run-prompt`

---

## Prompt Linter (`lint.js`)

Runs entirely in the browser with a 400ms debounce after the user stops typing.
8 checks, severity levels: `critical` > `warning` > `info`.

| Check | Trigger | Severity |
|---|---|---|
| Too short | < 8 words | critical |
| No concrete nouns | 8–25 words, no specific subjects | warning |
| Hedge words | "something", "stuff", "things", etc. | info |
| No audience | ≥ 15 words, no audience indicator | warning |
| No format | ≥ 10 words + output verb + no format word | warning |
| No length hint | ≥ 12 words + output verb + no length word | info |
| No constraints | ≥ 25 words, no constraint language | info |
| No examples | ≥ 40 words, no example/reasoning language | info |

Hints are dismissible per session. Dismissed hints reset when the prompt text changes.

---

## PII Scanner (`scan.js`)

Runs entirely in the browser before sending to the API. Intercepts the submit and shows
`PIIWarningModal` if findings exist. User can edit or send anyway.

Categories and patterns:
- **credentials** (critical): OpenAI/Anthropic API keys, GitHub PATs (ghp_/gho_), Slack tokens (xox*), AWS access key IDs (AKIA...), generic `key=value` secrets
- **financial** (critical): Credit cards (Luhn-validated), US SSNs (range-validated), IBANs
- **contact** (warning): Emails, US + international phone numbers, street addresses

False-positive mitigation: Luhn check on card numbers, area/group/serial validation on SSNs,
minimum digit count on phone numbers, conservative regex anchoring throughout.

---

## Export / Import (`io.js`)

Three export formats:
- **JSON** — lossless, includes nested data (changes, scores, comparison columns)
- **Markdown** — human-readable, includes scores and changes as prose
- **CSV** — flat, drops nested data; best for spreadsheets

Import: auto-detects format from file extension (content-sniffs as fallback).
Duplicate detection: `rough + improved + model` as composite key — duplicates are skipped.
Imported entries get `imported: true` flag (shown as a badge in History).

---

## RunDrawer: Conversation Panel

Slide-out `<aside>` from the right edge. Two modes toggled by `panelMode`:
- `conversation` — active chat view with message bubbles
- `list` — all past conversations with rename/delete

Assistant messages render full **GFM Markdown** via `react-markdown` + `remark-gfm`.
Code blocks use `react-syntax-highlighter` with the `oneDark` theme and a copy button.

`autoTitle()` truncates the first user message to 50 chars at a word boundary for conversation titles.

Conversation persistence: `currentConvo` is saved to localStorage on every update.
When the user opens a new conversation, the current one is archived to `conversations[]`.

---

## PDF Export

`PDFPreviewModal` uses **jsPDF** (programmatic layout, not HTML-to-PDF).
`html2canvas` is used only to rasterize the SVG radar chart, which jsPDF can't embed natively.

Sections are toggleable: rough prompt, refined prompt, changes, scores, A/B test results, model comparison.
PDF re-generates with a 250ms debounce on section toggle changes.

The modal offers: in-browser preview (`<iframe>`), open in new tab, download with custom filename.

---

## Known Issues & Tech Debt

1. **Pricing data hardcoded** — `PRICING` map in `constants.js` and the disclaimer in `UsageView` reference
   "May 2026" rates. These need manual updates when Anthropic changes pricing.

2. **Per-user data is browser-only** — history, saved, settings, usage, and conversations live in
   `localStorage` (not synced, capped, lost if cleared). Migrating this server-side is the planned
   accounts/DB phase (prerequisite for monetization + collaboration).

3. **Rate limiter is per-instance** — `rateLimit` uses an in-memory bucket, so limits aren't shared
   across multiple instances and reset on restart. Fine for the single-instance Render deployment.

_Resolved (kept for history): extension `config.js` is now wired in `popup.html`; `/api/run-prompt`
abort is fixed via `wireAbort`; repo-root junk files removed._

---

## Patterns to Follow

- **New API routes**: Add to `server/index.js`, use `setupSSE` + `sendEvent`, stream via SSE.
  Follow the `done` / `error` event convention. Validate inputs eagerly and return 400 before setting up SSE.
- **New SSE consumers**: Add a typed wrapper function to `sse.js` near `streamRefinement`.
  Use `consumeSSE` as the base. Import it in `App.jsx`.
- **New left-rail panels**: Add entry to `LEFT_RAIL_ITEMS` in `App.jsx`, add a `{activeView === 'x' && <XView />}`
  block in the `<aside>`, create the view component in `LeftRailViews.jsx`.
- **New icons**: Add SVG as a component to `icons.jsx`, export it, import where needed.
- **New constants**: Add to `constants.js` and import where needed.
- **New utility functions**: Add to `utils.js` (pure functions only) and import where needed.
- **localStorage**: Always write through a setter function that updates both React state and
  `localStorage` in one call (e.g., `saveToHistory`, `persistSaved`, `recordUsage`).
- **Abort safety**: Any new streaming operation needs an `AbortController` stored in a `useRef`,
  and the Stop button handler should call `.abort()` on it.
