import { useState, useEffect, useRef, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';
import { HELP_CONTENT } from './help-content.js';
import { TEMPLATES } from './templates-content.js';
import { exportMarkdown, exportJSON, exportCSV, importFile } from './io.js';
import { lintPrompt, lintSummary } from './lint.js';
import { scanForPII, hasCriticalFindings, groupFindings, CATEGORY_META } from './scan.js';
import { RunDrawer, autoTitle } from './RunDrawer.jsx';
import {
  SidebarIcon, HistoryIcon, TemplatesIcon, StarIcon, HelpIcon, SettingsIcon,
  UsageIcon, SendIcon, CheckIcon, SparkIcon, GaugeIcon, PencilIcon, TrashIcon,
  ArrowRightIcon, CompareIcon, ChevronDownIcon, DownloadIcon, UploadIcon,
  CloseIcon, ShieldIcon, KeyIcon, CardIcon, ContactIcon, PlayIcon, EyeIcon,
  MicIcon, MicOffIcon, PDFIcon, ExternalLinkIcon, PlayCircleIcon,
  ConversationsIcon, FunnelLogo,
  ChartIcon, ShareIcon, ChainIcon, FolderIcon, LoopIcon, ChevronUpIcon, PlusIcon,
} from './icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'writing', label: 'Writing' },
  { id: 'code', label: 'Code' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'brainstorm', label: 'Brainstorm' },
];

const FOLLOWUP_PRESETS = [
  { id: 'shorter', label: 'Shorter', feedback: 'Make this significantly shorter and more direct, keeping only the most essential parts.' },
  { id: 'formal', label: 'More formal', feedback: 'Adjust the tone to be more formal and professional.' },
  { id: 'simpler', label: 'Simpler', feedback: 'Simplify the language. Use plainer words and shorter sentences.' },
  { id: 'examples', label: 'Add examples', feedback: 'Add 1-2 concrete examples to illustrate what good output would look like.' },
];

const SCORE_DIMENSIONS = [
  { id: 'specificity', label: 'Specificity', description: 'Concreteness and detail of the request.' },
  { id: 'audience', label: 'Audience', description: 'Who the response is for and what they need.' },
  { id: 'format', label: 'Format', description: 'Whether the desired output format is specified.' },
  { id: 'constraints', label: 'Constraints', description: 'Limits, exclusions, requirements stated.' },
  { id: 'examples', label: 'Examples', description: 'Examples provided or step-by-step reasoning requested.' },
];

const STORAGE_HISTORY = 'prompt-improver-history';
const STORAGE_SETTINGS = 'prompt-improver-settings';
const STORAGE_SAVED = 'prompt-improver-saved';
const STORAGE_USAGE = 'prompt-improver-usage';
const STORAGE_CURRENT_CONVO = 'prompt-refinery-current-convo';
const STORAGE_CONVERSATIONS = 'prompt-refinery-conversations';
const STORAGE_FOLDERS = 'prompt-refinery-folders';
const STORAGE_CHAIN = 'prompt-refinery-chain';
const MAX_HISTORY = 20;
const MAX_USAGE_RECORDS = 500;
const MAX_CONVERSATIONS = 50;

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const MODELS = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', shortName: 'Opus 4.7', provider: 'Anthropic', description: 'Most capable. Best for complex prompts.', available: true },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', shortName: 'Sonnet 4.6', provider: 'Anthropic', description: 'Balanced speed and capability.', available: true, isDefault: true },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', shortName: 'Opus 4.6', provider: 'Anthropic', description: 'Previous flagship. Still highly capable.', available: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', shortName: 'Haiku 4.5', provider: 'Anthropic', description: 'Fastest and cheapest. Good for simple prompts.', available: true },
  { id: 'gpt-4', name: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', description: 'Coming soon', available: false },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', shortName: 'GPT-4 Turbo', provider: 'OpenAI', description: 'Coming soon', available: false },
  { id: 'gemini-pro', name: 'Gemini Pro', shortName: 'Gemini Pro', provider: 'Google', description: 'Coming soon', available: false },
];

const PRICING = {
  'claude-opus-4-7':           { input: 5.00, output: 25.00 },
  'claude-opus-4-6':           { input: 5.00, output: 25.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output:  5.00 },
};

const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  linterEnabled: true,
  piiScannerEnabled: true,
  testModel: DEFAULT_MODEL,
  voiceEnabled: true,
  customDimensions: [],    // [{id, label, description}] — extra scoring dimensions
  removedDimensions: [],   // ids of built-in dimensions to hide
};

function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function averageScore(scoreSet, dimensionIds) {
  if (!scoreSet) return null;
  const ids = dimensionIds || SCORE_DIMENSIONS.map(d => d.id);
  const values = ids.map((id) => scoreSet[id]?.score).filter((s) => typeof s === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function modelShortName(modelId) {
  return MODELS.find((m) => m.id === modelId)?.shortName || modelId;
}

function computeCost(modelId, usage) {
  const rates = PRICING[modelId];
  if (!rates || !usage) return null;
  const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCost = (usage.outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

function formatCost(usd) {
  if (usd === null || usd === undefined) return null;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatLatency(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function defaultPDFFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `prompt-refinery-${stamp}`;
}

function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
  return cleaned || 'prompt-refinery-export';
}

// Extract {{variable}} placeholders from a prompt string.
// Returns an array of unique variable names in the order they appear.
function extractVariables(text) {
  const matches = [...text.matchAll(/\{\{([^}]+)\}\}/g)];
  const seen = new Set();
  return matches.map(m => m[1].trim()).filter(name => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

// Fill in {{variable}} placeholders with a map of {name: value}.
function fillVariables(text, values) {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, name) => values[name.trim()] ?? `{{${name}}}`);
}

// Left rail: Conversations slotted in just after History since it's another
// "things you've done" view. Order chosen to keep similar concepts together.
const LEFT_RAIL_ITEMS = [
  { id: 'history',       label: 'History',                icon: HistoryIcon },
  { id: 'conversations', label: 'Conversations',          icon: ConversationsIcon },
  { id: 'saved',         label: 'Saved prompts',          icon: StarIcon },
  { id: 'templates',     label: 'Templates',              icon: TemplatesIcon },
  { id: 'analytics',    label: 'Analytics',              icon: ChartIcon },
  { id: 'chain',         label: 'Prompt Chain',           icon: ChainIcon },
  { id: 'usage',         label: 'Usage & cost',           icon: UsageIcon },
  { id: 'help',          label: 'Help & Documentation',   icon: HelpIcon },
  { id: 'settings',      label: 'Settings',               icon: SettingsIcon },
];

function CategoryIcon({ category }) {
  if (category === 'credentials') return <KeyIcon />;
  if (category === 'financial') return <CardIcon />;
  if (category === 'contact') return <ContactIcon />;
  return <ShieldIcon />;
}

/* ── Skeleton placeholders ───────────────────────────────── */

function SkeletonBar({ width = '100%', height = 12, strong = false }) {
  return (
    <span
      className={`skeleton-bar ${strong ? 'skeleton-strong' : ''}`}
      style={{ width, height: `${height}px` }}
    />
  );
}

function ChangesSkeleton() {
  return (
    <div className="changes skeleton">
      <div className="changes-header">
        <span className="changes-icon"><SparkIcon /></span>
        <span className="changes-label">What changed</span>
        <span className="skeleton-pill" />
      </div>
      <div className="changes-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="changes-item">
            <span className="skeleton-circle" />
            <div className="changes-body skeleton-body-stack">
              <SkeletonBar width="60%" height={11} strong />
              <SkeletonBar width="92%" height={10} />
              <SkeletonBar width="78%" height={10} />
            </div>
          </div>
        ))}
      </div>
      <div className="skeleton-status">
        <span className="thinking-dots">
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
        </span>
        <span>Analyzing changes…</span>
      </div>
    </div>
  );
}

function ScoresSkeleton() {
  return (
    <div className="scores skeleton">
      <div className="scores-header">
        <span className="scores-icon"><GaugeIcon /></span>
        <span className="scores-label">Quality score</span>
        <span className="skeleton-pill skeleton-pill-wide" />
      </div>
      <div className="scores-charts">
        <div className="scores-chart-block">
          <div className="scores-chart-caption">
            <SkeletonBar width="80px" height={10} />
          </div>
          <div className="skeleton-radar" />
        </div>
        <div className="scores-chart-block">
          <div className="scores-chart-caption">
            <SkeletonBar width="80px" height={10} />
          </div>
          <div className="skeleton-radar" />
        </div>
      </div>
      <div className="scores-list">
        {SCORE_DIMENSIONS.map((d) => (
          <div key={d.id} className="scores-item">
            <div className="scores-item-head">
              <SkeletonBar width="100px" height={11} strong />
              <SkeletonBar width="60px" height={11} />
            </div>
            <SkeletonBar width="90%" height={9} />
          </div>
        ))}
      </div>
      <div className="skeleton-status">
        <span className="thinking-dots">
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
        </span>
        <span>Scoring quality…</span>
      </div>
    </div>
  );
}

function ComparisonColumnSkeleton({ modelId }) {
  return (
    <div className="compare-col compare-col-skeleton">
      <div className="compare-col-header">
        <span className="compare-col-model">{modelShortName(modelId)}</span>
        <span className="thinking-dots">
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
          <span className="thinking-dot"></span>
        </span>
      </div>
      <div className="compare-col-skeleton-body">
        <SkeletonBar width="95%" height={10} />
        <SkeletonBar width="88%" height={10} />
        <SkeletonBar width="92%" height={10} />
        <SkeletonBar width="70%" height={10} />
        <div className="skeleton-radar skeleton-radar-small" />
      </div>
    </div>
  );
}

/* ── Linter hints panel ──────────────────────────────────── */

