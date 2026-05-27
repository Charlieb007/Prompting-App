// Export and import handlers for Prompt Refina history and saved prompts.
// Supports three formats: Markdown (.md), JSON (.json), CSV (.csv).
// JSON is the only lossless format; Markdown is human-readable; CSV is
// flattened for spreadsheets and loses nested data like comparisons.

// ── Helpers ─────────────────────────────────────────────────

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function averageOfScores(scoreSet) {
  if (!scoreSet) return null;
  const dimensions = ['specificity', 'audience', 'format', 'constraints', 'examples'];
  const values = dimensions
    .map((d) => scoreSet[d]?.score)
    .filter((s) => typeof s === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// CSV field escaping per RFC 4180: wrap in quotes if it contains comma, quote,
// or newline; double up any internal quotes.
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── Markdown export ─────────────────────────────────────────

function entryToMarkdown(entry, kind) {
  const lines = [];
  const isHistory = kind === 'history';
  const ts = entry.timestamp || entry.savedAt;
  const dateStr = ts ? new Date(ts).toISOString() : 'unknown date';
  const title = entry.name || entry.rough?.slice(0, 80) || 'Untitled prompt';

  lines.push(`## ${title}`);
  lines.push('');
  lines.push(`- **Category:** ${entry.category || 'general'}`);
  lines.push(`- **Model:** ${entry.model || 'unknown'}`);
  lines.push(`- **${isHistory ? 'Recorded' : 'Saved'}:** ${dateStr}`);
  if (entry.isFollowUp) lines.push(`- **Type:** Follow-up refinement`);
  if (entry.feedback) lines.push(`- **Feedback applied:** ${entry.feedback}`);
  lines.push('');
  lines.push('### Original (rough) prompt');
  lines.push('');
  lines.push('```');
  lines.push(entry.rough || '');
  lines.push('```');
  lines.push('');
  lines.push('### Refined prompt');
  lines.push('');
  lines.push('```');
  lines.push(entry.improved || '');
  lines.push('```');
  lines.push('');

  if (entry.changes && entry.changes.length > 0) {
    lines.push('### What changed');
    lines.push('');
    entry.changes.forEach((c, i) => {
      lines.push(`${i + 1}. **${c.title}** — ${c.explanation}`);
    });
    lines.push('');
  }

  if (entry.scores) {
    const roughAvg = averageOfScores(entry.scores.rough);
    const refinedAvg = averageOfScores(entry.scores.refined);
    lines.push('### Quality scores');
    lines.push('');
    if (roughAvg !== null) lines.push(`- Rough prompt overall: **${roughAvg.toFixed(1)} / 5**`);
    if (refinedAvg !== null) lines.push(`- Refined prompt overall: **${refinedAvg.toFixed(1)} / 5**`);
    if (roughAvg !== null && refinedAvg !== null) {
      lines.push(`- Lift: **+${(refinedAvg - roughAvg).toFixed(1)}**`);
    }
    lines.push('');

    if (entry.scores.refined) {
      lines.push('Per-dimension scores (rough → refined):');
      lines.push('');
      const dimensions = [
        ['specificity', 'Specificity'],
        ['audience', 'Audience'],
        ['format', 'Format'],
        ['constraints', 'Constraints'],
        ['examples', 'Examples'],
      ];
      dimensions.forEach(([id, label]) => {
        const rough = entry.scores.rough?.[id];
        const refined = entry.scores.refined[id];
        if (!refined) return;
        const roughVal = rough?.score ?? '?';
        const refinedVal = refined.score;
        lines.push(`- **${label}:** ${roughVal} → ${refinedVal} — _${refined.rationale}_`);
      });
      lines.push('');
    }
  }

  if (entry.comparison?.columns?.length > 0) {
    lines.push('### Cross-model comparison');
    lines.push('');
    entry.comparison.columns.forEach((col) => {
      lines.push(`#### ${col.modelId}`);
      lines.push('');
      lines.push('```');
      lines.push(col.refined || '');
      lines.push('```');
      lines.push('');
      const avg = averageOfScores(col.scores?.refined);
      if (avg !== null) lines.push(`Score: **${avg.toFixed(1)} / 5**`);
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

export function exportMarkdown(history, saved) {
  const lines = [];
  lines.push(`# Prompt Refina Export`);
  lines.push('');
  lines.push(`Exported on ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- History entries: ${history.length}`);
  lines.push(`- Saved prompts: ${saved.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (saved.length > 0) {
    lines.push(`# Saved prompts`);
    lines.push('');
    saved.forEach((entry) => {
      lines.push(entryToMarkdown(entry, 'saved'));
    });
  }

  if (history.length > 0) {
    lines.push(`# History`);
    lines.push('');
    history.forEach((entry) => {
      lines.push(entryToMarkdown(entry, 'history'));
    });
  }

  downloadFile(
    `prompt-refina-export-${todayStamp()}.md`,
    lines.join('\n'),
    'text/markdown;charset=utf-8'
  );
}

// ── JSON export ─────────────────────────────────────────────

export function exportJSON(history, saved) {
  // The JSON payload version tag lets future Import logic detect format
  // versions and migrate if needed.
  const payload = {
    format: 'prompt-refina-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    history,
    saved,
  };
  downloadFile(
    `prompt-refina-export-${todayStamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8'
  );
}

// ── CSV export ──────────────────────────────────────────────

export function exportCSV(history, saved) {
  // CSV is intentionally flat. Nested data (changes array, scores rationales,
  // comparison columns) is dropped. Use JSON for a lossless export.
  const headers = [
    'source',
    'timestamp_iso',
    'category',
    'model',
    'is_follow_up',
    'feedback',
    'rough_prompt',
    'refined_prompt',
    'rough_score_avg',
    'refined_score_avg',
    'lift',
    'name',
  ];

  const rows = [headers.map(csvEscape).join(',')];

  function rowFor(entry, source) {
    const ts = entry.timestamp || entry.savedAt;
    const tsIso = ts ? new Date(ts).toISOString() : '';
    const roughAvg = averageOfScores(entry.scores?.rough);
    const refinedAvg = averageOfScores(entry.scores?.refined);
    const lift = roughAvg !== null && refinedAvg !== null ? (refinedAvg - roughAvg).toFixed(2) : '';
    return [
      source,
      tsIso,
      entry.category || '',
      entry.model || '',
      entry.isFollowUp ? 'true' : 'false',
      entry.feedback || '',
      entry.rough || '',
      entry.improved || '',
      roughAvg !== null ? roughAvg.toFixed(2) : '',
      refinedAvg !== null ? refinedAvg.toFixed(2) : '',
      lift,
      entry.name || '',
    ].map(csvEscape).join(',');
  }

  saved.forEach((entry) => rows.push(rowFor(entry, 'saved')));
  history.forEach((entry) => rows.push(rowFor(entry, 'history')));

  downloadFile(
    `prompt-refina-export-${todayStamp()}.csv`,
    rows.join('\n'),
    'text/csv;charset=utf-8'
  );
}

// ── Import: parsers and validators ──────────────────────────

// Minimal field validator: every imported entry must have at least
// rough and improved text. Everything else is optional.
function isValidEntry(entry) {
  return (
    entry &&
    typeof entry === 'object' &&
    typeof entry.rough === 'string' &&
    entry.rough.trim().length > 0 &&
    typeof entry.improved === 'string' &&
    entry.improved.trim().length > 0
  );
}

// Normalize a raw entry into the app's canonical shape.
// Missing fields are filled with sensible defaults.
function normalizeEntry(raw, kind) {
  const base = {
    rough: String(raw.rough).trim(),
    improved: String(raw.improved).trim(),
    category: raw.category || 'general',
    model: raw.model || 'claude-sonnet-4-6',
    changes: Array.isArray(raw.changes) ? raw.changes : [],
    scores: raw.scores && typeof raw.scores === 'object' ? raw.scores : null,
    comparison: raw.comparison && typeof raw.comparison === 'object' ? raw.comparison : null,
    isFollowUp: Boolean(raw.isFollowUp),
    feedback: raw.feedback || undefined,
    imported: true,
  };

  if (kind === 'history') {
    return {
      ...base,
      timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    };
  } else {
    // saved
    return {
      ...base,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: raw.name || '',
      savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
    };
  }
}

// Detect duplicates: same rough text + same improved text + same model.
// If a match exists in the destination array, skip this entry.
function isDuplicate(entry, destination) {
  return destination.some(
    (existing) =>
      existing.rough === entry.rough &&
      existing.improved === entry.improved &&
      existing.model === entry.model
  );
}

function parseJSONImport(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    throw new Error('The JSON file is not valid. Check it for syntax errors and try again.');
  }

  if (payload.format !== 'prompt-refina-export') {
    // Be permissive: if it has history/saved arrays, accept it anyway.
    if (!Array.isArray(payload.history) && !Array.isArray(payload.saved)) {
      throw new Error('This JSON file does not look like a Prompt Refina export.');
    }
  }

  const rawHistory = Array.isArray(payload.history) ? payload.history : [];
  const rawSaved = Array.isArray(payload.saved) ? payload.saved : [];

  return { rawHistory, rawSaved };
}

function parseCSVImport(text) {
  // Minimal RFC-4180-ish CSV parser. Handles quoted fields with embedded
  // commas, quotes, and newlines.
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush the last field/row if file didn't end with newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error('The CSV file is empty or has no data rows.');
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const requiredHeaders = ['rough_prompt', 'refined_prompt'];
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `The CSV file is missing required columns: ${missing.join(', ')}. Required columns are: rough_prompt, refined_prompt.`
    );
  }

  const idx = (name) => headers.indexOf(name);
  const rawHistory = [];
  const rawSaved = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0].trim() === '') continue; // skip blank lines

    const source = (cells[idx('source')] || 'history').toLowerCase();
    const entry = {
      rough: cells[idx('rough_prompt')] || '',
      improved: cells[idx('refined_prompt')] || '',
      category: cells[idx('category')] || 'general',
      model: cells[idx('model')] || 'claude-sonnet-4-6',
      isFollowUp: (cells[idx('is_follow_up')] || '').toLowerCase() === 'true',
      feedback: cells[idx('feedback')] || undefined,
      name: cells[idx('name')] || '',
    };
    const tsCell = cells[idx('timestamp_iso')];
    if (tsCell) {
      const parsed = Date.parse(tsCell);
      if (!isNaN(parsed)) {
        entry.timestamp = parsed;
        entry.savedAt = parsed;
      }
    }

    if (source === 'saved') rawSaved.push(entry);
    else rawHistory.push(entry);
  }

  return { rawHistory, rawSaved };
}

function parseMarkdownImport(text) {
  // Markdown import recovers the rough + refined text for each entry.
  // Comparison data and detailed score rationales are NOT recovered from
  // Markdown (that information is in prose form and not reliably parseable).
  // For full-fidelity round-tripping, use JSON.
  const rawHistory = [];
  const rawSaved = [];
  let currentSection = 'history';

  // Find entries by their "## " heading at column 0.
  const lines = text.split(/\r?\n/);

  // Detect which section (saved / history) we're in via top-level headings.
  let i = 0;
  let pendingEntry = null;
  let pendingMode = null; // 'rough' | 'refined' | null
  let codeBuffer = [];
  let inCode = false;

  function flushPending() {
    if (pendingEntry && pendingEntry.rough && pendingEntry.improved) {
      if (currentSection === 'saved') rawSaved.push(pendingEntry);
      else rawHistory.push(pendingEntry);
    }
    pendingEntry = null;
    pendingMode = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Track section
    if (/^#\s+Saved prompts\s*$/i.test(line)) {
      flushPending();
      currentSection = 'saved';
      i++;
      continue;
    }
    if (/^#\s+History\s*$/i.test(line)) {
      flushPending();
      currentSection = 'history';
      i++;
      continue;
    }

    // New entry
    if (/^##\s+/.test(line)) {
      flushPending();
      pendingEntry = { rough: '', improved: '', category: 'general', model: 'claude-sonnet-4-6' };
      pendingMode = null;
      i++;
      continue;
    }

    if (!pendingEntry) {
      i++;
      continue;
    }

    // Metadata bullets like "- **Category:** writing"
    const metaMatch = line.match(/^-\s+\*\*([^*]+):\*\*\s+(.+)$/);
    if (metaMatch) {
      const key = metaMatch[1].trim().toLowerCase();
      const value = metaMatch[2].trim();
      if (key === 'category') pendingEntry.category = value;
      else if (key === 'model') pendingEntry.model = value;
      else if (key === 'feedback applied') pendingEntry.feedback = value;
      else if (key === 'type' && /follow-up/i.test(value)) pendingEntry.isFollowUp = true;
      i++;
      continue;
    }

    // Sub-headings tell us which block follows
    if (/^###\s+Original \(rough\) prompt\s*$/i.test(line)) {
      pendingMode = 'rough';
      i++;
      continue;
    }
    if (/^###\s+Refined prompt\s*$/i.test(line)) {
      pendingMode = 'refined';
      i++;
      continue;
    }
    if (/^###\s+/.test(line)) {
      // Any other ### section ends rough/refined capture
      pendingMode = null;
      i++;
      continue;
    }

    // Code fences carry the actual prompt text
    if (line.trim() === '```') {
      if (inCode) {
        inCode = false;
        if (pendingMode === 'rough') pendingEntry.rough = codeBuffer.join('\n').trim();
        else if (pendingMode === 'refined') pendingEntry.improved = codeBuffer.join('\n').trim();
        codeBuffer = [];
      } else {
        inCode = true;
        codeBuffer = [];
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      i++;
      continue;
    }

    i++;
  }

  flushPending();
  return { rawHistory, rawSaved };
}

// Detect format from filename extension or content sniffing.
function detectFormat(filename, text) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  // Content sniffing fallback
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('#')) return 'markdown';
  return 'csv'; // default guess
}

// Main entry point for import. Returns a summary the UI can display.
// Throws on hard parse errors (caller should catch and show inline error).
export function importFile(filename, text, existingHistory, existingSaved) {
  const format = detectFormat(filename, text);

  let parsed;
  if (format === 'json') parsed = parseJSONImport(text);
  else if (format === 'csv') parsed = parseCSVImport(text);
  else if (format === 'markdown') parsed = parseMarkdownImport(text);
  else throw new Error(`Unsupported file format: ${format}`);

  const { rawHistory, rawSaved } = parsed;

  // Validate and normalize
  let invalidCount = 0;
  const validHistory = [];
  const validSaved = [];

  for (const raw of rawHistory) {
    if (isValidEntry(raw)) validHistory.push(normalizeEntry(raw, 'history'));
    else invalidCount++;
  }
  for (const raw of rawSaved) {
    if (isValidEntry(raw)) validSaved.push(normalizeEntry(raw, 'saved'));
    else invalidCount++;
  }

  // Merge: skip duplicates against existing data.
  let duplicateCount = 0;
  const mergedHistory = [];
  const mergedSaved = [];

  for (const entry of validHistory) {
    if (isDuplicate(entry, existingHistory) || isDuplicate(entry, mergedHistory)) {
      duplicateCount++;
    } else {
      mergedHistory.push(entry);
    }
  }
  for (const entry of validSaved) {
    if (isDuplicate(entry, existingSaved) || isDuplicate(entry, mergedSaved)) {
      duplicateCount++;
    } else {
      mergedSaved.push(entry);
    }
  }

  return {
    format,
    importedHistory: mergedHistory,
    importedSaved: mergedSaved,
    invalidCount,
    duplicateCount,
    totalImported: mergedHistory.length + mergedSaved.length,
  };
}
