/**
 * Application-wide constants for Prompt Refina.
 * No imports — pure data.
 */

export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3001';

export const CATEGORIES = [
  { id: 'general',    label: 'General'    },
  { id: 'writing',    label: 'Writing'    },
  { id: 'code',       label: 'Code'       },
  { id: 'analysis',   label: 'Analysis'   },
  { id: 'brainstorm', label: 'Brainstorm' },
];

export const FOLLOWUP_PRESETS = [
  { id: 'shorter',  label: 'Shorter',      feedback: 'Make this significantly shorter and more direct, keeping only the most essential parts.' },
  { id: 'formal',   label: 'More formal',  feedback: 'Adjust the tone to be more formal and professional.' },
  { id: 'simpler',  label: 'Simpler',      feedback: 'Simplify the language. Use plainer words and shorter sentences.' },
  { id: 'examples', label: 'Add examples', feedback: 'Add 1-2 concrete examples to illustrate what good output would look like.' },
];

export const SCORE_DIMENSIONS = [
  { id: 'specificity', label: 'Specificity', description: 'Concreteness and detail of the request.' },
  { id: 'audience',    label: 'Audience',    description: 'Who the response is for and what they need.' },
  { id: 'format',      label: 'Format',      description: 'Whether the desired output format is specified.' },
  { id: 'constraints', label: 'Constraints', description: 'Limits, exclusions, requirements stated.' },
  { id: 'examples',    label: 'Examples',    description: 'Examples provided or step-by-step reasoning requested.' },
];

export const STORAGE_HISTORY       = 'prompt-improver-history';
export const STORAGE_SETTINGS      = 'prompt-improver-settings';
export const STORAGE_SAVED         = 'prompt-improver-saved';
export const STORAGE_USAGE         = 'prompt-improver-usage';
export const STORAGE_CURRENT_CONVO = 'prompt-refina-current-convo';
export const STORAGE_CONVERSATIONS = 'prompt-refina-conversations';
export const STORAGE_FOLDERS       = 'prompt-refina-folders';
export const STORAGE_CHAIN         = 'prompt-refina-chain';
export const STORAGE_ANON_COUNT    = 'prompt-refina-anon-refinements';

// How many refinements a logged-out visitor may run PER DAY before being asked
// to sign in (a "try it" trial gate; resets at local midnight). Override with
// VITE_ANON_REFINEMENT_LIMIT; set very high to effectively disable. Only
// enforced when Supabase auth is configured — otherwise there's no way to sign
// in, so the app stays unlimited/anonymous.
export const ANON_REFINEMENT_LIMIT = Number(import.meta.env?.VITE_ANON_REFINEMENT_LIMIT) || 5;

export const MAX_HISTORY       = 20;
export const MAX_USAGE_RECORDS = 500;
export const MAX_CONVERSATIONS = 50;

export const DEFAULT_MODEL = 'claude-opus-4-8';

export const MODELS = [
  { id: 'claude-opus-4-8',           name: 'Claude Opus 4.8',   shortName: 'Opus 4.8',   provider: 'Anthropic', description: 'Most capable. Best for complex prompts.',          available: true, isDefault: true },
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6', shortName: 'Sonnet 4.6', provider: 'Anthropic', description: 'Balanced speed and capability.',                   available: true },
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',   shortName: 'Opus 4.6',   provider: 'Anthropic', description: 'Previous flagship. Still highly capable.',         available: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',  shortName: 'Haiku 4.5',  provider: 'Anthropic', description: 'Fastest and cheapest. Good for simple prompts.',  available: true },
  { id: 'gpt-4',        name: 'GPT-4',        shortName: 'GPT-4',        provider: 'OpenAI', description: 'Coming soon', available: false },
  { id: 'gpt-4-turbo',  name: 'GPT-4 Turbo',  shortName: 'GPT-4 Turbo',  provider: 'OpenAI', description: 'Coming soon', available: false },
  { id: 'gemini-pro',   name: 'Gemini Pro',   shortName: 'Gemini Pro',   provider: 'Google', description: 'Coming soon', available: false },
];

export const PRICING = {
  'claude-opus-4-8':           { input: 5.00, output: 25.00 },
  'claude-opus-4-6':           { input: 5.00, output: 25.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output:  5.00 },
};

export const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  darkMode: false,
  linterEnabled: true,
  piiScannerEnabled: true,
  testModel: DEFAULT_MODEL,
  voiceEnabled: true,
  customDimensions: [],
  removedDimensions: [],
  notionToken: '',
  notionDatabaseId: '',
  slackWebhookUrl: '',
  customInstructions: '',
  // '' = no target-model tailoring; otherwise a model id whose idioms the
  // refined prompt should be optimized for (see targetModelGuidance on server).
  targetModel: '',
};

// Destination presets for "optimize refined prompt for" — value is matched by
// prefix on the server (claude*/gpt*/gemini*).
export const TARGET_MODELS = [
  { id: '',           label: 'No preference' },
  { id: 'claude-opus-4-8', label: 'Claude (Anthropic)' },
  { id: 'gpt-4',      label: 'GPT (OpenAI)' },
  { id: 'gemini-pro', label: 'Gemini (Google)' },
];

// Languages offered by the "export as code" feature.
export const CODE_SNIPPET_LANGS = [
  { id: 'anthropic-python', label: 'Anthropic · Python' },
  { id: 'anthropic-node',   label: 'Anthropic · Node' },
  { id: 'openai-python',    label: 'OpenAI · Python' },
  { id: 'curl',             label: 'curl' },
];

export const QUICK_STARTS = [
  { label: 'Draft an email',     category: 'writing',    text: 'Write an email to my team about the new project timeline.' },
  { label: 'Review my code',     category: 'code',       text: 'Review this function and suggest improvements.' },
  { label: 'Explain a concept',  category: 'analysis',   text: 'Explain how transformer models work in simple terms.' },
  { label: 'Brainstorm ideas',   category: 'brainstorm', text: 'Give me 10 creative ideas for a landing page headline.' },
];
