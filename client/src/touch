// Prompt linter — runs in the browser, no API call, no model.
// Pure heuristic checks against the five scoring dimensions used by the
// refiner: specificity, audience, format, constraints, examples.
//
// Each check returns either null (no hint) or a hint object:
//   { id, severity, dimension, label, message }
//
// Severity is one of:
//   'critical'  — prompt is genuinely too short/vague to refine well
//   'warning'   — important dimension missing
//   'info'      — would help but prompt is usable as-is
//
// These thresholds are educated guesses. Tune them in this file only.

const HEDGE_WORDS = ['something', 'anything', 'stuff', 'things', 'somehow'];

const AUDIENCE_INDICATORS = [
  'audience', 'reader', 'readers', 'user', 'users', 'customer', 'customers',
  'team', 'teams', 'engineer', 'engineers', 'developer', 'developers',
  'designer', 'designers', 'manager', 'managers', 'executive', 'executives',
  'student', 'students', 'child', 'children', 'kid', 'kids',
  'expert', 'experts', 'beginner', 'beginners', 'novice', 'professional',
  'doctor', 'lawyer', 'investor', 'client', 'clients',
  'colleague', 'colleagues', 'employee', 'employees', 'boss', 'parent',
  // "for [someone]" pattern
  'for my', 'for our', 'for a', 'for an', 'for the',
];

const FORMAT_INDICATORS = [
  'list', 'lists', 'bullet', 'bullets', 'bulleted',
  'table', 'tables',
  'paragraph', 'paragraphs', 'essay', 'essays',
  'email', 'emails', 'letter', 'letters',
  'code', 'function', 'script', 'snippet', 'class',
  'summary', 'summaries', 'outline', 'outlines',
  'json', 'csv', 'xml', 'yaml', 'markdown',
  'report', 'reports', 'memo', 'memos',
  'tweet', 'post', 'blog', 'article', 'caption',
  'pitch', 'proposal', 'plan',
  'steps', 'step-by-step', 'numbered',
  'q&a', 'faq', 'questions',
];

const OUTPUT_REQUEST_VERBS = [
  'write', 'create', 'make', 'generate', 'produce', 'draft', 'compose',
  'design', 'build', 'develop', 'craft', 'prepare',
  'explain', 'describe', 'list', 'outline', 'summarize',
  'translate', 'rewrite', 'rephrase', 'edit', 'revise',
  'analyze', 'review', 'compare', 'evaluate',
  'recommend', 'suggest', 'propose', 'brainstorm',
];

const CONSTRAINT_INDICATORS = [
  'under', 'no more than', 'less than', 'exactly', 'between',
  'max', 'maximum', 'minimum', 'min', 'limit',
  'avoid', "don't", 'do not', 'without', 'not include', 'exclude',
  'must', 'should', 'cannot', "can't",
  'within', 'no longer than', 'at most', 'at least',
];

const EXAMPLE_INDICATORS = [
  'for example', 'for instance', 'such as', 'like this', 'like:',
  'e.g.', 'eg.', 'i.e.', 'ie.',
  'step by step', 'step-by-step',
  'think through', 'think step',
  'show your work', 'show me how',
];

const LENGTH_INDICATORS = [
  'word', 'words', 'sentence', 'sentences', 'paragraph', 'paragraphs',
  'short', 'long', 'brief', 'concise', 'detailed',
  'page', 'pages', 'character', 'characters',
];

