/**
 * Pure utility functions for Prompt Refinery.
 * No React, no side-effects.
 */

import { MODELS, PRICING, SCORE_DIMENSIONS } from './constants.js';

export function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Average score across all built-in SCORE_DIMENSIONS (or a custom subset by ids). */
export function averageScore(scoreSet, dimensionIds) {
  if (!scoreSet) return null;
  const ids = dimensionIds || SCORE_DIMENSIONS.map(d => d.id);
  const vals = ids.map(id => scoreSet[id]?.score).filter(v => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function modelShortName(modelId) {
  return MODELS.find(m => m.id === modelId)?.shortName ?? modelId;
}

export function computeCost(modelId, usage) {
  const rates = PRICING[modelId];
  if (!rates || !usage) return null;
  return (usage.inputTokens / 1_000_000) * rates.input +
         (usage.outputTokens / 1_000_000) * rates.output;
}

export function formatCost(usd) {
  if (usd === null || usd === undefined) return '';
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(3)}`;
}

export function formatLatency(ms) {
  if (!ms) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function defaultPDFFilename() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `prompt-refinery-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.pdf`;
}

export function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'prompt-refinery';
}

export function extractVariables(text) {
  const matches = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = m[1].trim();
    if (!matches.includes(v)) matches.push(v);
  }
  return matches;
}

export function fillVariables(text, values) {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, name) => {
    const key = name.trim();
    return values[key] !== undefined ? values[key] : `{{${name}}}`;
  });
}

/**
 * Compute a word-level diff between two strings.
 * Returns [{type: 'equal'|'delete'|'insert', text}].
 * Pure LCS algorithm, no external deps.
 */
export function computeWordDiff(oldText, newText) {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const m = oldWords.length;
  const n = newWords.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'equal', text: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'insert', text: newWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'delete', text: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type tokens
  const merged = [];
  for (const token of result) {
    if (merged.length > 0 && merged[merged.length - 1].type === token.type) {
      merged[merged.length - 1].text += token.text;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}

export function buildShareMarkdown(rough, improved, changes) {
  let md = `# Refined Prompt\n\n`;
  md += `**Original:**\n\n${rough}\n\n`;
  md += `**Refined:**\n\n${improved}\n\n`;
  if (changes && changes.length > 0) {
    md += `## What Changed\n\n`;
    for (const c of changes) {
      md += `**${c.title}** — ${c.explanation}\n\n`;
    }
  }
  return md;
}