function LintHintsPanel({ hints, dismissed, onDismiss }) {
  const visible = hints.filter((h) => !dismissed.includes(h.id));
  if (visible.length === 0) return null;

  return (
    <div className="lint-hints">
      <div className="lint-hints-header">
        <span className="lint-hints-summary">{lintSummary(visible)}</span>
        <span className="lint-hints-meta">{visible.length === 1 ? 'suggestion' : 'suggestions'}</span>
      </div>
      <ul className="lint-hints-list">
        {visible.map((hint) => (
          <li key={hint.id} className={`lint-hint lint-hint-${hint.severity}`}>
            <span className={`lint-hint-dot lint-hint-dot-${hint.severity}`} />
            <div className="lint-hint-body">
              <div className="lint-hint-label">{hint.label}</div>
              <div className="lint-hint-message">{hint.message}</div>
            </div>
            <button
              type="button"
              className="lint-hint-dismiss"
              onClick={() => onDismiss(hint.id)}
              aria-label="Dismiss this hint"
              title="Dismiss"
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── PII warning modal ───────────────────────────────────── */

function PIIWarningModal({ findings, onContinue, onCancel }) {
  const grouped = groupFindings(findings);
  const hasCritical = hasCriticalFindings(findings);

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onCancel();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal pii-modal" role="dialog" aria-modal="true" aria-labelledby="pii-title">
        <div className="modal-head pii-modal-head">
          <div className="pii-modal-head-icon">
            <ShieldIcon />
          </div>
          <div>
            <h2 id="pii-title">Personal information detected</h2>
            <p className="pii-modal-subtitle">
              Found in your prompt before sending to {modelShortName(DEFAULT_MODEL)}. Review what's flagged.
            </p>
          </div>
          <button
            className="modal-close"
            onClick={onCancel}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {Object.entries(grouped).map(([category, items]) => {
            if (items.length === 0) return null;
            const meta = CATEGORY_META[category];
            return (
              <section key={category} className={`pii-category pii-category-${category}`}>
                <div className="pii-category-header">
                  <span className="pii-category-icon">
                    <CategoryIcon category={category} />
                  </span>
                  <div className="pii-category-text">
                    <div className="pii-category-label">{meta.label}</div>
                    <div className="pii-category-desc">{meta.description}</div>
                  </div>
                  <span className="pii-category-count">{items.length}</span>
                </div>
                <ul className="pii-finding-list">
                  {items.map((f) => (
                    <li key={f.id} className={`pii-finding pii-finding-${f.severity}`}>
                      <span className="pii-finding-label">{f.label}</span>
                      <code className="pii-finding-snippet">{f.snippet}</code>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <div className="pii-modal-explainer">
            This check runs in your browser. Nothing has been sent yet. You can edit your prompt to remove these, or continue anyway if they're intentional.
          </div>
        </div>

        <div className="modal-foot pii-modal-foot">
          <button
            className="pii-modal-btn pii-modal-btn-secondary"
            onClick={onCancel}
          >
            Edit prompt
          </button>
          <button
            className={`pii-modal-btn ${hasCritical ? 'pii-modal-btn-warning' : 'pii-modal-btn-primary'}`}
            onClick={onContinue}
          >
            {hasCritical ? 'Send anyway' : 'Send as-is'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PDF Preview modal ──────────────────────────────────── */

const PDF_SECTIONS = [
  { id: 'rough',      label: 'Rough prompt' },
  { id: 'refined',    label: 'Refined prompt' },
  { id: 'changes',    label: 'What changed' },
  { id: 'scores',     label: 'Quality scores' },
  { id: 'abtest',     label: 'A/B test results' },
  { id: 'comparison', label: 'Model comparison' },
];

function PDFPreviewModal({
  roughPrompt, category, refinedPrompt, changes, scores,
  primaryModel, primaryUsage, primaryLatencyMs,
  abTest, testModel, comparison, scoresChartRef, onClose,
}) {
  const [filename, setFilename] = useState(defaultPDFFilename());
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [status, setStatus] = useState('generating');
  const [errorMsg, setErrorMsg] = useState('');

  const abTestPresent = Boolean(abTest && (abTest.refined?.complete || abTest.rough?.complete));
  const comparisonPresent = Boolean(comparison?.columns?.length);

  const [sections, setSections] = useState(() => ({
    rough: Boolean(roughPrompt),
    refined: Boolean(refinedPrompt),
    changes: Boolean(changes?.length),
    scores: Boolean(scores?.refined),
    abtest: abTestPresent,
    comparison: comparisonPresent,
  }));

  function toggleSection(id) {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const availableSections = useMemo(() => {
    const out = [];
    if (roughPrompt) out.push('rough');
    if (refinedPrompt) out.push('refined');
    if (changes?.length) out.push('changes');
    if (scores?.refined) out.push('scores');
    if (abTestPresent) out.push('abtest');
    if (comparisonPresent) out.push('comparison');
    return out;
  }, [roughPrompt, refinedPrompt, changes, scores, abTestPresent, comparisonPresent]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      generatePDF();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function generatePDF() {
    try {
      setStatus('generating');

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));

      let chartImageData = null;
      if (sections.scores && scoresChartRef?.current) {
        try {
          const canvas = await html2canvas(scoresChartRef.current, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
          });
          chartImageData = canvas.toDataURL('image/png');
        } catch (err) {
          console.warn('Chart rasterization failed, continuing without chart image:', err);
        }
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 54;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      function ensureSpace(needed) {
        if (y + needed > pageHeight - margin - 20) {
          addFooter();
          doc.addPage();
          y = margin;
        }
      }

      function addFooter() {
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated by Prompt Refinery`, margin, pageHeight - margin / 2);
        doc.text(`Page ${currentPage}`, pageWidth - margin, pageHeight - margin / 2, { align: 'right' });
      }

      function drawSectionHeader(label) {
        ensureSpace(40);
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin, y);
        y += 14;
      }

      function drawParagraphChunked(text, fontSize, color, italic = false) {
        doc.setFontSize(fontSize);
        doc.setTextColor(color);
        doc.setFont('helvetica', italic ? 'italic' : 'normal');
        const lines = doc.splitTextToSize(text || '(empty)', contentWidth);
        const lineHeight = fontSize + 3;
        let i = 0;
        while (i < lines.length) {
          const remaining = pageHeight - margin - 20 - y;
          const linesFit = Math.max(1, Math.floor(remaining / lineHeight));
          const chunk = lines.slice(i, i + linesFit);
          doc.text(chunk, margin, y);
          y += chunk.length * lineHeight;
          i += chunk.length;
          if (i < lines.length) {
            addFooter();
            doc.addPage();
            y = margin;
          }
        }
      }

      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.setFont('helvetica', 'normal');
      doc.text('PROMPT REFINERY', margin, y);
      const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
      y += 8;

      doc.setDrawColor(220);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 24;

      doc.setFontSize(20);
      doc.setTextColor(40);
      doc.setFont('helvetica', 'bold');
      doc.text('Refined Prompt', margin, y);
      y += 22;

      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.setFont('helvetica', 'normal');
      const metaParts = [
        `Model: ${modelShortName(primaryModel)}`,
        `Category: ${category}`,
      ];
      doc.text(metaParts.join('   •   '), margin, y);
      y += 24;

      if (sections.rough && roughPrompt) {
        drawSectionHeader('ROUGH PROMPT');
        drawParagraphChunked(roughPrompt, 10, 90, true);
        y += 14;
      }

      if (sections.refined && refinedPrompt) {
        drawSectionHeader('REFINED PROMPT');
        drawParagraphChunked(refinedPrompt, 11, 40, false);
        y += 14;
      }

      if (sections.changes && changes?.length > 0) {
        drawSectionHeader('WHAT CHANGED');

        changes.forEach((change, idx) => {
          const numStr = `${idx + 1}.`;
          const titleText = change.title || '';
          const explText = change.explanation || '';

          const titleLines = doc.splitTextToSize(titleText, contentWidth - 22);
          const explLines = doc.splitTextToSize(explText, contentWidth - 22);
          const blockHeight = titleLines.length * 13 + explLines.length * 12 + 14;
          ensureSpace(blockHeight);

          doc.setFontSize(10);
          doc.setTextColor(180, 100, 70);
          doc.setFont('helvetica', 'bold');
          doc.text(numStr, margin, y);

          doc.setTextColor(40);
          doc.setFont('helvetica', 'bold');
          doc.text(titleLines, margin + 18, y);
          y += titleLines.length * 13;

          doc.setFontSize(9.5);
          doc.setTextColor(90);
          doc.setFont('helvetica', 'normal');
          doc.text(explLines, margin + 18, y);
          y += explLines.length * 12 + 10;
        });
        y += 8;
      }

      if (sections.scores && scores?.refined) {
        drawSectionHeader('QUALITY SCORE');

        const roughAvg = averageScore(scores.rough);
        const refinedAvg = averageScore(scores.refined);
        const lift = (roughAvg !== null && refinedAvg !== null) ? refinedAvg - roughAvg : null;

        doc.setFontSize(11);
        doc.setTextColor(40);
        doc.setFont('helvetica', 'normal');
        let summary = '';
        if (roughAvg !== null) summary += `Rough: ${roughAvg.toFixed(1)}/5   →   `;
        summary += `Refined: ${refinedAvg.toFixed(1)}/5`;
        if (lift !== null && lift > 0) summary += `   (+${lift.toFixed(1)} lift)`;
        doc.text(summary, margin, y);
        y += 18;

        if (chartImageData) {
          const chartMaxHeight = 200;
          ensureSpace(chartMaxHeight + 10);
          try {
            doc.addImage(chartImageData, 'PNG', margin, y, contentWidth, chartMaxHeight, undefined, 'FAST');
            y += chartMaxHeight + 14;
          } catch (err) {
            console.warn('Chart embed failed:', err);
          }
        }

        SCORE_DIMENSIONS.forEach((d) => {
          const refined = scores.refined?.[d.id];
          const rough = scores.rough?.[d.id];
          if (!refined) return;

          const refScoreStr = `${refined.score}/5`;
          const roughScoreStr = rough?.score !== undefined ? `${rough.score} → ` : '';

          ensureSpace(34);
          doc.setFontSize(10);
          doc.setTextColor(40);
          doc.setFont('helvetica', 'bold');
          doc.text(d.label, margin, y);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120);
          doc.text(`${roughScoreStr}${refScoreStr}`, pageWidth - margin, y, { align: 'right' });
          y += 12;

          if (refined.rationale) {
            doc.setFontSize(9);
            doc.setTextColor(110);
            doc.setFont('helvetica', 'normal');
            const ratLines = doc.splitTextToSize(refined.rationale, contentWidth);
            ensureSpace(ratLines.length * 11 + 4);
            doc.text(ratLines, margin, y);
            y += ratLines.length * 11 + 6;
          }
        });
        y += 8;
      }

      if (sections.abtest && abTestPresent) {
        drawSectionHeader('A/B TEST RESULTS');

        doc.setFontSize(9.5);
        doc.setTextColor(110);
        doc.setFont('helvetica', 'italic');
        const testHeader = `Outputs from ${modelShortName(testModel)}. Comparing what the rough vs refined prompt actually produces.`;
        const testHeaderLines = doc.splitTextToSize(testHeader, contentWidth);
        doc.text(testHeaderLines, margin, y);
        y += testHeaderLines.length * 11 + 10;

        if (abTest.rough?.text) {
          ensureSpace(40);
          doc.setFontSize(10);
          doc.setTextColor(150);
          doc.setFont('helvetica', 'bold');
          doc.text('From rough prompt', margin, y);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(140);
          const roughCost = abTest.rough?.usage ? computeCost(testModel, abTest.rough.usage) : null;
          const roughMeta = [
            roughCost !== null ? formatCost(roughCost) : null,
            abTest.rough?.latencyMs ? formatLatency(abTest.rough.latencyMs) : null,
          ].filter(Boolean).join('   •   ');
          if (roughMeta) {
            doc.text(roughMeta, pageWidth - margin, y, { align: 'right' });
          }
          y += 14;

          drawParagraphChunked(abTest.rough.text, 10, 60, false);
          y += 16;
        }

        if (abTest.refined?.text) {
          ensureSpace(40);
          doc.setFontSize(10);
          doc.setTextColor(180, 100, 70);
          doc.setFont('helvetica', 'bold');
          doc.text('From refined prompt', margin, y);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(140);
          const refinedCost = abTest.refined?.usage ? computeCost(testModel, abTest.refined.usage) : null;
          const refinedMeta = [
            refinedCost !== null ? formatCost(refinedCost) : null,
            abTest.refined?.latencyMs ? formatLatency(abTest.refined.latencyMs) : null,
          ].filter(Boolean).join('   •   ');
          if (refinedMeta) {
            doc.text(refinedMeta, pageWidth - margin, y, { align: 'right' });
          }
          y += 14;

          drawParagraphChunked(abTest.refined.text, 10, 40, false);
          y += 16;
        }
      }

      if (sections.comparison && comparisonPresent) {
        drawSectionHeader('MODEL COMPARISON');

        doc.setFontSize(9.5);
        doc.setTextColor(110);
        doc.setFont('helvetica', 'italic');
        const compHeader = `Same rough prompt refined by ${comparison.columns.length + 1} models. Primary refinement shown first, then alternates.`;
        const compHeaderLines = doc.splitTextToSize(compHeader, contentWidth);
        doc.text(compHeaderLines, margin, y);
        y += compHeaderLines.length * 11 + 12;

        comparison.columns.forEach((col) => {
          if (col.error) {
            ensureSpace(36);
            doc.setFontSize(10);
            doc.setTextColor(180, 80, 80);
            doc.setFont('helvetica', 'bold');
            doc.text(`${modelShortName(col.modelId)} (failed)`, margin, y);
            y += 12;
            doc.setFontSize(9);
            doc.setTextColor(140);
            doc.setFont('helvetica', 'normal');
            const errLines = doc.splitTextToSize(col.error, contentWidth);
            doc.text(errLines, margin, y);
            y += errLines.length * 11 + 14;
            return;
          }

          ensureSpace(40);
          doc.setFontSize(11);
          doc.setTextColor(180, 100, 70);
          doc.setFont('helvetica', 'bold');
          doc.text(modelShortName(col.modelId), margin, y);

          const colCost = col.usage ? computeCost(col.modelId, col.usage) : null;
          const colScore = averageScore(col.scores?.refined);
          const colMeta = [
            colScore !== null ? `${colScore.toFixed(1)}/5` : null,
            colCost !== null ? formatCost(colCost) : null,
            col.latencyMs ? formatLatency(col.latencyMs) : null,
          ].filter(Boolean).join('   •   ');
          if (colMeta) {
            doc.setFontSize(9);
            doc.setTextColor(140);
            doc.setFont('helvetica', 'normal');
            doc.text(colMeta, pageWidth - margin, y, { align: 'right' });
          }
          y += 16;

          if (col.refined) {
            drawParagraphChunked(col.refined, 10, 40, false);
            y += 8;
          }

          if (col.changes?.length > 0) {
            ensureSpace(30);
            doc.setFontSize(9);
            doc.setTextColor(120);
            doc.setFont('helvetica', 'bold');
            doc.text('Changes:', margin, y);
            y += 12;

            col.changes.forEach((c, i) => {
              const cTitle = c.title || '';
              const cExpl = c.explanation || '';
              const cTitleLines = doc.splitTextToSize(`${i + 1}. ${cTitle}`, contentWidth - 8);
              const cExplLines = doc.splitTextToSize(cExpl, contentWidth - 16);
              const bHeight = cTitleLines.length * 11 + cExplLines.length * 10 + 10;
              ensureSpace(bHeight);

              doc.setFontSize(9.5);
              doc.setTextColor(60);
              doc.setFont('helvetica', 'bold');
              doc.text(cTitleLines, margin, y);
              y += cTitleLines.length * 11;

              doc.setFontSize(9);
              doc.setTextColor(110);
              doc.setFont('helvetica', 'normal');
              doc.text(cExplLines, margin + 8, y);
              y += cExplLines.length * 10 + 6;
            });
          }
          y += 12;
        });
      }

      addFooter();

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(url);
      setStatus('ready');
    } catch (err) {
      console.error('PDF generation failed:', err);
      setErrorMsg(err.message || 'PDF generation failed.');
      setStatus('error');
    }
  }

  function handleDownload() {
    if (!pdfBlob) return;
    const safe = sanitizeFilename(filename);
    const finalName = safe.endsWith('.pdf') ? safe : `${safe}.pdf`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setTimeout(() => onClose(), 250);
  }

  function handleOpenInNewTab() {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const sectionCount = availableSections.filter((id) => sections[id]).length;
  const allSectionsCount = availableSections.length;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal pdf-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-title">
        <div className="modal-head">
          <h2 id="pdf-title">Preview & download PDF</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close" title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="pdf-sections-panel">
          <div className="pdf-sections-label">
            Sections to include ({sectionCount} of {allSectionsCount})
          </div>
          <div className="pdf-sections-list">
            {PDF_SECTIONS.map((s) => {
              const available = availableSections.includes(s.id);
              if (!available) return null;
              const checked = sections[s.id];
              return (
                <button
                  type="button"
                  key={s.id}
                  className={`pdf-section-chip ${checked ? 'on' : ''}`}
                  onClick={() => toggleSection(s.id)}
                  disabled={status === 'generating'}
                >
                  <span className="pdf-section-chip-check">
                    {checked && <CheckIcon />}
                  </span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pdf-modal-body">
          {status === 'generating' && (
            <div className="pdf-loading">
              <span className="thinking-dots">
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
              </span>
              <span>Generating PDF preview…</span>
            </div>
          )}

          {status === 'error' && (
            <div className="pdf-error">
              <strong>PDF generation failed.</strong>
              <div>{errorMsg}</div>
              <div className="pdf-error-hint">
                Check the browser console for details. You can close this dialog and try again.
              </div>
            </div>
          )}

          {status === 'ready' && pdfUrl && (
            <iframe src={pdfUrl} className="pdf-preview-frame" title="PDF preview" />
          )}
        </div>

        <div className="modal-foot pdf-modal-foot">
          <div className="pdf-filename-row">
            <label htmlFor="pdf-filename" className="pdf-filename-label">Filename</label>
            <input
              id="pdf-filename"
              type="text"
              className="pdf-filename-input"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={defaultPDFFilename()}
              disabled={status !== 'ready'}
            />
            <span className="pdf-filename-ext">.pdf</span>
          </div>
          <div className="pdf-modal-actions">
            <button className="pii-modal-btn pii-modal-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="pii-modal-btn pii-modal-btn-secondary"
              onClick={handleOpenInNewTab}
              disabled={status !== 'ready'}
              title="Open in a new tab where text selection works"
            >
              <ExternalLinkIcon />
              <span>Open in new tab</span>
            </button>
            <button
              className="pii-modal-btn pii-modal-btn-primary"
              onClick={handleDownload}
              disabled={status !== 'ready'}
            >
              <DownloadIcon />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Drawer views (left rail) ────────────────────────────── */

function DrawerLogo() {
  return (
    <div className="drawer-logo">
      <div className="drawer-logo-mark">
        <FunnelLogo />
      </div>
      <div className="drawer-logo-text">
        <div className="drawer-logo-name">Prompt Refinery</div>
        <div className="drawer-logo-tagline">Well-structured prompts.</div>
      </div>
    </div>
  );
}

function HistoryView({ history, onLoad, onReRefine, onClear, onOpenImportExport }) {
  return (
    <>
      <div className="drawer-head">
        <h3>History</h3>
        <div className="drawer-head-actions">
          <button className="text-btn" onClick={onOpenImportExport} title="Export or import your prompt data">
            Export / Import
          </button>
          {history.length > 0 && (
            <button className="text-btn" onClick={onClear}>Clear all</button>
          )}
        </div>
      </div>
      <div className="drawer-body">
        {history.length === 0 ? (
          <div className="drawer-empty">Your refined prompts will appear here.</div>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.timestamp} className="history-li">
                {/* Top row: badges + time */}
                <div className="history-meta">
                  <span className="history-cat">{entry.category}</span>
                  {entry.isFollowUp && <span className="history-followup">follow-up</span>}
                  {entry.comparison && <span className="history-followup">compare</span>}
                  {entry.imported && <span className="history-followup">imported</span>}
                  <span className="history-time">{formatTime(entry.timestamp)}</span>
                </div>
                {/* Prompt text — click to load */}
                <button className="history-text-btn" onClick={() => onLoad(entry)} title="Load this refinement">
                  {entry.rough}
                </button>
                {/* Action row */}
                <div className="history-actions">
                  <button className="history-action-btn" onClick={() => onLoad(entry)}>
                    Load
                  </button>
                  <button className="history-action-btn accent" onClick={() => onReRefine(entry)}>
                    Re-refine
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// Drag-and-drop: store the dragged entry id in a ref shared via context
// (simple module-level variable — only one drag happens at a time)
let _draggedSavedId = null;

function SavedView({ saved, folders, onLoad, onRename, onRemove, onMoveToFolder, onAddFolder, onRenameFolder, onDeleteFolder }) {
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const addFolderInputRef = useRef(null);

  useEffect(() => {
    if (addingFolder) addFolderInputRef.current?.focus();
  }, [addingFolder]);

  function commitNewFolder() {
    const name = newFolderName.trim();
    if (name) onAddFolder(name);
    setNewFolderName('');
    setAddingFolder(false);
  }

  // Group prompts by folder
  const uncategorized = saved.filter(s => !s.folderId);
  const byFolder = folders.map(f => ({
    folder: f,
    items: saved.filter(s => s.folderId === f.id),
  }));

  return (
    <>
      <div className="drawer-head">
        <h3>Saved</h3>
        <button className="text-btn" onClick={() => setAddingFolder(true)} title="Create a new folder">
          + Folder
        </button>
      </div>
      <div className="drawer-body">
        {folders.length > 0 && (
          <p className="folder-drag-hint">Drag prompts onto a folder to organise them.</p>
        )}
        {addingFolder && (
          <div className="folder-add-row">
            <input
              ref={addFolderInputRef}
              className="saved-rename-input"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitNewFolder(); }
                else if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); }
              }}
              onBlur={commitNewFolder}
              placeholder="Folder name"
              maxLength={60}
            />
          </div>
        )}

        {saved.length === 0 && !addingFolder ? (
          <div className="drawer-empty">Star a refined prompt to save it here for later.</div>
        ) : (
          <>
            {/* Named folders — are drop targets */}
            {byFolder.map(({ folder, items }) => (
              <FolderSection
                key={folder.id}
                folder={folder}
                items={items}
                allFolders={folders}
                onLoad={onLoad}
                onRename={onRename}
                onRemove={onRemove}
                onMoveToFolder={onMoveToFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            ))}

            {/* Uncategorized — also a drop target (to remove from folder) */}
            <div
              className="folder-section uncategorized-section"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (_draggedSavedId) { onMoveToFolder(_draggedSavedId, null); _draggedSavedId = null; }
              }}
            >
              {folders.length > 0 && (
                <div className="folder-header no-click">
                  <span className="folder-icon"><FolderIcon /></span>
                  <span className="folder-name">Uncategorized</span>
                  <span className="folder-count">{uncategorized.length}</span>
                </div>
              )}
              {uncategorized.length === 0 && folders.length > 0 && (
                <div className="folder-drop-zone">Drop here to remove from folder</div>
              )}
              <ul className="saved-list">
                {uncategorized.map(entry => (
                  <SavedItem
                    key={entry.id}
                    entry={entry}
                    folders={folders}
                    onLoad={onLoad}
                    onRename={onRename}
                    onRemove={onRemove}
                    onMoveToFolder={onMoveToFolder}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function FolderSection({ folder, items, allFolders, onLoad, onRename, onRemove, onMoveToFolder, onRenameFolder, onDeleteFolder }) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const nameInputRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  function commitFolderName() {
    const name = draftName.trim();
    if (name) onRenameFolder(folder.id, name);
    setEditingName(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (_draggedSavedId) {
      onMoveToFolder(_draggedSavedId, folder.id);
      _draggedSavedId = null;
    }
  }

  return (
    <div
      className={`folder-section ${dragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="folder-header" onClick={() => !editingName && setCollapsed(c => !c)}>
        <span className="folder-icon"><FolderIcon /></span>
        {editingName ? (
          <input
            ref={nameInputRef}
            className="folder-rename-input"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitFolderName(); }
              else if (e.key === 'Escape') { setDraftName(folder.name); setEditingName(false); }
            }}
            onBlur={commitFolderName}
            onClick={e => e.stopPropagation()}
            maxLength={60}
          />
        ) : (
          <span className="folder-name">{folder.name}</span>
        )}
        <span className="folder-count">{items.length}</span>
        <button
          className="folder-action-btn"
          onClick={e => { e.stopPropagation(); setEditingName(true); setDraftName(folder.name); }}
          title="Rename folder"
        ><PencilIcon /></button>
        <button
          className="folder-action-btn"
          onClick={e => { e.stopPropagation(); onDeleteFolder(folder.id); }}
          title="Delete folder (prompts move to Uncategorized)"
        ><TrashIcon /></button>
      </div>
      {!collapsed && (
        <ul className="saved-list">
          {items.length === 0
            ? <li className="folder-empty-hint">Drop a prompt here, or no prompts yet.</li>
            : items.map(entry => (
                <SavedItem
                  key={entry.id}
                  entry={entry}
                  folders={allFolders}
                  onLoad={onLoad}
                  onRename={onRename}
                  onRemove={onRemove}
                  onMoveToFolder={onMoveToFolder}
                />
              ))
          }
        </ul>
      )}
    </div>
  );
}

function SavedItem({ entry, folders, onLoad, onRename, onRemove, onMoveToFolder }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(entry.name || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitName() {
    onRename(entry.id, draftName.trim());
    setEditing(false);
  }

  function cancelEdit() {
    setDraftName(entry.name || '');
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  const displayName = entry.name || entry.rough;

  return (
    <li
      className="saved-item"
      draggable
      onDragStart={() => { _draggedSavedId = entry.id; }}
      onDragEnd={() => { _draggedSavedId = null; }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="saved-rename-input"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitName}
          placeholder="Name this prompt"
          maxLength={80}
        />
      ) : (
        <button className="saved-main" onClick={() => onLoad(entry)}>
          <div className="saved-row">
            <span className="saved-cat">{entry.category}</span>
            <span className="saved-time">{formatTime(entry.savedAt)}</span>
          </div>
          <span className="saved-name">{displayName}</span>
          {entry.name && <span className="saved-preview">{entry.rough}</span>}
        </button>
      )}
      <div className="saved-actions">
        <button
          className="saved-action-btn"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          aria-label="Rename"
          title="Rename"
        >
          <PencilIcon />
        </button>
        <button
          className="saved-action-btn"
          onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
          aria-label="Remove"
          title="Remove"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function TemplatesView({ onSelect }) {
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    templates: TEMPLATES.filter((t) => t.category === cat.id),
  })).filter((group) => group.templates.length > 0);

  return (
    <>
      <div className="drawer-head">
        <h3>Templates</h3>
      </div>
      <div className="drawer-body templates-body">
        <p className="templates-intro">
          Start from a common scenario. Click any template to fill the composer, then edit or submit as-is.
        </p>
        {grouped.map((group) => (
          <div key={group.id} className="templates-group">
            <div className="templates-group-label">{group.label}</div>
            <div className="templates-list">
              {group.templates.map((t) => (
                <button
                  key={t.id}
                  className="template-card"
                  onClick={() => onSelect(t)}
                >
                  <div className="template-title">{t.title}</div>
                  <div className="template-description">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function UsageView({ usage, onClear }) {
  const stats = useMemo(() => {
    if (!usage || usage.length === 0) return null;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    let last24h = { count: 0, cost: 0, tokens: 0 };
    let last7d = { count: 0, cost: 0, tokens: 0 };
    let last30d = { count: 0, cost: 0, tokens: 0 };
    let allTime = { count: 0, cost: 0, tokens: 0 };

    const byModel = {};
    const byDay = {};

    let totalLatency = 0;
    let latencyCount = 0;

    for (const record of usage) {
      const age = now - record.timestamp;
      const tokens = (record.inputTokens || 0) + (record.outputTokens || 0);
      const cost = record.costUSD || 0;

      allTime.count++;
      allTime.cost += cost;
      allTime.tokens += tokens;
      if (age <= dayMs) { last24h.count++; last24h.cost += cost; last24h.tokens += tokens; }
      if (age <= weekMs) { last7d.count++; last7d.cost += cost; last7d.tokens += tokens; }
      if (age <= monthMs) { last30d.count++; last30d.cost += cost; last30d.tokens += tokens; }

      if (record.latencyMs) {
        totalLatency += record.latencyMs;
        latencyCount++;
      }

      const modelKey = record.model || 'unknown';
      if (!byModel[modelKey]) byModel[modelKey] = { count: 0, cost: 0, tokens: 0 };
      byModel[modelKey].count++;
      byModel[modelKey].cost += cost;
      byModel[modelKey].tokens += tokens;

      const dayKey = new Date(record.timestamp).toISOString().slice(0, 10);
      if (!byDay[dayKey]) byDay[dayKey] = { count: 0, cost: 0 };
      byDay[dayKey].count++;
      byDay[dayKey].cost += cost;
    }

    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : null;
    const modelEntries = Object.entries(byModel)
      .map(([model, modelStats]) => ({ model, ...modelStats }))
      .sort((a, b) => b.cost - a.cost);

    const dayEntries = [];
    for (let i = 6; i >= 0; i--) {
      const dayKey = new Date(now - i * dayMs).toISOString().slice(0, 10);
      const data = byDay[dayKey] || { count: 0, cost: 0 };
      dayEntries.push({ day: dayKey, ...data });
    }
    const maxDayCost = Math.max(0.001, ...dayEntries.map(d => d.cost));

    return { last24h, last7d, last30d, allTime, avgLatency, modelEntries, dayEntries, maxDayCost };
  }, [usage]);

  if (!stats) {
    return (
      <>
        <div className="drawer-head">
          <h3>Usage & cost</h3>
        </div>
        <div className="drawer-body">
          <div className="drawer-empty">
            Your usage and cost will appear here after your first refinement.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="drawer-head">
        <h3>Usage & cost</h3>
        <button className="text-btn" onClick={onClear} title="Reset usage tracking">
          Reset
        </button>
      </div>
      <div className="drawer-body usage-body">
        <div className="usage-disclaimer">
          Cost estimates based on Anthropic's published rates (May 2026). Final billing is via your Anthropic Console.
        </div>

        <div className="usage-totals">
          <div className="usage-total">
            <div className="usage-total-label">Today</div>
            <div className="usage-total-value">{formatCost(stats.last24h.cost) || '—'}</div>
            <div className="usage-total-meta">{stats.last24h.count} {stats.last24h.count === 1 ? 'call' : 'calls'}</div>
          </div>
          <div className="usage-total">
            <div className="usage-total-label">7 days</div>
            <div className="usage-total-value">{formatCost(stats.last7d.cost) || '—'}</div>
            <div className="usage-total-meta">{stats.last7d.count} {stats.last7d.count === 1 ? 'call' : 'calls'}</div>
          </div>
          <div className="usage-total">
            <div className="usage-total-label">30 days</div>
            <div className="usage-total-value">{formatCost(stats.last30d.cost) || '—'}</div>
            <div className="usage-total-meta">{stats.last30d.count} {stats.last30d.count === 1 ? 'call' : 'calls'}</div>
          </div>
        </div>

        <div className="usage-section">
          <div className="usage-section-label">Last 7 days</div>
          <div className="usage-chart">
            {stats.dayEntries.map((day) => {
              const heightPct = stats.maxDayCost > 0 ? (day.cost / stats.maxDayCost) * 100 : 0;
              const dayShort = new Date(day.day).toLocaleDateString(undefined, { weekday: 'short' });
              return (
                <div key={day.day} className="usage-chart-bar" title={`${day.day}: ${formatCost(day.cost) || '$0'} · ${day.count} ${day.count === 1 ? 'call' : 'calls'}`}>
                  <div className="usage-chart-bar-fill" style={{ height: `${heightPct}%` }} />
                  <div className="usage-chart-bar-label">{dayShort}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="usage-section">
          <div className="usage-section-label">By model</div>
          <div className="usage-models">
            {stats.modelEntries.map((entry) => (
              <div key={entry.model} className="usage-model-row">
                <span className="usage-model-name">{modelShortName(entry.model)}</span>
                <span className="usage-model-meta">{entry.count} {entry.count === 1 ? 'call' : 'calls'}</span>
                <span className="usage-model-cost">{formatCost(entry.cost) || '$0'}</span>
              </div>
            ))}
          </div>
        </div>

        {stats.avgLatency !== null && (
          <div className="usage-section">
            <div className="usage-section-label">Performance</div>
            <div className="usage-perf-row">
              <span className="usage-perf-label">Average latency</span>
              <span className="usage-perf-value">{formatLatency(Math.round(stats.avgLatency))}</span>
            </div>
            <div className="usage-perf-row">
              <span className="usage-perf-label">Total tokens (input + output)</span>
              <span className="usage-perf-value">{stats.allTime.tokens.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Analytics View ──────────────────────────────────────── */

function AnalyticsView({ history }) {
  const stats = useMemo(() => {
    const withScores = history.filter(e => e.scores?.rough && e.scores?.refined);
    if (withScores.length === 0) return null;

    // Per-dimension average lift (refined - rough)
    const dimLifts = SCORE_DIMENSIONS.map(d => {
      const lifts = withScores
        .map(e => (e.scores.refined[d.id]?.score ?? 0) - (e.scores.rough[d.id]?.score ?? 0))
        .filter(v => !isNaN(v));
      const avg = lifts.length ? lifts.reduce((a, b) => a + b, 0) / lifts.length : 0;
      return { ...d, avgLift: avg };
    });

    const bestDim = [...dimLifts].sort((a, b) => b.avgLift - a.avgLift)[0];

    // Overall avg refined score per entry (last 10)
    const last10 = [...withScores].slice(0, 10).reverse();
    const trendEntries = last10.map(e => ({
      ts: e.timestamp,
      score: averageScore(e.scores?.refined) || 0,
    }));
    const maxTrend = Math.max(5, ...trendEntries.map(t => t.score));

    // Category breakdown
    const byCat = {};
    for (const e of history) {
      byCat[e.category] = (byCat[e.category] || 0) + 1;
    }
    const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...catEntries.map(c => c[1]));

    // Avg overall score lift
    const overallLifts = withScores.map(e =>
      (averageScore(e.scores?.refined) || 0) - (averageScore(e.scores?.rough) || 0)
    );
    const avgLift = overallLifts.length ? overallLifts.reduce((a, b) => a + b, 0) / overallLifts.length : 0;
    const avgRefined = withScores.reduce((a, e) => a + (averageScore(e.scores?.refined) || 0), 0) / withScores.length;

    return { dimLifts, bestDim, trendEntries, maxTrend, catEntries, maxCat, avgLift, avgRefined, total: history.length };
  }, [history]);

  if (!stats) {
    return (
      <>
        <div className="drawer-head"><h3>Analytics</h3></div>
        <div className="drawer-body">
          <div className="drawer-empty">Analytics appear after your first refinement with scores.</div>
        </div>
      </>
    );
  }

  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <>
      <div className="drawer-head"><h3>Analytics</h3></div>
      <div className="drawer-body">

        {/* Summary cards */}
        <div className="analytics-cards">
          <div className="analytics-card">
            <div className="analytics-card-value">{stats.total}</div>
            <div className="analytics-card-label">Refinements</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-value">{stats.avgRefined.toFixed(1)}</div>
            <div className="analytics-card-label">Avg refined score</div>
          </div>
          <div className="analytics-card highlight">
            <div className="analytics-card-value">+{stats.avgLift.toFixed(1)}</div>
            <div className="analytics-card-label">Avg score lift</div>
          </div>
        </div>

        {/* Best dimension */}
        {stats.bestDim && (
          <div className="analytics-best">
            ✨ Most improved: <strong>{stats.bestDim.label}</strong> (+{stats.bestDim.avgLift.toFixed(1)} avg)
          </div>
        )}

        {/* Dimension lifts */}
        <div className="analytics-section-title">Score lift by dimension</div>
        <div className="analytics-bars">
          {stats.dimLifts.map(d => (
            <div key={d.id} className="analytics-bar-row">
              <span className="analytics-bar-label">{d.label}</span>
              <div className="analytics-bar-track">
                <div
                  className={`analytics-bar-fill ${d.avgLift >= 0 ? 'positive' : 'negative'}`}
                  style={{ width: `${Math.min(100, Math.abs(d.avgLift) / 4 * 100)}%` }}
                />
              </div>
              <span className="analytics-bar-value">{d.avgLift >= 0 ? '+' : ''}{d.avgLift.toFixed(1)}</span>
            </div>
          ))}
        </div>

        {/* Score trend */}
        {stats.trendEntries.length > 1 && (
          <>
            <div className="analytics-section-title">Refined score trend (last 10)</div>
            <div className="usage-chart">
              {stats.trendEntries.map((t, i) => (
                <div key={i} className="usage-bar-wrap" title={`${new Date(t.ts).toLocaleDateString()}: ${t.score.toFixed(1)}`}>
                  <div
                    className="usage-bar"
                    style={{ height: `${Math.max(4, (t.score / stats.maxTrend) * 100)}%` }}
                  />
                  <div className="usage-bar-label">{WEEKDAYS[new Date(t.ts).getDay()]}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Category breakdown */}
        <div className="analytics-section-title">By category</div>
        <div className="analytics-bars">
          {stats.catEntries.map(([cat, count]) => (
            <div key={cat} className="analytics-bar-row">
              <span className="analytics-bar-label">{cat}</span>
              <div className="analytics-bar-track">
                <div className="analytics-bar-fill positive" style={{ width: `${(count / stats.maxCat) * 100}%` }} />
              </div>
              <span className="analytics-bar-value">{count}</span>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}

/* ── Chain View ───────────────────────────────────────────── */

const DEFAULT_CHAIN_STEP = () => ({ id: makeId(), prompt: '', output: '', status: 'idle' });

function ChainView({ chainSteps, onUpdateSteps, onRunChain, chainRunning, testModel }) {
  function addStep() {
    onUpdateSteps([...chainSteps, DEFAULT_CHAIN_STEP()]);
  }

  function removeStep(id) {
    onUpdateSteps(chainSteps.filter(s => s.id !== id));
  }

  function moveUp(idx) {
    if (idx === 0) return;
    const next = [...chainSteps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onUpdateSteps(next);
  }

  function moveDown(idx) {
    if (idx === chainSteps.length - 1) return;
    const next = [...chainSteps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onUpdateSteps(next);
  }

  function updateStepPrompt(id, value) {
    onUpdateSteps(chainSteps.map(s => s.id === id ? { ...s, prompt: value } : s));
  }

  const canRun = chainSteps.length > 0 && chainSteps.every(s => s.prompt.trim()) && !chainRunning;

  return (
    <>
      <div className="drawer-head">
        <h3>Prompt Chain</h3>
        <button className="text-btn" onClick={addStep} disabled={chainRunning}>+ Step</button>
      </div>
      <div className="drawer-body">
        {chainSteps.length === 0 ? (
          <div className="drawer-empty">
            Build a pipeline of prompts. Each step's output feeds into the next.
            <br /><br />
            <button className="text-btn" onClick={addStep}>+ Add first step</button>
          </div>
        ) : (
          <>
            {chainSteps.map((step, idx) => (
              <div key={step.id} className={`chain-step ${step.status === 'running' ? 'running' : ''} ${step.status === 'done' ? 'done' : ''}`}>
                <div className="chain-step-header">
                  <span className="chain-step-num">Step {idx + 1}</span>
                  <div className="chain-step-controls">
                    <button className="chain-ctrl-btn" onClick={() => moveUp(idx)} disabled={idx === 0 || chainRunning} title="Move up">
                      <ChevronUpIcon />
                    </button>
                    <button className="chain-ctrl-btn" onClick={() => moveDown(idx)} disabled={idx === chainSteps.length - 1 || chainRunning} title="Move down">
                      <ChevronUpIcon style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button className="chain-ctrl-btn danger" onClick={() => removeStep(step.id)} disabled={chainRunning} title="Remove step">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <textarea
                  className="chain-step-textarea"
                  value={step.prompt}
                  onChange={e => updateStepPrompt(step.id, e.target.value)}
                  placeholder={idx === 0 ? 'Enter prompt for step 1…' : 'Use {{previous_output}} to reference the previous step\'s result…'}
                  rows={3}
                  disabled={chainRunning}
                />
                {step.status === 'running' && (
                  <div className="chain-step-output running-hint">Running…</div>
                )}
                {step.output && (
                  <div className="chain-step-output">
                    <div className="chain-output-label">Output</div>
                    <div className="chain-output-text">{step.output}</div>
                    <button className="text-btn" onClick={() => navigator.clipboard.writeText(step.output)} style={{ marginTop: 4 }}>Copy</button>
                  </div>
                )}
              </div>
            ))}

            <div className="chain-footer">
              <div className="chain-model-hint">Model: {testModel}</div>
              <button
                className="send-btn chain-run-btn"
                onClick={onRunChain}
                disabled={!canRun}
              >
                {chainRunning ? 'Running…' : 'Run chain'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ── Template Variables Modal ─────────────────────────────── */

function TemplateVariablesModal({ variables, values, onChange, onContinue, onCancel }) {
  const firstInputRef = useRef(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const allFilled = variables.every(v => (values[v] || '').trim());

  function handleKeyDown(e) {
    if (e.key === 'Enter' && allFilled) { e.preventDefault(); onContinue(); }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h2>Fill in variables</h2>
          <button className="modal-close" onClick={onCancel}><CloseIcon /></button>
        </div>
        <div className="modal-body" onKeyDown={handleKeyDown}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Your prompt has <strong>{variables.length}</strong> variable{variables.length !== 1 ? 's' : ''}. Fill them in below, then continue.
          </p>
          {variables.map((v, i) => (
            <div key={v} className="template-var-row">
              <label className="template-var-label">
                <code>{`{{${v}}}`}</code>
              </label>
              <input
                ref={i === 0 ? firstInputRef : null}
                className="template-var-input"
                value={values[v] || ''}
                onChange={e => onChange(v, e.target.value)}
                placeholder={`Value for ${v}`}
              />
            </div>
          ))}
          <div className="modal-footer-actions">
            <button className="text-btn" onClick={onCancel}>Cancel</button>
            <button className="send-btn" onClick={onContinue} disabled={!allFilled}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Share Modal ──────────────────────────────────────────── */

function ShareModal({ shareUrl, rough, improved, changes, onClose }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function copyMarkdown() {
    const md = buildShareMarkdown(rough, improved, changes);
    await navigator.clipboard.writeText(md);
    setMdCopied(true);
    setTimeout(() => setMdCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h2>Share prompt</h2>
          <button className="modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <h3>Local link</h3>
            <p className="modal-section-hint">This link works on your machine while the server is running.</p>
            <div className="share-link-row">
              <input className="share-link-input" value={shareUrl} readOnly onClick={e => e.target.select()} />
              <button className="send-btn" style={{ flexShrink: 0 }} onClick={copyLink}>
                {linkCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
          <div className="modal-section">
            <h3>Copy as Markdown</h3>
            <p className="modal-section-hint">Paste into Slack, Notion, email, or anywhere that renders Markdown.</p>
            <button className="text-btn" onClick={copyMarkdown}>
              {mdCopied ? '✓ Copied to clipboard' : 'Copy as Markdown'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildShareMarkdown(rough, improved, changes) {
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

function HelpView() {
  const [activeSection, setActiveSection] = useState(HELP_CONTENT[0].id);

  return (
    <>
      <div className="drawer-head">
        <h3>Help & Docs</h3>
      </div>
      <div className="help-main">
        <div className="help-nav">
          {HELP_CONTENT.map((section) => (
            <button
              key={section.id}
              className={`help-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>
        <div className="help-body">
          {HELP_CONTENT.filter((s) => s.id === activeSection).map((section) => (
            <div key={section.id} className="help-section">
              <h4>{section.title}</h4>
              {section.body.map((block, i) => {
                if (block.type === 'text') return <p key={i} className="help-text">{block.text}</p>;
                if (block.type === 'step') {
                  return (
                    <div key={i} className="help-step">
                      <div className="help-step-num">{block.n}</div>
                      <div className="help-step-body">
                        <div className="help-step-title">{block.title}</div>
                        <div className="help-step-text">{block.text}</div>
                      </div>
                    </div>
                  );
                }
                if (block.type === 'list') {
                  return (
                    <ul key={i} className="help-list">
                      {block.items.map((item, j) => (
                        <li key={j}>
                          <span className="help-list-label">{item.label}</span>
                          <span className="help-list-text">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === 'note') return <div key={i} className="help-note">{block.text}</div>;
                return null;
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SettingsView({ settings, onChange, onReset, speechSupported }) {
  const claudeModels = MODELS.filter((m) => m.provider === 'Anthropic');
  const comingSoon = MODELS.filter((m) => !m.available);

  return (
    <>
      <div className="drawer-head">
        <h3>Settings</h3>
        <button className="text-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="drawer-body settings-body">

        <div className="settings-group">
          <div className="settings-group-label">Prompt linter</div>
          <div className="settings-group-hint">
            Get instant hints about your rough prompt as you type. No API call — runs locally.
          </div>
          <button
            type="button"
            className={`toggle-row ${settings.linterEnabled ? 'on' : ''}`}
            onClick={() => onChange({ linterEnabled: !settings.linterEnabled })}
            role="switch"
            aria-checked={settings.linterEnabled}
          >
            <div className="toggle-row-text">
              <div className="toggle-row-label">Show linter hints</div>
              <div className="toggle-row-desc">
                {settings.linterEnabled
                  ? 'Hints appear under the composer when issues are detected.'
                  : 'No hints will be shown.'}
              </div>
            </div>
            <div className="toggle-switch">
              <div className="toggle-switch-thumb" />
            </div>
          </button>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Privacy</div>
          <div className="settings-group-hint">
            Check your rough prompt for things like API keys, card numbers, emails, and phone numbers before sending to the API. Runs in your browser.
          </div>
          <button
            type="button"
            className={`toggle-row ${settings.piiScannerEnabled ? 'on' : ''}`}
            onClick={() => onChange({ piiScannerEnabled: !settings.piiScannerEnabled })}
            role="switch"
            aria-checked={settings.piiScannerEnabled}
          >
            <div className="toggle-row-text">
              <div className="toggle-row-label">Scan for personal info before sending</div>
              <div className="toggle-row-desc">
                {settings.piiScannerEnabled
                  ? 'A warning appears if sensitive-looking content is detected.'
                  : 'Prompts are sent without a privacy check.'}
              </div>
            </div>
            <div className="toggle-switch">
              <div className="toggle-switch-thumb" />
            </div>
          </button>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Voice input</div>
          <div className="settings-group-hint">
            {speechSupported
              ? 'Dictate rough prompts using your microphone. Transcription uses your browser\'s built-in speech recognition. On Chrome this routes through Google\'s servers; on Safari it stays on-device.'
              : 'Your browser does not support speech recognition. Try Chrome or Safari.'}
          </div>
          <button
            type="button"
            className={`toggle-row ${settings.voiceEnabled && speechSupported ? 'on' : ''}`}
            onClick={() => speechSupported && onChange({ voiceEnabled: !settings.voiceEnabled })}
            role="switch"
            aria-checked={settings.voiceEnabled && speechSupported}
            disabled={!speechSupported}
          >
            <div className="toggle-row-text">
              <div className="toggle-row-label">Enable microphone button</div>
              <div className="toggle-row-desc">
                {!speechSupported
                  ? 'Not available in this browser.'
                  : settings.voiceEnabled
                  ? 'Microphone button appears next to the send button.'
                  : 'No microphone button is shown.'}
              </div>
            </div>
            <div className="toggle-switch">
              <div className="toggle-switch-thumb" />
            </div>
          </button>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Refinement model</div>
          <div className="settings-group-hint">
            Choose which AI model refines your prompts. Claude Sonnet 4.6 is the default.
          </div>

          <div className="model-section-label">Anthropic</div>
          <div className="model-list">
            {claudeModels.map((m) => {
              const rates = PRICING[m.id];
              return (
                <button
                  key={m.id}
                  className={`model-card ${settings.model === m.id ? 'selected' : ''}`}
                  onClick={() => onChange({ model: m.id })}
                >
                  <div className="model-card-main">
                    <div className="model-card-name">
                      {m.name}
                      {m.isDefault && <span className="model-default-badge">Default</span>}
                    </div>
                    <div className="model-card-desc">{m.description}</div>
                    {rates && (
                      <div className="model-card-pricing">
                        ${rates.input.toFixed(2)} input / ${rates.output.toFixed(2)} output per MTok
                      </div>
                    )}
                  </div>
                  <div className="model-radio">
                    {settings.model === m.id && <CheckIcon />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="model-section-label muted">Coming soon</div>
          <div className="model-list">
            {comingSoon.map((m) => (
              <div key={m.id} className="model-card disabled">
                <div className="model-card-main">
                  <div className="model-card-name">
                    {m.name}
                    <span className="model-provider-badge">{m.provider}</span>
                  </div>
                  <div className="model-card-desc">{m.description}</div>
                </div>
                <div className="model-radio" />
              </div>
            ))}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Test runner & prompt execution model</div>
          <div className="settings-group-hint">
            Which model executes prompts when you click "Run prompt" or run A/B tests. Independent from the refinement model — pick based on the actual task complexity. This same setting controls both features.
          </div>

          <div className="model-list">
            {claudeModels.map((m) => (
              <button
                key={m.id}
                className={`model-card ${settings.testModel === m.id ? 'selected' : ''}`}
                onClick={() => onChange({ testModel: m.id })}
              >
                <div className="model-card-main">
                  <div className="model-card-name">{m.name}</div>
                  <div className="model-card-desc">{m.description}</div>
                </div>
                <div className="model-radio">
                  {settings.testModel === m.id && <CheckIcon />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-divider" />

        <ScoringDimensionsSettings settings={settings} onChange={onChange} />

      </div>
    </>
  );
}

function ScoringDimensionsSettings({ settings, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);

  const removedSet = new Set(settings.removedDimensions || []);
  const customDims = settings.customDimensions || [];

  function removeBuiltIn(id) {
    onChange({ removedDimensions: [...removedSet, id] });
  }

  function restoreBuiltIn(id) {
    onChange({ removedDimensions: [...removedSet].filter(x => x !== id) });
  }

  function addCustom() {
    const label = newLabel.trim();
    const description = newDesc.trim();
    if (!label) return;
    const id = 'custom_' + label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const newDim = { id, label, description };
    onChange({ customDimensions: [...customDims, newDim] });
    setNewLabel('');
    setNewDesc('');
    setAdding(false);
  }

  function removeCustom(id) {
    onChange({ customDimensions: customDims.filter(d => d.id !== id) });
  }

  function resetToDefaults() {
    onChange({ customDimensions: [], removedDimensions: [] });
  }

  return (
    <div className="settings-group">
      <div className="settings-group-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Scoring dimensions</span>
        {(removedSet.size > 0 || customDims.length > 0) && (
          <button className="text-btn" onClick={resetToDefaults} style={{ fontSize: 11 }}>Reset to defaults</button>
        )}
      </div>
      <div className="settings-group-hint">
        Customize which dimensions Claude scores. Remove built-in ones or add your own (e.g. "Creativity", "Tone").
      </div>

      <div className="dim-chips">
        {SCORE_DIMENSIONS.map(d => (
          <div key={d.id} className={`dim-chip ${removedSet.has(d.id) ? 'removed' : ''}`} title={d.description}>
            {d.label}
            {removedSet.has(d.id)
              ? <button className="dim-chip-btn" onClick={() => restoreBuiltIn(d.id)} title="Restore">+</button>
              : <button className="dim-chip-btn" onClick={() => removeBuiltIn(d.id)} title="Remove">×</button>
            }
          </div>
        ))}
        {customDims.map(d => (
          <div key={d.id} className="dim-chip custom" title={d.description}>
            {d.label}
            <button className="dim-chip-btn" onClick={() => removeCustom(d.id)} title="Remove">×</button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="dim-add-form">
          <input
            className="template-var-input"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Dimension name (e.g. Creativity)"
            maxLength={40}
            autoFocus
          />
          <input
            className="template-var-input"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Short description (optional)"
            maxLength={120}
            style={{ marginTop: 6 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="text-btn" onClick={() => { setAdding(false); setNewLabel(''); setNewDesc(''); }}>Cancel</button>
            <button className="send-btn" style={{ padding: '5px 14px', fontSize: 13 }} onClick={addCustom} disabled={!newLabel.trim()}>Add</button>
          </div>
        </div>
      ) : (
        <button className="text-btn" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>+ Add dimension</button>
      )}
    </div>
  );
}

/* ── Import/Export modal ─────────────────────────────────── */

function ImportExportModal({ history, saved, onClose, onImport }) {
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);

  function handleExport(format) {
    if (history.length === 0 && saved.length === 0) {
      setImportStatus({ kind: 'error', message: 'Nothing to export yet. Refine a prompt or save one first.' });
      return;
    }
    try {
      if (format === 'markdown') exportMarkdown(history, saved);
      else if (format === 'json') exportJSON(history, saved);
      else if (format === 'csv') exportCSV(history, saved);
      setImportStatus({
        kind: 'success',
        message: `Exported as ${format.toUpperCase()}. Check your downloads.`,
      });
    } catch (err) {
      console.error(err);
      setImportStatus({ kind: 'error', message: 'Export failed. Please try again.' });
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ kind: 'loading', message: `Reading ${file.name}…` });

    try {
      const text = await file.text();
      const result = importFile(file.name, text, history, saved);
      onImport(result.importedHistory, result.importedSaved);

      const parts = [];
      parts.push(`${result.totalImported} prompts imported successfully.`);
      if (result.duplicateCount > 0) {
        parts.push(`${result.duplicateCount} skipped as duplicates.`);
      }
      if (result.invalidCount > 0) {
        parts.push(`${result.invalidCount} skipped as invalid.`);
      }
      setImportStatus({ kind: 'success', message: parts.join(' ') });
    } catch (err) {
      console.error(err);
      setImportStatus({
        kind: 'error',
        message: err.message || 'Import failed. Please check the file and try again.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ie-title">
        <div className="modal-head">
          <h2 id="ie-title">Export / Import</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close" title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <section className="modal-section">
            <h3>Export</h3>
            <p className="modal-section-hint">
              Save a copy of your {history.length} history {history.length === 1 ? 'entry' : 'entries'}{' '}
              and {saved.length} saved {saved.length === 1 ? 'prompt' : 'prompts'} to a file.
            </p>

            <div className="format-list">
              <button className="format-card" onClick={() => handleExport('markdown')}>
                <div className="format-card-head">
                  <DownloadIcon />
                  <span className="format-card-title">Markdown</span>
                  <span className="format-card-ext">.md</span>
                </div>
                <div className="format-card-desc">
                  Human-readable. Great for reviewing or sharing.
                </div>
              </button>

              <button className="format-card" onClick={() => handleExport('json')}>
                <div className="format-card-head">
                  <DownloadIcon />
                  <span className="format-card-title">JSON</span>
                  <span className="format-card-ext">.json</span>
                  <span className="format-card-badge">Lossless</span>
                </div>
                <div className="format-card-desc">
                  Complete backup with every field. Best for re-importing later.
                </div>
              </button>

              <button className="format-card" onClick={() => handleExport('csv')}>
                <div className="format-card-head">
                  <DownloadIcon />
                  <span className="format-card-title">CSV</span>
                  <span className="format-card-ext">.csv</span>
                </div>
                <div className="format-card-desc">
                  Flat spreadsheet format. Best for Excel / Google Sheets.
                </div>
              </button>
            </div>
          </section>

          <section className="modal-section">
            <h3>Import</h3>
            <p className="modal-section-hint">
              Add prompts from a previously exported <code>.json</code>, <code>.md</code>, or <code>.csv</code> file.
              Imports are <strong>merged</strong> with your existing data — duplicates are skipped automatically.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.md,.markdown,.csv,application/json,text/markdown,text/csv"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
            <button className="import-btn" onClick={handleImportClick}>
              <UploadIcon />
              <span>Choose file to import…</span>
            </button>
          </section>

          {importStatus && (
            <div className={`modal-status modal-status-${importStatus.kind}`}>
              {importStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Display panels (main area) ──────────────────────────── */

function RoughPromptMessage({ text, category, isFollowUp }) {
  if (!text) return null;
  return (
    <div className="rough-message">
      <div className="rough-message-header">
        <span className="rough-message-label">
          {isFollowUp ? 'Follow-up feedback' : 'Your rough prompt'}
        </span>
        {category && !isFollowUp && (
          <span className="rough-message-cat">{category}</span>
        )}
      </div>
      <div className="rough-message-body">{text}</div>
    </div>
  );
}

function ChangesPanel({ changes }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div className="changes">
      <div className="changes-header">
        <span className="changes-icon"><SparkIcon /></span>
        <span className="changes-label">What changed</span>
        <span className="changes-count">{changes.length}</span>
      </div>
      <ol className="changes-list">
        {changes.map((c, i) => (
          <li key={i} className="changes-item">
            <span className="changes-num">{i + 1}</span>
            <div className="changes-body">
              <div className="changes-title">{c.title}</div>
              <div className="changes-explanation">{c.explanation}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RadarChart({ scoreSet, variant, size = 'normal' }) {
  const dimension = size === 'small' ? 160 : 220;
  const cx = dimension / 2;
  const cy = dimension / 2;
  const maxR = (dimension / 2) - 32;

  const angles = SCORE_DIMENSIONS.map((_, i) =>
    -Math.PI / 2 + (i * 2 * Math.PI) / SCORE_DIMENSIONS.length
  );

  function pointAt(score, i) {
    const clamped = Math.max(0, Math.min(5, score)) / 5;
    const r = clamped * maxR;
    return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  }

  function labelPosition(i) {
    const r = maxR + (size === 'small' ? 18 : 22);
    return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  }

  function ringPoints(level) {
    return angles
      .map((a) => {
        const r = (level / 5) * maxR;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      })
      .join(' ');
  }

  const polygon = SCORE_DIMENSIONS
    .map((d, i) => pointAt(scoreSet?.[d.id]?.score ?? 0, i))
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${dimension} ${dimension}`} className={`radar-chart radar-${variant} radar-${size}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={ringPoints(level)}
          className={`radar-ring ${level === 5 ? 'radar-ring-outer' : ''}`}
        />
      ))}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + maxR * Math.cos(a)}
          y2={cy + maxR * Math.sin(a)}
          className="radar-spoke"
        />
      ))}
      <polygon points={polygon} className={`radar-polygon radar-polygon-${variant}`} />
      {SCORE_DIMENSIONS.map((d, i) => {
        const score = scoreSet?.[d.id]?.score ?? 0;
        const [x, y] = pointAt(score, i);
        return <circle key={d.id} cx={x} cy={y} r={size === 'small' ? 2.5 : 3} className={`radar-point radar-point-${variant}`} />;
      })}
      {SCORE_DIMENSIONS.map((d, i) => {
        const [x, y] = labelPosition(i);
        const score = scoreSet?.[d.id]?.score ?? 0;
        return (
          <g key={d.id}>
            <text x={x} y={y - 4} className="radar-label" textAnchor="middle" dominantBaseline="middle">
              {d.label}
            </text>
            <text x={x} y={y + 9} className={`radar-score radar-score-${variant}`} textAnchor="middle" dominantBaseline="middle">
              {score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ScoresPanel({ scores, chartContainerRef }) {
  if (!scores || !scores.refined) return null;

  const roughAvg = averageScore(scores.rough);
  const refinedAvg = averageScore(scores.refined);
  const hasRough = scores.rough && roughAvg !== null;
  const lift = hasRough && refinedAvg !== null ? refinedAvg - roughAvg : null;

  return (
    <div className="scores">
      <div className="scores-header">
        <span className="scores-icon"><GaugeIcon /></span>
        <span className="scores-label">Quality score</span>
        <div className="scores-summary">
          {hasRough && (
            <>
              <span className="scores-summary-rough">{roughAvg.toFixed(1)}</span>
              <span className="scores-summary-arrow">→</span>
            </>
          )}
          <span className="scores-summary-refined">{refinedAvg.toFixed(1)}</span>
          <span className="scores-summary-max">/5</span>
          {lift !== null && lift > 0 && (
            <span className="scores-summary-lift">+{lift.toFixed(1)}</span>
          )}
        </div>
      </div>

      <div className="scores-charts" ref={chartContainerRef}>
        {hasRough && (
          <div className="scores-chart-block">
            <div className="scores-chart-caption">
              <span className="scores-chart-title scores-chart-title-rough">Your rough prompt</span>
              <span className="scores-chart-avg">{roughAvg.toFixed(1)}/5</span>
            </div>
            <RadarChart scoreSet={scores.rough} variant="rough" />
          </div>
        )}
        <div className="scores-chart-block">
          <div className="scores-chart-caption">
            <span className="scores-chart-title scores-chart-title-refined">Refined version</span>
            <span className="scores-chart-avg">{refinedAvg.toFixed(1)}/5</span>
          </div>
          <RadarChart scoreSet={scores.refined} variant="refined" />
        </div>
      </div>

      <ul className="scores-list">
        {SCORE_DIMENSIONS.map((d) => {
          const refined = scores.refined?.[d.id];
          const rough = scores.rough?.[d.id];
          if (!refined) return null;
          const dimLift = rough && typeof rough.score === 'number' && typeof refined.score === 'number'
            ? refined.score - rough.score
            : null;
          return (
            <li key={d.id} className="scores-item">
              <div className="scores-item-head">
                <span className="scores-item-label">{d.label}</span>
                <span className="scores-item-values">
                  {rough && typeof rough.score === 'number' && (
                    <>
                      <span className="scores-item-rough-val">{rough.score}</span>
                      <span className="scores-item-arrow">→</span>
                    </>
                  )}
                  <span className="scores-item-refined-val">{refined.score}</span>
                  <span className="scores-item-max">/5</span>
                  {dimLift !== null && dimLift > 0 && (
                    <span className="scores-item-lift">+{dimLift}</span>
                  )}
                </span>
              </div>
              {rough?.rationale && (
                <div className="scores-item-rationale-row">
                  <span className="scores-item-tag scores-item-tag-rough">Rough</span>
                  <span className="scores-item-rationale scores-item-rationale-rough">{rough.rationale}</span>
                </div>
              )}
              <div className="scores-item-rationale-row">
                <span className="scores-item-tag scores-item-tag-refined">Refined</span>
                <span className="scores-item-rationale">{refined.rationale}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Comparison strip ────────────────────────────────────── */

function CompareInvite({ primaryModel, onCompare, disabled }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const candidates = MODELS.filter((m) => m.available && m.id !== primaryModel);

  function toggle(modelId) {
    const next = new Set(selected);
    if (next.has(modelId)) next.delete(modelId);
    else next.add(modelId);
    setSelected(next);
  }

  function handleCompare() {
    if (selected.size === 0) return;
    onCompare([...selected]);
    setPickerOpen(false);
    setSelected(new Set());
  }

  return (
    <div className="compare-invite">
      <button
        className="compare-invite-btn"
        onClick={() => setPickerOpen(!pickerOpen)}
        disabled={disabled}
      >
        <CompareIcon />
        <span>Compare with other models</span>
        <span className={`compare-chevron ${pickerOpen ? 'open' : ''}`}><ChevronDownIcon /></span>
      </button>

      {pickerOpen && (
        <div className="compare-picker">
          <div className="compare-picker-label">
            Pick up to 3 models to compare against {modelShortName(primaryModel)}:
          </div>
          <div className="compare-picker-list">
            {candidates.map((m) => {
              const isSelected = selected.has(m.id);
              const disabledForLimit = !isSelected && selected.size >= 3;
              return (
                <button
                  key={m.id}
                  className={`compare-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggle(m.id)}
                  disabled={disabledForLimit}
                >
                  <div className="compare-picker-check">
                    {isSelected && <CheckIcon />}
                  </div>
                  <div className="compare-picker-name">
                    <span>{m.shortName}</span>
                    <span className="compare-picker-desc">{m.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="compare-picker-actions">
            <button
              className="text-btn"
              onClick={() => { setPickerOpen(false); setSelected(new Set()); }}
            >
              Cancel
            </button>
            <button
              className="compare-run-btn"
              onClick={handleCompare}
              disabled={selected.size === 0}
            >
              Run comparison ({selected.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonColumn({ column, onUseVersion }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const refinedAvg = averageScore(column.scores?.refined);
  const cost = column.usage ? computeCost(column.modelId, column.usage) : null;

  async function handleCopy() {
    await navigator.clipboard.writeText(column.refined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (column.error) {
    return (
      <div className="compare-col compare-col-error">
        <div className="compare-col-header">
          <span className="compare-col-model">{modelShortName(column.modelId)}</span>
        </div>
        <div className="compare-col-error-body">{column.error}</div>
      </div>
    );
  }

  if (!column.refined && !column.complete) {
    return <ComparisonColumnSkeleton modelId={column.modelId} />;
  }

  const isStreaming = !column.complete && column.refined;

  return (
    <div className="compare-col">
      <div className="compare-col-header">
        <span className="compare-col-model">{modelShortName(column.modelId)}</span>
        {refinedAvg !== null && (
          <span className="compare-col-score">{refinedAvg.toFixed(1)}/5</span>
        )}
        {isStreaming && <span className="streaming-pulse" />}
      </div>

      {column.refined && (
        <div className="compare-col-body">
          {column.refined}
          {isStreaming && <span className="caret" />}
        </div>
      )}

      {column.complete && column.scores?.refined && (
        <div className="compare-col-chart">
          <RadarChart scoreSet={column.scores.refined} variant="refined" size="small" />
        </div>
      )}

      {column.complete && (cost !== null || column.latencyMs) && (
        <div className="compare-col-meta">
          {cost !== null && <span className="compare-col-cost">{formatCost(cost)}</span>}
          {column.latencyMs && <span className="compare-col-latency">{formatLatency(column.latencyMs)}</span>}
        </div>
      )}

      {column.complete && (
        <div className="compare-col-actions">
          <button type="button" className="compare-col-action" onClick={handleCopy}>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {!column.isPrimary && (
            <button
              type="button"
              className="compare-col-action primary"
              onClick={() => onUseVersion(column)}
            >
              <span>Use this version</span>
            </button>
          )}
          {(column.changes?.length > 0 || column.scores) && (
            <button
              type="button"
              className="compare-col-action"
              onClick={() => setExpanded(!expanded)}
            >
              <span>{expanded ? 'Hide details' : 'Show details'}</span>
            </button>
          )}
        </div>
      )}

      {expanded && column.complete && (
        <div className="compare-col-details">
          {column.changes?.length > 0 && (
            <ol className="compare-col-changes">
              {column.changes.map((c, i) => (
                <li key={i}>
                  <div className="compare-col-change-title">{c.title}</div>
                  <div className="compare-col-change-text">{c.explanation}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonStrip({
  comparison, primaryModel, primaryRefined, primaryScores, primaryChanges,
  primaryUsage, primaryLatencyMs, onUseVersion, onClose, busy,
}) {
  if (!comparison) return null;

  const primaryColumn = {
    modelId: primaryModel,
    refined: primaryRefined,
    scores: primaryScores,
    changes: primaryChanges,
    usage: primaryUsage,
    latencyMs: primaryLatencyMs,
    complete: true,
    isPrimary: true,
  };

  const columns = [primaryColumn, ...comparison.columns];

  return (
    <div className="compare-strip">
      <div className="compare-strip-header">
        <span className="compare-strip-label">Model comparison</span>
        <span className="compare-strip-hint">
          Same rough prompt refined by {columns.length} models
        </span>
        <button
          className="abtest-close-btn compare-strip-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Close comparison results"
          title="Close comparison results"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="compare-grid" data-cols={columns.length}>
        {columns.map((column) => (
          <ComparisonColumn key={column.modelId} column={column} onUseVersion={onUseVersion} />
        ))}
      </div>
    </div>
  );
}

/* ── A/B Test panel ──────────────────────────────────────── */

function ABTestInvite({ disabled, onOpen, hasResults }) {
  return (
    <button
      type="button"
      className="abtest-invite-btn"
      onClick={onOpen}
      disabled={disabled}
    >
      {hasResults ? <EyeIcon /> : <PlayIcon />}
      <span>
        {hasResults ? 'View A/B test results' : 'Test this refined prompt (A/B vs rough)'}
      </span>
      <span className="abtest-chevron"><ChevronDownIcon /></span>
    </button>
  );
}

function ABTestPanel({
  roughPrompt, refinedPrompt, testModel, onClose, onRun, test, busy,
}) {
  const [mode, setMode] = useState('both');

  const handleRun = () => { onRun(mode); };

  const showResults = test && (test.rough?.text || test.refined?.text || test.rough?.complete || test.refined?.complete);

  return (
    <div className="abtest-panel">
      <div className="abtest-panel-head">
        <div>
          <div className="abtest-panel-label">A/B Test</div>
          <div className="abtest-panel-hint">
            Run the {mode === 'both' ? 'rough and refined prompts' : 'refined prompt'} through {modelShortName(testModel)} to see what the actual output looks like.
          </div>
        </div>
        <button
          className="abtest-close-btn"
          onClick={onClose}
          disabled={busy}
          aria-label="Close A/B test panel"
          title="Close panel (results are preserved)"
        >
          <CloseIcon />
        </button>
      </div>

      {!showResults && (
        <>
          <div className="abtest-mode-row">
            <button
              type="button"
              className={`abtest-mode-btn ${mode === 'both' ? 'active' : ''}`}
              onClick={() => setMode('both')}
              disabled={busy}
            >
              Run both (rough + refined)
            </button>
            <button
              type="button"
              className={`abtest-mode-btn ${mode === 'refined-only' ? 'active' : ''}`}
              onClick={() => setMode('refined-only')}
              disabled={busy}
            >
              Refined only
            </button>
          </div>

          <div className="abtest-cost-note">
            {mode === 'both'
              ? `Two API calls to ${modelShortName(testModel)}. Cost depends on output length.`
              : `One API call to ${modelShortName(testModel)}.`}
            {' '}You can change the test runner model in Settings.
          </div>

          <div className="abtest-actions">
            <button
              type="button"
              className="abtest-run-btn"
              onClick={handleRun}
              disabled={busy}
            >
              {busy ? 'Running…' : `Run test (${mode === 'both' ? '2' : '1'} call${mode === 'both' ? 's' : ''})`}
            </button>
          </div>
        </>
      )}

      {showResults && (
        <ABTestResults test={test} mode={test.mode} testModel={testModel} />
      )}
    </div>
  );
}

function ABTestResults({ test, mode, testModel }) {
  return (
    <div className="abtest-results">
      <div className="abtest-results-header">
        Output from <strong>{modelShortName(testModel)}</strong>. Compare side by side to decide if the refinement was worth it.
      </div>

      <div className={`abtest-results-grid ${mode === 'refined-only' ? 'single' : ''}`}>
        {mode === 'both' && (
          <ABTestColumn title="From rough prompt" variant="rough" result={test.rough} modelId={testModel} />
        )}
        <ABTestColumn title="From refined prompt" variant="refined" result={test.refined} modelId={testModel} />
      </div>
    </div>
  );
}

function ABTestColumn({ title, variant, result, modelId }) {
  const [copied, setCopied] = useState(false);
  const cost = result.usage ? computeCost(modelId, result.usage) : null;

  async function handleCopy() {
    if (!result.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={`abtest-col abtest-col-${variant}`}>
      <div className="abtest-col-head">
        <span className={`abtest-col-title abtest-col-title-${variant}`}>{title}</span>
        {!result.complete && result.text && <span className="streaming-pulse" />}
      </div>

      {result.error ? (
        <div className="abtest-col-error">{result.error}</div>
      ) : result.text ? (
        <div className="abtest-col-body">
          {result.text}
          {!result.complete && <span className="caret" />}
        </div>
      ) : (
        <div className="abtest-col-waiting">
          <span className="thinking-dots">
            <span className="thinking-dot"></span>
            <span className="thinking-dot"></span>
            <span className="thinking-dot"></span>
          </span>
          <span>Waiting for response…</span>
        </div>
      )}

      {result.complete && !result.error && (
        <div className="abtest-col-foot">
          <div className="abtest-col-meta">
            {cost !== null && <span className="abtest-col-cost">{formatCost(cost)}</span>}
            {result.latencyMs && <span className="abtest-col-latency">{formatLatency(result.latencyMs)}</span>}
          </div>
          <button type="button" className="abtest-col-copy" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

function FollowUpPanel({ disabled, onSubmit }) {
  const [feedback, setFeedback] = useState('');

  function handlePreset(preset) {
    if (disabled) return;
    onSubmit(preset.feedback);
  }

  function handleSubmit(e) {
    e?.preventDefault();
    if (disabled || !feedback.trim()) return;
    onSubmit(feedback.trim());
    setFeedback('');
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="followup">
      <div className="followup-header">
        <span className="followup-label">Refine further</span>
      </div>
      <div className="followup-presets">
        {FOLLOWUP_PRESETS.map((p) => (
          <button
            key={p.id}
            className="followup-preset"
            onClick={() => handlePreset(p)}
            disabled={disabled}
            title={p.feedback}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="followup-input-row">
        <input
          type="text"
          className="followup-input"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Or describe what to change..."
          disabled={disabled}
          maxLength={300}
        />
        <button
          className="followup-submit"
          onClick={handleSubmit}
          disabled={disabled || !feedback.trim()}
          aria-label="Apply feedback"
          title="Apply feedback"
        >
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

/* ── SSE stream consumers ────────────────────────────────── */

async function consumeSSE(response, handlers) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Server returned an error.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split('\n\n');
    buffer = messages.pop() || '';

    for (const message of messages) {
      if (!message.trim()) continue;
      const lines = message.split('\n');
      let eventName = 'message';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
      }
      if (!dataLine) continue;
      let payload;
      try { payload = JSON.parse(dataLine); }
      catch { continue; }
      handlers[eventName]?.(payload);
    }
  }
}

async function streamRefinement({ url, body, onChunk, onRefinedDone, onChanges, onScores, onDone, onError, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'refined-chunk': (p) => onChunk?.(p.text),
    'refined-done': () => onRefinedDone?.(),
    'changes': (p) => onChanges?.(p.changes || []),
    'scores': (p) => onScores?.(p.scores || null),
    'done': (p) => onDone?.(p),
    'error': (p) => onError?.(p.error || 'Unknown error'),
  });
}

async function streamComparison({ url, body, onStart, onModelChunk, onModelChanges, onModelScores, onModelDone, onModelError, onDone, onError, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'compare-start': (p) => onStart?.(p),
    'model-chunk': (p) => onModelChunk?.(p.modelId, p.text),
    'model-changes': (p) => onModelChanges?.(p.modelId, p.changes || []),
    'model-scores': (p) => onModelScores?.(p.modelId, p.scores || null),
    'model-done': (p) => onModelDone?.(p.modelId, p.usage, p.latencyMs),
    'model-error': (p) => onModelError?.(p.modelId, p.error),
    'compare-done': () => onDone?.(),
    'error': (p) => onError?.(p.error || 'Unknown error'),
  });
}

async function streamTest({ url, body, onChunk, onDone, onError, onComplete, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'test-start': () => { /* noop */ },
    'test-chunk': (p) => onChunk?.(p.id, p.text),
    'test-done': (p) => onDone?.(p.id, p.usage, p.latencyMs),
    'test-error': (p) => onError?.(p.id, p.error),
    'test-complete': () => onComplete?.(),
    'error': (p) => onError?.(null, p.error || 'Unknown error'),
  });
}

async function streamRunPrompt({ url, body, onChunk, onDone, onError, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'run-chunk': (p) => onChunk?.(p.text),
    'run-done': (p) => onDone?.(p),
    'run-error': (p) => onError?.(p.error || 'Run failed.'),
  });
}

/* ── App ─────────────────────────────────────────────────── */

function App() {
  const [roughPrompt, setRoughPrompt] = useState('');
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const [submittedFeedback, setSubmittedFeedback] = useState('');
  const [category, setCategory] = useState('general');
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const [changes, setChanges] = useState([]);
  const [scores, setScores] = useState(null);
  const [primaryModel, setPrimaryModel] = useState(DEFAULT_MODEL);
  const [primaryUsage, setPrimaryUsage] = useState(null);
  const [primaryLatencyMs, setPrimaryLatencyMs] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [refinedComplete, setRefinedComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [currentSavedId, setCurrentSavedId] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [usage, setUsage] = useState([]);
  const [lintHints, setLintHints] = useState([]);
  const [dismissedHints, setDismissedHints] = useState([]);
  const [piiFindings, setPiiFindings] = useState(null);
  const [piiPendingFeedback, setPiiPendingFeedback] = useState(null);
  const [abTestOpen, setAbTestOpen] = useState(false);
  const [abTest, setAbTest] = useState(null);
  const [abTesting, setAbTesting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), []);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Run Prompt panel state.
  // - currentConvo: the active conversation (null if none started yet)
  // - conversations: list of past conversations (excludes currentConvo)
  // - panelMode: 'conversation' or 'list'
  // - running: true while a turn is streaming
  // - convoDrawerOpen: whether the run drawer is currently open
  const [currentConvo, setCurrentConvo] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [panelMode, setPanelMode] = useState('conversation');
  const [running, setRunning] = useState(false);
  const [convoDrawerOpen, setConvoDrawerOpen] = useState(false);

  // Folders for saved prompts
  const [folders, setFolders] = useState([]);

  // Template variables modal
  const [templateVarsOpen, setTemplateVarsOpen] = useState(false);
  const [templateVarNames, setTemplateVarNames] = useState([]);
  const [templateVarValues, setTemplateVarValues] = useState({});
  const [templateVarsPendingFeedback, setTemplateVarsPendingFeedback] = useState(null);

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Prompt chain
  const [chainSteps, setChainSteps] = useState([]);
  const [chainRunning, setChainRunning] = useState(false);
  const chainAbortRef = useRef(null);

  // Multi-pass refinement
  const [multiPassEnabled, setMultiPassEnabled] = useState(false);
  const [multiPassCount, setMultiPassCount] = useState(3);
  const [multiPassCurrent, setMultiPassCurrent] = useState(0);

  const textareaRef = useRef(null);
  const conversationRef = useRef(null);
  const abortRef = useRef(null);
  const compareAbortRef = useRef(null);
  const testAbortRef = useRef(null);
  const runAbortRef = useRef(null);
  const lintTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionBaseRef = useRef('');
  const scoresChartRef = useRef(null);
  // Stores the desired pass count across the template-var / PII modal interruptions
  // so multi-pass is preserved even when those checks show a modal before executing.
  const pendingPassTotalRef = useRef(1);

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_HISTORY);
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); }
      catch { setHistory([]); }
    }
    const savedSettings = localStorage.getItem(STORAGE_SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch { setSettings(DEFAULT_SETTINGS); }
    }
    const savedStarred = localStorage.getItem(STORAGE_SAVED);
    if (savedStarred) {
      try { setSaved(JSON.parse(savedStarred)); }
      catch { setSaved([]); }
    }
    const savedUsage = localStorage.getItem(STORAGE_USAGE);
    if (savedUsage) {
      try { setUsage(JSON.parse(savedUsage)); }
      catch { setUsage([]); }
    }
    const savedConvo = localStorage.getItem(STORAGE_CURRENT_CONVO);
    if (savedConvo) {
      try { setCurrentConvo(JSON.parse(savedConvo)); }
      catch { setCurrentConvo(null); }
    }
    const savedConvos = localStorage.getItem(STORAGE_CONVERSATIONS);
    if (savedConvos) {
      try { setConversations(JSON.parse(savedConvos)); }
      catch { setConversations([]); }
    }
    const savedFolders = localStorage.getItem(STORAGE_FOLDERS);
    if (savedFolders) {
      try { setFolders(JSON.parse(savedFolders)); }
      catch { setFolders([]); }
    }
    const savedChain = localStorage.getItem(STORAGE_CHAIN);
    if (savedChain) {
      try { setChainSteps(JSON.parse(savedChain)); }
      catch { setChainSteps([]); }
    }
  }, []);

  useEffect(() => {
    if (currentConvo) {
      localStorage.setItem(STORAGE_CURRENT_CONVO, JSON.stringify(currentConvo));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_CONVO);
    }
  }, [currentConvo]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!importExportOpen) return;
    function onEsc(e) {
      if (e.key === 'Escape') setImportExportOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [importExportOpen]);

  useEffect(() => {
    if (!piiFindings) return;
    function onEsc(e) {
      if (e.key === 'Escape') {
        setPiiFindings(null);
        setPiiPendingFeedback(null);
      }
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [piiFindings]);

  useEffect(() => {
    if (!pdfModalOpen) return;
    function onEsc(e) {
      if (e.key === 'Escape') setPdfModalOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [pdfModalOpen]);

  useEffect(() => {
    if (!convoDrawerOpen) return;
    function onEsc(e) {
      if (e.key === 'Escape' && !running) setConvoDrawerOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [convoDrawerOpen, running]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  useEffect(() => { autoResize(); }, [roughPrompt]);

  useEffect(() => {
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    setDismissedHints([]);

    if (!settings.linterEnabled) {
      setLintHints([]);
      return;
    }
    if (!roughPrompt.trim()) {
      setLintHints([]);
      return;
    }
    lintTimerRef.current = setTimeout(() => {
      setLintHints(lintPrompt(roughPrompt));
    }, 400);
    return () => {
      if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    };
  }, [roughPrompt, settings.linterEnabled]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  function updateSettings(partial) {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(updated));
  }

  function resetSettings() {
    if (!confirm('Reset settings to defaults?')) return;
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }

  function recordUsage({ model, usage: u, latencyMs, kind }) {
    if (!u || (u.inputTokens === 0 && u.outputTokens === 0)) return;
    const cost = computeCost(model, u);
    const record = {
      timestamp: Date.now(),
      model,
      inputTokens: u.inputTokens || 0,
      outputTokens: u.outputTokens || 0,
      costUSD: cost,
      latencyMs: latencyMs || null,
      kind: kind || 'refinement',
    };
    setUsage((prev) => {
      const next = [record, ...prev].slice(0, MAX_USAGE_RECORDS);
      localStorage.setItem(STORAGE_USAGE, JSON.stringify(next));
      return next;
    });
  }

  function clearUsage() {
    if (!confirm('Reset all usage tracking? This cannot be undone.')) return;
    setUsage([]);
    localStorage.removeItem(STORAGE_USAGE);
  }

  function saveToHistory(entry) {
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
  }

  function clearHistory() {
    if (!confirm('Clear all history?')) return;
    setHistory([]);
    localStorage.removeItem(STORAGE_HISTORY);
  }

  function deleteHistoryEntry(timestamp) {
    const updated = history.filter(e => e.timestamp !== timestamp);
    setHistory(updated);
    if (updated.length === 0) {
      localStorage.removeItem(STORAGE_HISTORY);
    } else {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
    }
  }

  function clearCurrentRefinement() {
    setImprovedPrompt('');
    setChanges([]);
    setScores(null);
    setPrimaryUsage(null);
    setPrimaryLatencyMs(null);
    setComparison(null);
    setRefinedComplete(false);
    setCurrentSavedId(null);
    setAbTest(null);
    setAbTestOpen(false);
  }

  function loadFromHistory(entry) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt('');
    setSubmittedPrompt(entry.rough);
    setSubmittedFeedback(entry.feedback || '');
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setScores(entry.scores || null);
    setPrimaryModel(entry.model || DEFAULT_MODEL);
    setPrimaryUsage(entry.usage || null);
    setPrimaryLatencyMs(entry.latencyMs || null);
    setComparison(entry.comparison || null);
    setRefinedComplete(true);
    setError('');
    setCurrentSavedId(null);
    setAbTest(null);
    setAbTestOpen(false);
    setActiveView(null); // navigate back to refinery view
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function loadFromTemplate(template) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt(template.rough);
    setSubmittedPrompt('');
    setSubmittedFeedback('');
    setCategory(template.category);
    clearCurrentRefinement();
    setError('');
    setActiveView(null);
    setTimeout(() => { textareaRef.current?.focus(); }, 250);
  }

  function loadFromSaved(entry) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt('');
    setSubmittedPrompt(entry.rough);
    setSubmittedFeedback('');
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setScores(entry.scores || null);
    setPrimaryModel(entry.model || DEFAULT_MODEL);
    setPrimaryUsage(entry.usage || null);
    setPrimaryLatencyMs(entry.latencyMs || null);
    setComparison(entry.comparison || null);
    setRefinedComplete(true);
    setError('');
    setCurrentSavedId(entry.id);
    setAbTest(null);
    setAbTestOpen(false);
    setActiveView(null); // navigate back to refinery view
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function persistSaved(next) {
    setSaved(next);
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(next));
  }

  function toggleSaveCurrent() {
    if (!improvedPrompt || !refinedComplete) return;
    if (currentSavedId) {
      const next = saved.filter((s) => s.id !== currentSavedId);
      persistSaved(next);
      setCurrentSavedId(null);
      return;
    }
    const newEntry = {
      id: makeId(),
      name: '',
      rough: submittedPrompt,
      improved: improvedPrompt,
      changes,
      scores,
      category,
      model: primaryModel,
      usage: primaryUsage,
      latencyMs: primaryLatencyMs,
      comparison,
      savedAt: Date.now(),
    };
    persistSaved([newEntry, ...saved]);
    setCurrentSavedId(newEntry.id);
  }

  function renameSaved(id, newName) {
    const next = saved.map((s) => (s.id === id ? { ...s, name: newName } : s));
    persistSaved(next);
  }

  function removeSaved(id) {
    if (!confirm('Remove this saved prompt?')) return;
    const next = saved.filter((s) => s.id !== id);
    persistSaved(next);
    if (currentSavedId === id) setCurrentSavedId(null);
  }

  /* ── Folder management ───────────────────────────────── */

  function persistFolders(next) {
    setFolders(next);
    localStorage.setItem(STORAGE_FOLDERS, JSON.stringify(next));
  }

  function addFolder(name) {
    const f = { id: makeId(), name, createdAt: Date.now() };
    persistFolders([...folders, f]);
  }

  function renameFolder(id, name) {
    persistFolders(folders.map(f => f.id === id ? { ...f, name } : f));
  }

  function deleteFolder(id) {
    if (!confirm('Delete this folder? Prompts inside will move to Uncategorized.')) return;
    persistFolders(folders.filter(f => f.id !== id));
    persistSaved(saved.map(s => s.folderId === id ? { ...s, folderId: null } : s));
  }

  function moveSavedToFolder(entryId, folderId) {
    persistSaved(saved.map(s => s.id === entryId ? { ...s, folderId: folderId || null } : s));
  }

  /* ── Re-refine from history ──────────────────────────── */

  function reRefineFromHistory(entry) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt(entry.rough);
    setCategory(entry.category);
    clearCurrentRefinement();
    setSubmittedPrompt('');
    setError('');
    setActiveView(null);
    setTimeout(() => textareaRef.current?.focus(), 250);
  }

  /* ── Template variables ──────────────────────────────── */

  function handleTemplateVarsContinue() {
    const filledPrompt = fillVariables(roughPrompt, templateVarValues);
    setRoughPrompt(filledPrompt);
    setTemplateVarsOpen(false);
    setTemplateVarNames([]);
    setTemplateVarValues({});
    const feedback = templateVarsPendingFeedback;
    setTemplateVarsPendingFeedback(null);
    // Proceed with the filled prompt
    setTimeout(() => runRefinement({ feedback, overridePrompt: filledPrompt }), 0);
  }

  function handleTemplateVarsCancel() {
    setTemplateVarsOpen(false);
    setTemplateVarNames([]);
    setTemplateVarValues({});
    setTemplateVarsPendingFeedback(null);
  }

  function updateTemplateVarValue(name, value) {
    setTemplateVarValues(prev => ({ ...prev, [name]: value }));
  }

  /* ── Share prompt ────────────────────────────────────── */

  async function handleShare() {
    if (!improvedPrompt || !refinedComplete) return;
    try {
      const res = await fetch(`${API_URL}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rough: submittedPrompt,
          improved: improvedPrompt,
          changes,
          scores,
          category,
          model: primaryModel,
        }),
      });
      const data = await res.json();
      if (data.url) {
        setShareUrl(data.url);
        setShareModalOpen(true);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  /* ── Prompt chain ────────────────────────────────────── */

  function updateChainSteps(steps) {
    setChainSteps(steps);
    localStorage.setItem(STORAGE_CHAIN, JSON.stringify(steps));
  }

  async function runChain() {
    if (chainRunning || !chainSteps.every(s => s.prompt.trim())) return;
    setChainRunning(true);

    const controller = new AbortController();
    chainAbortRef.current = controller;

    // Reset all step outputs
    const working = chainSteps.map(s => ({ ...s, output: '', status: 'idle' }));
    updateChainSteps(working);

    let previousOutput = '';

    for (let i = 0; i < working.length; i++) {
      if (controller.signal.aborted) break;

      // Mark as running
      working[i] = { ...working[i], status: 'running' };
      updateChainSteps([...working]);

      const prompt = previousOutput
        ? working[i].prompt.replace(/\{\{previous_output\}\}/g, previousOutput)
        : working[i].prompt;

      let stepOutput = '';
      try {
        const response = await fetch(`${API_URL}/api/run-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            model: settings.testModel,
          }),
          signal: controller.signal,
        });

        await consumeSSE(response, {
          'run-chunk': (p) => {
            stepOutput += p.text;
            working[i] = { ...working[i], output: stepOutput };
            updateChainSteps([...working]);
          },
          'run-done': () => {},
          'run-error': (p) => { throw new Error(p.error || 'Run failed'); },
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          working[i] = { ...working[i], status: 'error', output: `Error: ${err.message}` };
          updateChainSteps([...working]);
          break;
        }
      }

      previousOutput = stepOutput;
      working[i] = { ...working[i], status: 'done' };
      updateChainSteps([...working]);
    }

    setChainRunning(false);
    chainAbortRef.current = null;
  }

  // Left rail icon click. The "conversations" item opens the right-side
  // run drawer; all others toggle the left-side drawer view.
  function toggleView(id) {
    if (id === 'conversations') {
      const opening = !convoDrawerOpen;
      setConvoDrawerOpen(opening);
      if (opening) setPanelMode('conversation');
      return;
    }
    setActiveView(activeView === id ? null : id);
  }

  function toggleSidebar() {
    setRailExpanded(v => !v);
  }

  function handleNewPrompt() {
    setActiveView(null);
    setConvoDrawerOpen(false);
    setRoughPrompt('');
    setSubmittedPrompt('');
    setSubmittedFeedback('');
    setError('');
    clearCurrentRefinement();
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  function handleImport(importedHistory, importedSaved) {
    if (importedHistory.length > 0) {
      const next = [...history, ...importedHistory].slice(0, MAX_HISTORY);
      setHistory(next);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(next));
    }
    if (importedSaved.length > 0) {
      const next = [...saved, ...importedSaved];
      persistSaved(next);
    }
  }

  function dismissLintHint(hintId) {
    setDismissedHints((prev) => [...prev, hintId]);
  }

  function startRecording() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition not supported in this browser.');
      return;
    }
    if (isRecording) return;

    setVoiceError('');
    recognitionBaseRef.current = roughPrompt.trim() ? roughPrompt.trimEnd() + ' ' : '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let allText = '';
      for (let i = 0; i < event.results.length; i++) {
        allText += event.results[i][0].transcript;
      }
      setRoughPrompt(recognitionBaseRef.current + allText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setVoiceError('Microphone access denied. Enable it in your browser settings.');
      } else if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Try again, closer to the microphone.');
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone found. Check your audio devices.');
      } else if (event.error === 'network') {
        setVoiceError('Speech recognition needs an internet connection.');
      } else if (event.error === 'aborted') {
        /* noop */
      } else {
        setVoiceError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setVoiceError('Could not start microphone. Try again.');
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
    setIsRecording(false);
  }

  function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  async function executeRefinement({ feedback = null, overridePrompt = null, passNum = 1, passTotal = 1 } = {}) {
    const sourcePrompt = overridePrompt || (feedback ? submittedPrompt : roughPrompt);
    if (!sourcePrompt.trim() || streaming || comparing) return;

    if (isRecording) stopRecording();

    setLoading(true);
    setStreaming(true);
    setError('');
    setRefinedComplete(false);
    setCopied(false);
    setCurrentSavedId(null);
    setComparison(null);
    setPrimaryUsage(null);
    setPrimaryLatencyMs(null);
    setAbTest(null);
    setAbTestOpen(false);
    if (passTotal > 1) setMultiPassCurrent(passNum);

    const previousRefined = feedback ? improvedPrompt : null;

    if (feedback) {
      setSubmittedFeedback(feedback);
    } else {
      setSubmittedPrompt(overridePrompt || roughPrompt);
      setSubmittedFeedback('');
      if (!overridePrompt) setRoughPrompt('');
    }

    setImprovedPrompt('');
    setChanges([]);
    setScores(null);
    setPrimaryModel(settings.model);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build active dimensions list for the backend
    const removedSet = new Set(settings.removedDimensions || []);
    const activeDimensions = [
      ...SCORE_DIMENSIONS.filter(d => !removedSet.has(d.id)),
      ...(settings.customDimensions || []),
    ];

    let accumulatedRefined = '';
    let accumulatedChanges = [];
    let accumulatedScores = null;
    let accumulatedUsage = null;
    let accumulatedLatency = null;

    try {
      await streamRefinement({
        url: `${API_URL}/api/improve`,
        body: {
          prompt: sourcePrompt,
          category,
          model: settings.model,
          previousRefined: previousRefined || undefined,
          feedback: feedback || undefined,
          dimensions: activeDimensions.length !== SCORE_DIMENSIONS.length ? activeDimensions : undefined,
        },
        signal: controller.signal,
        onChunk: (text) => {
          if (loading) setLoading(false);
          accumulatedRefined += text;
          setImprovedPrompt(accumulatedRefined);
        },
        onRefinedDone: () => { setRefinedComplete(true); },
        onChanges: (received) => {
          accumulatedChanges = received;
          setChanges(received);
        },
        onScores: (received) => {
          accumulatedScores = received;
          setScores(received);
        },
        onDone: (payload) => {
          if (payload?.usage) {
            accumulatedUsage = payload.usage;
            setPrimaryUsage(payload.usage);
          }
          if (payload?.latencyMs) {
            accumulatedLatency = payload.latencyMs;
            setPrimaryLatencyMs(payload.latencyMs);
          }
          if (accumulatedRefined) {
            saveToHistory({
              rough: sourcePrompt,
              improved: accumulatedRefined,
              changes: accumulatedChanges,
              scores: accumulatedScores,
              category,
              model: settings.model,
              usage: accumulatedUsage,
              latencyMs: accumulatedLatency,
              timestamp: Date.now(),
              isFollowUp: Boolean(feedback),
              feedback: feedback || undefined,
            });
            recordUsage({
              model: settings.model,
              usage: accumulatedUsage,
              latencyMs: accumulatedLatency,
              kind: feedback ? 'follow-up' : 'refinement',
            });
          }
        },
        onError: (msg) => { setError(msg); },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong. Is the backend running?');
        console.error(err);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      setRefinedComplete(true);
      abortRef.current = null;

      // Multi-pass: if more passes remain, run the next pass with the refined output
      if (passTotal > 1 && passNum < passTotal && accumulatedRefined && !controller.signal.aborted) {
        setTimeout(() => {
          executeRefinement({
            overridePrompt: accumulatedRefined,
            passNum: passNum + 1,
            passTotal,
          });
        }, 300);
      } else if (passTotal > 1) {
        setMultiPassCurrent(0);
      }
    }
  }

  async function runRefinement({ feedback = null, overridePrompt = null } = {}) {
    const sourcePrompt = overridePrompt || (feedback ? submittedPrompt : roughPrompt);
    if (!sourcePrompt.trim() || streaming || comparing) return;

    // Check for template variables (only on initial submit, not follow-ups)
    if (!feedback && !overridePrompt) {
      const vars = extractVariables(sourcePrompt);
      if (vars.length > 0) {
        setTemplateVarNames(vars);
        setTemplateVarValues({});
        setTemplateVarsPendingFeedback(feedback);
        setTemplateVarsOpen(true);
        return;
      }
    }

    if (settings.piiScannerEnabled) {
      const findings = scanForPII(sourcePrompt);
      if (findings.length > 0) {
        setPiiFindings(findings);
        setPiiPendingFeedback(feedback);
        return;
      }
    }

    // For follow-ups, multi-pass doesn't apply (passTotal = 1).
    // For initial submits (including post-template-var continuation),
    // carry through the pass count the user chose when they hit Refine.
    const passTotal = feedback ? 1 : pendingPassTotalRef.current;
    executeRefinement({ feedback, overridePrompt, passNum: 1, passTotal });
  }

  function handlePIIContinue() {
    const feedback = piiPendingFeedback;
    setPiiFindings(null);
    setPiiPendingFeedback(null);
    // Preserve the pass count that was set when the user clicked Refine.
    const passTotal = feedback ? 1 : pendingPassTotalRef.current;
    executeRefinement({ feedback, passNum: 1, passTotal });
  }

  function handlePIICancel() {
    setPiiFindings(null);
    setPiiPendingFeedback(null);
  }

  async function runComparison(modelIds) {
    if (!submittedPrompt.trim() || comparing || streaming) return;

    setComparing(true);
    setError('');

    const initialColumns = modelIds.map((modelId) => ({
      modelId, refined: '', changes: [], scores: null,
      usage: null, latencyMs: null, complete: false, error: null,
    }));
    setComparison({ columns: initialColumns });

    const controller = new AbortController();
    compareAbortRef.current = controller;

    let workingColumns = [...initialColumns];

    function updateColumn(modelId, updates) {
      workingColumns = workingColumns.map((col) =>
        col.modelId === modelId ? { ...col, ...updates } : col
      );
      setComparison({ columns: workingColumns });
    }

    try {
      await streamComparison({
        url: `${API_URL}/api/improve-compare`,
        body: { prompt: submittedPrompt, category, models: modelIds },
        signal: controller.signal,
        onStart: () => { /* noop */ },
        onModelChunk: (modelId, text) => {
          const col = workingColumns.find((c) => c.modelId === modelId);
          if (col) updateColumn(modelId, { refined: col.refined + text });
        },
        onModelChanges: (modelId, modelChanges) => updateColumn(modelId, { changes: modelChanges }),
        onModelScores: (modelId, modelScores) => updateColumn(modelId, { scores: modelScores }),
        onModelDone: (modelId, modelUsage, modelLatencyMs) => {
          updateColumn(modelId, {
            complete: true,
            usage: modelUsage || null,
            latencyMs: modelLatencyMs || null,
          });
          if (modelUsage) {
            recordUsage({ model: modelId, usage: modelUsage, latencyMs: modelLatencyMs, kind: 'comparison' });
          }
        },
        onModelError: (modelId, errMsg) => updateColumn(modelId, { error: errMsg, complete: true }),
        onDone: () => {
          setHistory((current) => {
            const updated = [...current];
            if (updated.length > 0) {
              updated[0] = { ...updated[0], comparison: { columns: workingColumns } };
              localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
            }
            return updated;
          });
        },
        onError: (msg) => { setError(msg); },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Comparison failed.');
        console.error(err);
      }
    } finally {
      setComparing(false);
      compareAbortRef.current = null;
    }
  }

  function useComparisonVersion(column) {
    if (!column?.refined) return;
    setImprovedPrompt(column.refined);
    setChanges(column.changes || []);
    setScores(column.scores || null);
    setPrimaryModel(column.modelId);
    setPrimaryUsage(column.usage || null);
    setPrimaryLatencyMs(column.latencyMs || null);
    setComparison(null);
    setCurrentSavedId(null);
  }

  function closeComparison() {
    if (compareAbortRef.current) compareAbortRef.current.abort();
    setComparison(null);
  }

  async function runABTest(mode) {
    if (!improvedPrompt || abTesting) return;
    setAbTesting(true);

    const initialTest = {
      mode,
      rough: { text: '', complete: false, error: null, usage: null, latencyMs: null },
      refined: { text: '', complete: false, error: null, usage: null, latencyMs: null },
    };
    setAbTest(initialTest);

    const prompts = [];
    if (mode === 'both') prompts.push({ id: 'rough', prompt: submittedPrompt });
    prompts.push({ id: 'refined', prompt: improvedPrompt });
    if (mode === 'refined-only') initialTest.rough = null;

    const controller = new AbortController();
    testAbortRef.current = controller;

    let working = { ...initialTest };

    function updateResult(id, updates) {
      working = { ...working, [id]: { ...(working[id] || {}), ...updates } };
      setAbTest(working);
    }

    try {
      await streamTest({
        url: `${API_URL}/api/test-prompt`,
        body: { prompts, model: settings.testModel },
        signal: controller.signal,
        onChunk: (id, text) => {
          const current = working[id] || {};
          updateResult(id, { text: (current.text || '') + text });
        },
        onDone: (id, u, latencyMs) => {
          updateResult(id, { complete: true, usage: u || null, latencyMs: latencyMs || null });
          if (u) {
            recordUsage({ model: settings.testModel, usage: u, latencyMs, kind: `test-${id}` });
          }
        },
        onError: (id, errMsg) => {
          if (id) updateResult(id, { complete: true, error: errMsg });
          else console.error('Test stream error:', errMsg);
        },
        onComplete: () => { /* noop */ },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setAbTest((prev) => prev ? { ...prev, fatalError: err.message } : null);
      }
    } finally {
      setAbTesting(false);
      testAbortRef.current = null;
    }
  }

  function closeABTest() {
    if (testAbortRef.current) testAbortRef.current.abort();
    setAbTestOpen(false);
  }

  function openABTest() {
    setAbTestOpen(true);
    if (!abTest) setAbTest(null);
  }

  /* ── Conversation lifecycle ──────────────────────────────── */

  // Archive the current conversation into the conversations list.
  function archiveCurrent(workingConvo) {
    if (!workingConvo || !workingConvo.messages?.length) return conversations;
    const toArchive = { ...workingConvo, lastUsedAt: Date.now() };
    const withoutDupe = conversations.filter((c) => c.id !== toArchive.id);
    const next = [toArchive, ...withoutDupe].slice(0, MAX_CONVERSATIONS);
    setConversations(next);
    return next;
  }

  function openRunDrawerWithRefined() {
    if (!improvedPrompt || !refinedComplete) return;

    archiveCurrent(currentConvo);

    const initialUserMsg = {
      id: makeId(),
      role: 'user',
      content: improvedPrompt,
      timestamp: Date.now(),
    };
    const newConvo = {
      id: makeId(),
      title: '',
      startedAt: Date.now(),
      lastUsedAt: Date.now(),
      model: settings.testModel,
      messages: [initialUserMsg],
    };
    setCurrentConvo(newConvo);
    setConvoDrawerOpen(true);
    setPanelMode('conversation');
    runAssistantTurn(newConvo);
  }

  function startNewRunConversation() {
    if (running) return;
    archiveCurrent(currentConvo);
    setCurrentConvo(null);
    setPanelMode('conversation');
  }

  function sendRunMessage(text) {
    if (!text.trim() || running) return;

    const userMsg = {
      id: makeId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    let workingConvo;
    if (!currentConvo) {
      workingConvo = {
        id: makeId(),
        title: '',
        startedAt: Date.now(),
        lastUsedAt: Date.now(),
        model: settings.testModel,
        messages: [userMsg],
      };
    } else {
      workingConvo = {
        ...currentConvo,
        lastUsedAt: Date.now(),
        messages: [...(currentConvo.messages || []), userMsg],
      };
    }
    setCurrentConvo(workingConvo);
    runAssistantTurn(workingConvo);
  }

  async function runAssistantTurn(convo) {
    if (running) return;
    setRunning(true);

    const assistantMsg = {
      id: makeId(),
      role: 'assistant',
      content: '',
      model: settings.testModel,
      streaming: true,
      complete: false,
      timestamp: Date.now(),
    };

    let workingConvo = {
      ...convo,
      messages: [...convo.messages, assistantMsg],
    };
    setCurrentConvo(workingConvo);

    const controller = new AbortController();
    runAbortRef.current = controller;

    const apiMessages = convo.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.content && m.content.trim() !== '')
      .map((m) => ({ role: m.role, content: m.content }));

    let accumulated = '';
    let finalUsage = null;
    let finalLatency = null;
    let receivedError = null;

    try {
      await streamRunPrompt({
        url: `${API_URL}/api/run-prompt`,
        body: { messages: apiMessages, model: settings.testModel },
        signal: controller.signal,
        onChunk: (text) => {
          accumulated += text;
          workingConvo = {
            ...workingConvo,
            messages: workingConvo.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: accumulated } : m
            ),
          };
          setCurrentConvo(workingConvo);
        },
        onDone: (payload) => {
          if (payload?.usage) finalUsage = payload.usage;
          if (payload?.latencyMs) finalLatency = payload.latencyMs;
        },
        onError: (msg) => { receivedError = msg; },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Run-prompt error:', err);
        receivedError = err.message || 'Run failed.';
      }
    } finally {
      const cost = finalUsage ? computeCost(settings.testModel, finalUsage) : null;
      const firstUserMsg = workingConvo.messages.find((m) => m.role === 'user');
      const generatedTitle = workingConvo.title || autoTitle(firstUserMsg?.content || '');

      workingConvo = {
        ...workingConvo,
        title: generatedTitle,
        lastUsedAt: Date.now(),
        messages: workingConvo.messages.map((m) => {
          if (m.id !== assistantMsg.id) return m;
          return {
            ...m,
            content: accumulated,
            streaming: false,
            complete: true,
            error: receivedError || null,
            usage: finalUsage,
            latencyMs: finalLatency,
            cost,
          };
        }),
      };
      setCurrentConvo(workingConvo);

      if (finalUsage) {
        recordUsage({ model: settings.testModel, usage: finalUsage, latencyMs: finalLatency, kind: 'run' });
      }

      setRunning(false);
      runAbortRef.current = null;
    }
  }

  function stopRun() {
    if (runAbortRef.current) runAbortRef.current.abort();
  }

  function loadConversation(convo) {
    if (running) return;
    if (currentConvo && currentConvo.id !== convo.id && currentConvo.messages?.length > 0) {
      archiveCurrent(currentConvo);
    }
    setConversations(conversations.filter((c) => c.id !== convo.id));
    setCurrentConvo({ ...convo, lastUsedAt: Date.now() });
    setPanelMode('conversation');
  }

  function renameConversation(id, newTitle) {
    if (!newTitle?.trim()) return;
    if (currentConvo?.id === id) {
      setCurrentConvo({ ...currentConvo, title: newTitle });
    } else {
      setConversations(conversations.map((c) =>
        c.id === id ? { ...c, title: newTitle } : c
      ));
    }
  }

  function removeConversation(id) {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    if (currentConvo?.id === id) {
      setCurrentConvo(null);
    } else {
      setConversations(conversations.filter((c) => c.id !== id));
    }
  }

  function clearAllConversations() {
    if (conversations.length === 0) return;
    if (!confirm(`Delete all ${conversations.length} past conversations? This cannot be undone. (Your current conversation will be kept.)`)) return;
    setConversations([]);
  }

  function showConversationList() {
    setPanelMode('list');
  }

  function showCurrentConversation() {
    setPanelMode('conversation');
  }

  /* ── Other handlers ──────────────────────────────────────── */

  function handleImprove() {
    // Always route through runRefinement so template-variable and PII checks
    // run first, even when multi-pass is on.
    pendingPassTotalRef.current = multiPassEnabled && multiPassCount > 1 ? multiPassCount : 1;
    runRefinement();
  }
  function handleFollowUp(feedback) { runRefinement({ feedback }); }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort();
    if (compareAbortRef.current) compareAbortRef.current.abort();
    if (testAbortRef.current) testAbortRef.current.abort();
    if (chainAbortRef.current) chainAbortRef.current.abort();
    setMultiPassCurrent(0);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(improvedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleImprove();
    }
  }

  function openPDFExport() { setPdfModalOpen(true); }
  function closePDFExport() { setPdfModalOpen(false); }

  const showEmpty = !improvedPrompt && !submittedPrompt && !loading && !error && !streaming;
  const isSaved = Boolean(currentSavedId);
  const busy = streaming || comparing || abTesting;
  const isRefinementInProgress = Boolean(submittedPrompt) && !error && !comparing;
  const showChangesSkeleton = isRefinementInProgress && Boolean(improvedPrompt) && changes.length === 0;
  const showScoresSkeleton = isRefinementInProgress && Boolean(improvedPrompt) && !scores;

  const refinementReady = Boolean(improvedPrompt) && refinedComplete && !busy && changes.length > 0 && scores !== null;
  const showFollowUp = refinementReady && !abTestOpen;
  const showCompareInvite = refinementReady && !comparison;
  const showABTestInvite = refinementReady && !abTestOpen;

  const hasABTestResults = Boolean(abTest && (abTest.rough?.complete || abTest.refined?.complete));

  const showLintHints = settings.linterEnabled && !busy && lintHints.length > 0;
  const showMicButton = speechSupported && settings.voiceEnabled;
  const canExportPDF = Boolean(improvedPrompt) && refinedComplete && !busy && changes.length > 0 && scores !== null;
  const canRunPrompt = refinementReady;

  const primaryCost = primaryUsage ? computeCost(primaryModel, primaryUsage) : null;

  // Badge on the Conversations icon if a run is streaming and the panel isn't open.
  const showConversationsBadge = running && !convoDrawerOpen;

  // Group recent history by date for the sidebar recent list.
  const groupedRecents = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgo = todayStart - 7 * 86400000;
    const groups = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Previous 7 days', items: [] },
    ];
    history.slice(0, 20).forEach(entry => {
      const t = new Date(entry.timestamp);
      const day = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      if (day >= todayStart) groups[0].items.push(entry);
      else if (day >= yesterdayStart) groups[1].items.push(entry);
      else if (day >= sevenDaysAgo) groups[2].items.push(entry);
    });
    return groups.filter(g => g.items.length > 0);
  })();

  return (
    <div className="shell">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <nav className={`sidebar ${railExpanded ? 'expanded' : 'collapsed'}`}>

        {/* Header: logo + collapse toggle */}
        <div className="sidebar-header">
          {railExpanded && (
            <div className="sidebar-logo">
              <div className="sidebar-logo-mark">
                <FunnelLogo />
              </div>
              <div className="sidebar-logo-text">
                <div className="sidebar-logo-name">Prompt Refinery</div>
              </div>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={railExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={railExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <SidebarIcon />
          </button>
        </div>

        {/* New rough prompt — mirrors claude.ai's "New chat" button */}
        <div className="sidebar-new-wrap">
          <button
            className="sidebar-new-btn"
            onClick={handleNewPrompt}
            title="New rough prompt"
            aria-label="New rough prompt"
          >
            <span className="sidebar-new-icon"><PlusIcon /></span>
            {railExpanded && <span className="sidebar-new-label">New rough prompt</span>}
          </button>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav">
          {LEFT_RAIL_ITEMS.map((item) => {
            const Icon = item.icon;
            const isConversationsItem = item.id === 'conversations';
            const isActive = isConversationsItem ? convoDrawerOpen : activeView === item.id;
            const showBadge = isConversationsItem && showConversationsBadge;
            return (
              <button
                key={item.id}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => toggleView(item.id)}
                aria-label={item.label}
                title={!railExpanded ? item.label : undefined}
              >
                <span className="sidebar-item-icon">
                  <Icon />
                  {showBadge && <span className="rail-btn-badge" />}
                </span>
                {railExpanded && (
                  <span className="sidebar-item-label">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent refinements — only shown when expanded and history exists */}
        {railExpanded && groupedRecents.length > 0 && (
          <div className="sidebar-recents">
            {groupedRecents.map(group => (
              <div key={group.label}>
                <div className="sidebar-recents-date">{group.label}</div>
                {group.items.map(entry => (
                  <div key={entry.timestamp} className="sidebar-recent-row">
                    <button
                      className="sidebar-recent-item"
                      onClick={() => loadFromHistory(entry)}
                      title={entry.rough}
                    >
                      {entry.rough.length > 38
                        ? entry.rough.slice(0, 38).trimEnd() + '…'
                        : entry.rough}
                    </button>
                    <button
                      className="sidebar-recent-delete"
                      onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.timestamp); }}
                      title="Remove from history"
                      aria-label="Remove from history"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* ── Main area ───────────────────────────────────────── */}
      <main className="main">
        {activeView !== null ? (
          /* Panel view: replaces refinery when a nav item is active */
          <div className="panel-page">
            {activeView === 'history' && (
              <HistoryView
                history={history}
                onLoad={loadFromHistory}
                onReRefine={reRefineFromHistory}
                onClear={clearHistory}
                onOpenImportExport={() => setImportExportOpen(true)}
              />
            )}
            {activeView === 'saved' && (
              <SavedView
                saved={saved}
                folders={folders}
                onLoad={loadFromSaved}
                onRename={renameSaved}
                onRemove={removeSaved}
                onMoveToFolder={moveSavedToFolder}
                onAddFolder={addFolder}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
              />
            )}
            {activeView === 'templates' && <TemplatesView onSelect={loadFromTemplate} />}
            {activeView === 'analytics' && <AnalyticsView history={history} />}
            {activeView === 'chain' && (
              <ChainView
                chainSteps={chainSteps}
                onUpdateSteps={updateChainSteps}
                onRunChain={runChain}
                chainRunning={chainRunning}
                testModel={settings.testModel}
              />
            )}
            {activeView === 'usage' && <UsageView usage={usage} onClear={clearUsage} />}
            {activeView === 'help' && <HelpView />}
            {activeView === 'settings' && (
              <SettingsView
                settings={settings}
                onChange={updateSettings}
                onReset={resetSettings}
                speechSupported={speechSupported}
              />
            )}
          </div>
        ) : (
          /* Refinery view: shown when no panel is active */
          <>
            <div className="conversation" ref={conversationRef}>
          <div className="conversation-inner">
            {showEmpty && (
              <div className="empty-state">
                <h2>What can I help you refine?</h2>
                <p>Type a rough prompt below, or pick a template from the sidebar.</p>
              </div>
            )}

            {submittedPrompt && (
              <RoughPromptMessage text={submittedPrompt} category={category} isFollowUp={false} />
            )}

            {submittedFeedback && (
              <RoughPromptMessage text={submittedFeedback} category={null} isFollowUp={true} />
            )}

            {loading && !improvedPrompt && (
              <div className="message">
                <div className="message-header">
                  <span className="message-label">Refined prompt</span>
                </div>
                <div className="thinking-block">
                  <span className="thinking-dots">
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                  </span>
                  Refining prompt…
                </div>
              </div>
            )}

            {improvedPrompt && (
              <div className="message">
                <div className="message-header">
                  <span className="message-label">
                    Refined prompt
                    <span className="primary-model-tag">{modelShortName(primaryModel)}</span>
                    {primaryCost !== null && (
                      <span className="primary-cost-tag" title="Estimated cost based on token usage">
                        {formatCost(primaryCost)}
                      </span>
                    )}
                    {primaryLatencyMs !== null && (
                      <span className="primary-latency-tag" title="Time to complete this refinement">
                        {formatLatency(primaryLatencyMs)}
                      </span>
                    )}
                    {streaming && <span className="streaming-pulse" />}
                  </span>
                  <div className="message-actions">
                    <button
                      className={`icon-action ${isSaved ? 'saved' : ''}`}
                      onClick={toggleSaveCurrent}
                      disabled={!refinedComplete || busy}
                      aria-label={isSaved ? 'Remove from saved' : 'Save prompt'}
                      title={isSaved ? 'Remove from saved' : 'Save prompt'}
                    >
                      <StarIcon filled={isSaved} />
                    </button>
                    <button
                      className="icon-action primary-action"
                      onClick={openRunDrawerWithRefined}
                      disabled={!canRunPrompt}
                      aria-label="Run prompt"
                      title="Run this refined prompt and chat with the model"
                    >
                      <PlayCircleIcon />
                    </button>
                    <button
                      className="icon-action"
                      onClick={openPDFExport}
                      disabled={!canExportPDF}
                      aria-label="Export to PDF"
                      title="Export to PDF"
                    >
                      <PDFIcon />
                    </button>
                    <button
                      className="icon-action"
                      onClick={handleShare}
                      disabled={!refinedComplete || busy}
                      aria-label="Share prompt"
                      title="Share this refined prompt"
                    >
                      <ShareIcon />
                    </button>
                    <button className="copy-btn" onClick={handleCopy} disabled={busy}>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="message-body">
                  {improvedPrompt}
                  {streaming && <span className="caret" />}
                </div>
              </div>
            )}

            {showChangesSkeleton && <ChangesSkeleton />}
            {changes.length > 0 && <ChangesPanel changes={changes} />}

            {showScoresSkeleton && <ScoresSkeleton />}
            {scores && <ScoresPanel scores={scores} chartContainerRef={scoresChartRef} />}

            {showABTestInvite && (
              <ABTestInvite disabled={busy} onOpen={openABTest} hasResults={hasABTestResults} />
            )}

            {abTestOpen && (
              <ABTestPanel
                roughPrompt={submittedPrompt}
                refinedPrompt={improvedPrompt}
                testModel={settings.testModel}
                onClose={closeABTest}
                onRun={runABTest}
                test={abTest}
                busy={abTesting}
              />
            )}

            {showCompareInvite && (
              <CompareInvite primaryModel={primaryModel} onCompare={runComparison} disabled={busy} />
            )}

            {(comparison || comparing) && (
              <ComparisonStrip
                comparison={comparison}
                primaryModel={primaryModel}
                primaryRefined={improvedPrompt}
                primaryScores={scores}
                primaryChanges={changes}
                primaryUsage={primaryUsage}
                primaryLatencyMs={primaryLatencyMs}
                onUseVersion={useComparisonVersion}
                onClose={closeComparison}
                busy={busy}
              />
            )}

            {showFollowUp && <FollowUpPanel disabled={busy} onSubmit={handleFollowUp} />}

            {error && (
              <div className="message">
                <div className="error">{error}</div>
              </div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <div className={`composer ${isRecording ? 'recording' : ''}`}>
            <div className="composer-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}
                  disabled={busy}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={roughPrompt}
              onChange={(e) => setRoughPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? 'Listening — speak now…'
                  : submittedPrompt
                  ? 'Type another rough prompt...'
                  : 'Type a rough prompt... (Cmd+Enter to submit)'
              }
              rows={1}
              disabled={busy}
            />

            <div className="composer-actions">
              <span className="char-count">
                {isRecording && <span className="recording-indicator"><span className="recording-dot" /> Recording</span>}
                {!isRecording && roughPrompt.length > 0 && `${roughPrompt.length} characters`}
              </span>
              <div className="composer-buttons">
                {showMicButton && !busy && (
                  <button
                    type="button"
                    className={`mic-btn ${isRecording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                    aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                    title={isRecording ? 'Stop recording' : 'Dictate prompt'}
                  >
                    {isRecording ? <MicOffIcon /> : <MicIcon />}
                  </button>
                )}
                {busy ? (
                  <button
                    className="send-btn stop"
                    onClick={handleStop}
                    aria-label="Stop generating"
                    title="Stop generating"
                  >
                    <span className="stop-square" />
                  </button>
                ) : (
                  <button
                    className="send-btn"
                    onClick={handleImprove}
                    disabled={loading || !roughPrompt.trim()}
                    aria-label="Refine prompt"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
            </div>
          </div>

          {voiceError && <div className="voice-error">{voiceError}</div>}

          {/* Multi-pass refinement toggle */}
          <div className="multipass-bar">
            <button
              type="button"
              className={`multipass-toggle ${multiPassEnabled ? 'on' : ''}`}
              onClick={() => setMultiPassEnabled(v => !v)}
              title="Auto-refine multiple passes for a more polished result"
            >
              <LoopIcon />
              Multi-pass
            </button>
            {multiPassEnabled && (
              <select
                className="multipass-select"
                value={multiPassCount}
                onChange={e => setMultiPassCount(Number(e.target.value))}
                disabled={busy}
              >
                {[2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} passes</option>
                ))}
              </select>
            )}
            {multiPassEnabled && multiPassCurrent > 0 && (
              <span className="multipass-progress">Pass {multiPassCurrent} of {multiPassCount}…</span>
            )}
          </div>

          {showLintHints && (
            <LintHintsPanel
              hints={lintHints}
              dismissed={dismissedHints}
              onDismiss={dismissLintHint}
            />
          )}
        </div>
          </>
        )}
      </main>

      {importExportOpen && (
        <ImportExportModal
          history={history}
          saved={saved}
          onClose={() => setImportExportOpen(false)}
          onImport={handleImport}
        />
      )}

      {piiFindings && (
        <PIIWarningModal
          findings={piiFindings}
          onContinue={handlePIIContinue}
          onCancel={handlePIICancel}
        />
      )}

      {templateVarsOpen && (
        <TemplateVariablesModal
          variables={templateVarNames}
          values={templateVarValues}
          onChange={updateTemplateVarValue}
          onContinue={handleTemplateVarsContinue}
          onCancel={handleTemplateVarsCancel}
        />
      )}

      {shareModalOpen && (
        <ShareModal
          shareUrl={shareUrl}
          rough={submittedPrompt}
          improved={improvedPrompt}
          changes={changes}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {pdfModalOpen && (
        <PDFPreviewModal
          roughPrompt={submittedPrompt}
          category={category}
          refinedPrompt={improvedPrompt}
          changes={changes}
          scores={scores}
          primaryModel={primaryModel}
          primaryUsage={primaryUsage}
          primaryLatencyMs={primaryLatencyMs}
          abTest={abTest}
          testModel={settings.testModel}
          comparison={comparison}
          scoresChartRef={scoresChartRef}
          onClose={closePDFExport}
        />
      )}

      {convoDrawerOpen && (
        <RunDrawer
          panelMode={panelMode}
          conversation={currentConvo}
          conversations={conversations}
          testModel={settings.testModel}
          modelShortName={modelShortName}
          onClose={() => setConvoDrawerOpen(false)}
          onSend={sendRunMessage}
          onStop={stopRun}
          onNewConversation={startNewRunConversation}
          onShowList={showConversationList}
          onShowConversation={showCurrentConversation}
          onLoadConversation={loadConversation}
          onRenameConversation={renameConversation}
          onRemoveConversation={removeConversation}
          onClearAllConversations={clearAllConversations}
          busy={running}
        />
      )}
    </div>
  );
}

export default App;