// Quick helper: does the prompt contain any of these substrings,
// case-insensitive, as whole-word-ish matches?
function containsAny(prompt, indicators) {
  const lower = prompt.toLowerCase();
  return indicators.some((indicator) => {
    if (indicator.includes(' ')) {
      // Multi-word phrases — just check substring
      return lower.includes(indicator);
    }
    // Single word — match word boundaries (loose)
    const re = new RegExp(`\\b${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return re.test(lower);
  });
}

function wordCount(prompt) {
  return prompt.trim().split(/\s+/).filter(Boolean).length;
}

// Naive: a "concrete noun" is any word over 4 letters that isn't a hedge,
// pronoun, common verb, etc. Imperfect but catches "help me write
// something" (no concrete nouns) vs "draft an email to my landlord about
// the broken radiator" (concrete nouns: email, landlord, radiator).
const FUNCTION_WORDS = new Set([
  'about', 'above', 'after', 'against', 'along', 'among', 'around', 'before',
  'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during',
  'except', 'inside', 'outside', 'through', 'toward', 'towards', 'under',
  'until', 'within', 'without',
  'which', 'where', 'whether', 'while', 'would', 'could', 'should',
  'their', 'there', 'these', 'those', 'this', 'that',
  'have', 'having', 'been', 'being', 'were',
  'something', 'anything', 'nothing', 'everything', 'stuff', 'things',
  'really', 'maybe', 'kind',
]);

function hasConcreteNouns(prompt) {
  const words = prompt.toLowerCase().match(/[a-z]{5,}/g) || [];
  return words.some((word) => !FUNCTION_WORDS.has(word));
}

// ── Individual checks ──────────────────────────────────────

function checkTooShort(prompt) {
  const words = wordCount(prompt);
  if (words < 8 && words > 0) {
    return {
      id: 'too-short',
      severity: 'critical',
      dimension: 'specificity',
      label: 'Very short prompt',
      message: 'Add more detail — what exactly do you want, and for whom?',
    };
  }
  return null;
}

function checkNoConcreteNouns(prompt) {
  const words = wordCount(prompt);
  if (words >= 8 && words < 25 && !hasConcreteNouns(prompt)) {
    return {
      id: 'no-concrete-nouns',
      severity: 'warning',
      dimension: 'specificity',
      label: 'Vague request',
      message: 'Mention specific things, people, or contexts. "Help me write something" is too generic.',
    };
  }
  return null;
}

function checkHedgeWords(prompt) {
  const lower = prompt.toLowerCase();
  const found = HEDGE_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower));
  if (found.length > 0 && wordCount(prompt) >= 8) {
    return {
      id: 'hedge-words',
      severity: 'info',
      dimension: 'specificity',
      label: `Vague word: "${found[0]}"`,
      message: `Replace "${found[0]}" with something specific. The refiner will guess otherwise.`,
    };
  }
  return null;
}

function checkNoAudience(prompt) {
  const words = wordCount(prompt);
  if (words >= 15 && !containsAny(prompt, AUDIENCE_INDICATORS)) {
    return {
      id: 'no-audience',
      severity: 'warning',
      dimension: 'audience',
      label: 'No audience mentioned',
      message: 'Who is this for? A senior engineer, a customer, a child? The tone depends on it.',
    };
  }
  return null;
}

function checkNoFormat(prompt) {
  const words = wordCount(prompt);
  const asksForOutput = containsAny(prompt, OUTPUT_REQUEST_VERBS);
  const hasFormat = containsAny(prompt, FORMAT_INDICATORS);
  if (words >= 10 && asksForOutput && !hasFormat) {
    return {
      id: 'no-format',
      severity: 'warning',
      dimension: 'format',
      label: 'No format specified',
      message: 'Email? Bullet list? Paragraph? Code? Saying so up front prevents wrong-shape output.',
    };
  }
  return null;
}

function checkNoLength(prompt) {
  const words = wordCount(prompt);
  const asksForOutput = containsAny(prompt, OUTPUT_REQUEST_VERBS);
  const hasLength = containsAny(prompt, LENGTH_INDICATORS);
  if (words >= 12 && asksForOutput && !hasLength) {
    return {
      id: 'no-length',
      severity: 'info',
      dimension: 'format',
      label: 'No length specified',
      message: '"Short," "200 words," "one paragraph" — a length hint helps a lot.',
    };
  }
  return null;
}

function checkNoConstraints(prompt) {
  const words = wordCount(prompt);
  if (words >= 25 && !containsAny(prompt, CONSTRAINT_INDICATORS)) {
    return {
      id: 'no-constraints',
      severity: 'info',
      dimension: 'constraints',
      label: 'No constraints',
      message: 'What should it avoid? Any limits on length, tone, topics? Constraints sharpen output.',
    };
  }
  return null;
}

function checkNoExamples(prompt) {
  const words = wordCount(prompt);
  if (words >= 40 && !containsAny(prompt, EXAMPLE_INDICATORS)) {
    return {
      id: 'no-examples',
      severity: 'info',
      dimension: 'examples',
      label: 'No examples or reasoning',
      message: 'Add an example of good output, or ask the model to think step by step.',
    };
  }
  return null;
}

// ── Main entry point ───────────────────────────────────────

export function lintPrompt(prompt) {
  if (!prompt || !prompt.trim()) return [];

  const checks = [
    checkTooShort,
    checkNoConcreteNouns,
    checkHedgeWords,
    checkNoAudience,
    checkNoFormat,
    checkNoLength,
    checkNoConstraints,
    checkNoExamples,
  ];

  const hints = checks.map((check) => check(prompt)).filter(Boolean);

  // Sort by severity: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  hints.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return hints;
}

// Returns a one-line summary like "3 hints" or "Looks good" — used in
// the collapsed state of the hints panel.
export function lintSummary(hints) {
  if (hints.length === 0) return null;
  const critical = hints.filter((h) => h.severity === 'critical').length;
  const warning = hints.filter((h) => h.severity === 'warning').length;
  const info = hints.filter((h) => h.severity === 'info').length;

  const parts = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (warning > 0) parts.push(`${warning} ${warning === 1 ? 'warning' : 'warnings'}`);
  if (info > 0) parts.push(`${info} ${info === 1 ? 'tip' : 'tips'}`);
  return parts.join(' · ');
}
