// PII scanner — runs in the browser, no API call.
// Looks at a rough prompt string and returns an array of findings.
//
// A finding has shape:
//   { id, category, severity, label, snippet, position }
//
// category: 'credentials' | 'financial' | 'contact'
// severity: 'critical' | 'warning' | 'info'
//
// All scanning happens locally. The flagged values never leave the browser
// unless the user confirms refinement. False positives are the worst failure
// mode of this feature, so all patterns below err on the conservative side.

// ── Helpers ────────────────────────────────────────────────

// Luhn check: cuts ~90% of false-positive credit card matches.
// Real card numbers pass this; random 16-digit strings almost never do.
function luhnValid(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// Truncate a snippet for display so we never echo back more than ~40 chars
// of potentially-sensitive content in the UI.
function truncateSnippet(text, maxLen = 40) {
  if (text.length <= maxLen) return text;
  const half = Math.floor((maxLen - 3) / 2);
  return text.slice(0, half) + '...' + text.slice(text.length - half);
}

// ── Pattern definitions ───────────────────────────────────

// API keys & secrets. Conservative — requires specific prefixes that almost
// never appear in normal prose.
const KEY_PATTERNS = [
  {
    id: 'openai-key',
    regex: /\bsk-[a-zA-Z0-9-_]{20,}\b/g,
    label: 'OpenAI-style API key',
  },
  {
    id: 'anthropic-key',
    regex: /\bsk-ant-[a-zA-Z0-9-_]{20,}\b/g,
    label: 'Anthropic API key',
  },
  {
    id: 'github-pat',
    regex: /\bghp_[a-zA-Z0-9]{30,}\b/g,
    label: 'GitHub personal access token',
  },
  {
    id: 'github-oauth',
    regex: /\bgho_[a-zA-Z0-9]{30,}\b/g,
    label: 'GitHub OAuth token',
  },
  {
    id: 'slack-bot',
    regex: /\bxox[bpsa]-[a-zA-Z0-9-]{20,}\b/g,
    label: 'Slack token',
  },
  {
    id: 'aws-access',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    label: 'AWS access key ID',
  },
  {
    id: 'generic-secret-context',
    // Match "secret/password/token = something-long" where the value is
    // 16+ chars of high-entropy-looking content.
    regex: /\b(?:secret|password|token|api[_-]?key|auth)\s*[:=]\s*["']?([a-zA-Z0-9_\-+/=]{16,})\b/gi,
    label: 'Possible secret in key=value form',
  },
];

function findCredentials(text) {
  const findings = [];
  for (const pattern of KEY_PATTERNS) {
    let match;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      findings.push({
        id: `${pattern.id}-${match.index}`,
        category: 'credentials',
        severity: 'critical',
        label: pattern.label,
        snippet: truncateSnippet(match[0]),
        position: match.index,
      });
    }
  }
  return findings;
}

// Credit cards. Find 13-19 digit sequences with optional spaces/dashes,
// then validate with Luhn before flagging.
function findCreditCards(text) {
  const findings = [];
  const regex = /\b(?:\d[ -]?){13,19}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const digits = match[0].replace(/[ -]/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    if (!luhnValid(digits)) continue;
    findings.push({
      id: `cc-${match.index}`,
      category: 'financial',
      severity: 'critical',
      label: 'Credit card number',
      snippet: truncateSnippet(match[0]),
      position: match.index,
    });
  }
  return findings;
}

// US Social Security Number. Pattern: XXX-XX-XXXX with exclusions for
// known-invalid ranges (000-XX-XXXX, 666-XX-XXXX, 9XX-XX-XXXX).
function findSSN(text) {
  const findings = [];
  const regex = /\b(\d{3})-(\d{2})-(\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const area = match[1];
    const group = match[2];
    const serial = match[3];
    if (area === '000' || area === '666' || area.startsWith('9')) continue;
    if (group === '00' || serial === '0000') continue;
    findings.push({
      id: `ssn-${match.index}`,
      category: 'financial',
      severity: 'critical',
      label: 'US Social Security Number',
      snippet: truncateSnippet(match[0]),
      position: match.index,
    });
  }
  return findings;
}

// IBAN. 2 letters (country) + 2 digits (check) + 11-30 alphanumeric.
function findIBAN(text) {
  const findings = [];
  const regex = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    findings.push({
      id: `iban-${match.index}`,
      category: 'financial',
      severity: 'critical',
      label: 'IBAN (bank account)',
      snippet: truncateSnippet(match[0]),
      position: match.index,
    });
  }
  return findings;
}

// Email addresses. Conservative real-world pattern.
function findEmails(text) {
  const findings = [];
  const regex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    findings.push({
      id: `email-${match.index}`,
      category: 'contact',
      severity: 'warning',
      label: 'Email address',
      snippet: truncateSnippet(match[0]),
      position: match.index,
    });
  }
  return findings;
}

// Phone numbers. Patterns we want to catch (conservative):
//   +256 700 123 456  (international with space)
//   +256700123456     (international compact)
//   +1 (415) 555-1234 (US international)
//   (415) 555-1234    (US domestic)
//   415-555-1234      (US dashed)
//   +44 20 7946 0958  (UK)
// Patterns we explicitly do NOT want to flag:
//   "in the last 24 hours" - just digits with words
//   "5 things to do"       - small numbers
//   "$1,234.56"            - prices
//   "page 123"             - reference numbers
function findPhones(text) {
  const findings = [];
  // International with + prefix: requires 8+ digits total after the +
  const intlRegex = /(?<![\w@])\+\d{1,3}[\s.()-]*\d{2,4}[\s.()-]*\d{2,4}[\s.()-]*\d{2,4}(?:[\s.()-]*\d{1,4})?(?!\w)/g;
  // US format: (XXX) XXX-XXXX or XXX-XXX-XXXX
  const usRegex = /(?<![\w-])\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g;

  function tryAdd(match, kind) {
    const raw = match[0];
    const digitsOnly = raw.replace(/\D/g, '');
    // Require at least 8 digits to avoid catching short number patterns
    if (digitsOnly.length < 8) return;
    findings.push({
      id: `phone-${kind}-${match.index}`,
      category: 'contact',
      severity: 'warning',
      label: 'Phone number',
      snippet: truncateSnippet(raw.trim()),
      position: match.index,
    });
  }

  let match;
  while ((match = intlRegex.exec(text)) !== null) tryAdd(match, 'intl');
  while ((match = usRegex.exec(text)) !== null) tryAdd(match, 'us');

  return findings;
}

// Street addresses. Conservative pattern: number followed by Street/Ave/etc.
// Will miss many real addresses but rarely false-positives.
function findStreetAddresses(text) {
  const findings = [];
  const regex = /\b\d{1,5}\s+[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Boulevard|Blvd|Drive|Dr|Way|Place|Pl|Court|Ct)\b\.?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    findings.push({
      id: `addr-${match.index}`,
      category: 'contact',
      severity: 'warning',
      label: 'Street address',
      snippet: truncateSnippet(match[0]),
      position: match.index,
    });
  }
  return findings;
}

// ── Main entry point ──────────────────────────────────────

export function scanForPII(text) {
  if (!text || !text.trim()) return [];

  const findings = [
    ...findCredentials(text),
    ...findCreditCards(text),
    ...findSSN(text),
    ...findIBAN(text),
    ...findEmails(text),
    ...findPhones(text),
    ...findStreetAddresses(text),
  ];

  // De-duplicate: if two patterns matched the same span (e.g. an email and a
  // street address overlapping), keep the more-severe one.
  const seen = new Map();
  const severityRank = { critical: 0, warning: 1, info: 2 };
  for (const f of findings) {
    const key = `${f.position}-${f.snippet}`;
    const existing = seen.get(key);
    if (!existing || severityRank[f.severity] < severityRank[existing.severity]) {
      seen.set(key, f);
    }
  }

  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => {
    const sevDiff = severityRank[a.severity] - severityRank[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.position - b.position;
  });

  return deduped;
}

// Quick boolean: should we show the confirmation modal at all?
export function hasCriticalFindings(findings) {
  return findings.some((f) => f.severity === 'critical');
}

// Group findings by category for the modal UI.
export function groupFindings(findings) {
  const groups = {
    credentials: [],
    financial: [],
    contact: [],
  };
  for (const f of findings) {
    if (groups[f.category]) groups[f.category].push(f);
  }
  return groups;
}

export const CATEGORY_META = {
  credentials: {
    label: 'API keys & secrets',
    icon: 'key',
    description: 'These should never be sent to any AI service.',
  },
  financial: {
    label: 'Financial information',
    icon: 'card',
    description: 'Card numbers, SSNs, and bank details are extremely sensitive.',
  },
  contact: {
    label: 'Contact information',
    icon: 'contact',
    description: 'Real names, phone numbers, emails, and addresses of real people.',
  },
};
