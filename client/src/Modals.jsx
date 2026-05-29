/**
 * Modal dialogs for Prompt Refina:
 * PIIWarningModal, TemplateVariablesModal, ShareModal,
 * PromptDiffPanel, ConfirmDialog, ToastList, OnboardingModal.
 */

import { useState, useEffect, useRef } from 'react';
import { ShieldIcon, KeyIcon, CardIcon, ContactIcon, CloseIcon } from './icons.jsx';
import { hasCriticalFindings, groupFindings, CATEGORY_META } from './scan.js';
import { buildShareMarkdown, computeWordDiff, buildCodeSnippet } from './utils.js';
import { CODE_SNIPPET_LANGS } from './constants.js';

/* ── PIIWarningModal ─────────────────────────────────────── */

function CategoryIcon({ category }) {
  if (category === 'credentials') return <KeyIcon />;
  if (category === 'financial')   return <CardIcon />;
  if (category === 'contact')     return <ContactIcon />;
  return <ShieldIcon />;
}

export function PIIWarningModal({ findings, onContinue, onCancel }) {
  const grouped    = groupFindings(findings);
  const hasCritical = hasCriticalFindings(findings);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal pii-modal" role="dialog" aria-modal="true" aria-labelledby="pii-title">
        <div className="modal-head pii-modal-head">
          <div className="pii-modal-head-icon"><ShieldIcon /></div>
          <div>
            <h2 id="pii-title">Personal information detected</h2>
            <p className="pii-modal-subtitle">
              Found in your prompt before sending. Review what's flagged.
            </p>
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Close" title="Close"><CloseIcon /></button>
        </div>

        <div className="modal-body">
          {Object.entries(grouped).map(([category, items]) => {
            if (items.length === 0) return null;
            const meta = CATEGORY_META[category];
            return (
              <section key={category} className={`pii-category pii-category-${category}`}>
                <div className="pii-category-header">
                  <span className="pii-category-icon"><CategoryIcon category={category} /></span>
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
          <button className="pii-modal-btn pii-modal-btn-secondary" onClick={onCancel}>Edit prompt</button>
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

/* ── TemplateVariablesModal ──────────────────────────────── */

export function TemplateVariablesModal({ variables, values, onChange, onContinue, onCancel }) {
  const firstInputRef = useRef(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);
  const allFilled = variables.every(v => (values[v] || '').trim());

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h2>Fill in variables</h2>
          <button className="modal-close" onClick={onCancel}><CloseIcon /></button>
        </div>
        <div className="modal-body" onKeyDown={e => {
          if (e.key === 'Enter' && allFilled) { e.preventDefault(); onContinue(); }
          if (e.key === 'Escape') onCancel();
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Your prompt has <strong>{variables.length}</strong> variable{variables.length !== 1 ? 's' : ''}. Fill them in below, then continue.
          </p>
          {variables.map((v, i) => (
            <div key={v} className="template-var-row">
              <label className="template-var-label"><code>{`{{${v}}}`}</code></label>
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
            <button className="send-btn" onClick={onContinue} disabled={!allFilled}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ShareModal ──────────────────────────────────────────── */

export function ShareModal({ shareUrl, rough, improved, changes, onClose }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [mdCopied,   setMdCopied]   = useState(false);

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

/* ── UpgradeModal ────────────────────────────────────────── */

export function UpgradeModal({ reason, signedIn, onUpgrade, onSignIn, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setBusy(true); setError('');
    try {
      await onUpgrade();
    } catch (err) {
      setError(err.message || 'Could not start checkout.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h2>Upgrade to Pro</h2>
          <button className="modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          {reason && <p className="modal-section-hint">{reason}</p>}
          <ul className="upgrade-benefits">
            <li>Unlimited refinements — no daily cap</li>
            <li>Access to Opus (most capable) models</li>
            <li>Power features: prompt eval, model comparison, chains, multi-pass</li>
          </ul>
          {error && <div className="auth-error">{error}</div>}
          {signedIn ? (
            <button className="send-btn auth-submit" onClick={handleUpgrade} disabled={busy}>
              {busy ? 'Starting checkout…' : 'Upgrade to Pro'}
            </button>
          ) : (
            <button className="send-btn auth-submit" onClick={() => { onClose(); onSignIn?.(); }}>
              Sign in to upgrade
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── CodeExportModal ─────────────────────────────────────── */

export function CodeExportModal({ prompt, model, onClose, onToast }) {
  const [lang, setLang] = useState(CODE_SNIPPET_LANGS[0].id);
  const [copied, setCopied] = useState(false);

  const snippet = buildCodeSnippet(prompt, { lang, model });

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    onToast?.('Code snippet copied');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <h2>Export as code</h2>
          <button className="modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="modal-section-hint">A ready-to-paste API call with your refined prompt embedded.</p>
          <div className="code-lang-tabs">
            {CODE_SNIPPET_LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`chip ${lang === l.id ? 'active' : ''}`}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <pre className="code-snippet"><code>{snippet}</code></pre>
          <button className="send-btn" onClick={copySnippet}>
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PromptDiffPanel ─────────────────────────────────────── */

export function PromptDiffPanel({ rough, improved }) {
  const tokens       = computeWordDiff(rough || '', improved || '');
  const deletedCount = tokens.filter(t => t.type === 'delete').length;
  const insertedCount = tokens.filter(t => t.type === 'insert').length;

  return (
    <div className="prompt-diff-panel">
      <div className="prompt-diff-head">
        <span className="prompt-diff-title">Prompt diff</span>
        <span className="prompt-diff-stats">
          <span className="diff-stat removed">−{deletedCount} removed</span>
          <span className="diff-stat added">+{insertedCount} added</span>
        </span>
      </div>
      <div className="prompt-diff-body">
        {tokens.map((token, idx) => (
          token.type === 'equal'
            ? <span key={idx}>{token.text}</span>
            : <span key={idx} className={`diff-token diff-${token.type}`}>{token.text}</span>
        ))}
      </div>
    </div>
  );
}

/* ── ConfirmDialog ───────────────────────────────────────── */

export function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter')  { e.preventDefault(); onConfirm(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true">
        <div className="confirm-body">
          <div className="confirm-message">{message}</div>
          <div className="confirm-actions">
            <button className="copy-btn" onClick={onCancel}>Cancel</button>
            <button className="copy-btn danger-btn" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ShortcutsModal ──────────────────────────────────────── */

const SHORTCUT_GROUPS = [
  {
    label: 'Composer',
    shortcuts: [
      { keys: ['⌘', '↵'],        desc: 'Refine prompt' },
      { keys: ['/'],              desc: 'Focus composer from anywhere' },
      { keys: ['Shift', '?'],     desc: 'Open this shortcuts panel' },
    ],
  },
  {
    label: 'Panels & navigation',
    shortcuts: [
      { keys: ['Esc'],            desc: 'Close active panel or modal' },
    ],
  },
  {
    label: 'Edit mode',
    shortcuts: [
      { keys: ['⌘', '↵'],        desc: 'Save inline edits' },
      { keys: ['Esc'],            desc: 'Cancel inline edits' },
    ],
  },
  {
    label: 'Follow-up',
    shortcuts: [
      { keys: ['⌘', '↵'],        desc: 'Apply follow-up feedback' },
    ],
  },
  {
    label: 'Dialogs',
    shortcuts: [
      { keys: ['Enter'],          desc: 'Confirm dialog / fill template vars' },
      { keys: ['Esc'],            desc: 'Dismiss dialog' },
    ],
  },
];

export function ShortcutsModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <div className="modal-head">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="modal-body shortcuts-body">
          {SHORTCUT_GROUPS.map(group => (
            <section key={group.label} className="shortcuts-group">
              <div className="shortcuts-group-label">{group.label}</div>
              {group.shortcuts.map((s, i) => (
                <div key={i} className="shortcut-row">
                  <span className="shortcut-keys">
                    {s.keys.map((k, j) => (
                      <span key={j}><kbd className="shortcut-kbd">{k}</kbd>{j < s.keys.length - 1 && <span className="shortcut-plus">+</span>}</span>
                    ))}
                  </span>
                  <span className="shortcut-desc">{s.desc}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── ToastList ───────────────────────────────────────────── */

export function ToastList({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-list">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => onDismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── OnboardingModal ─────────────────────────────────────── */

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to Prompt Refina',
    body: 'Prompt Refina turns rough, vague AI prompts into well-structured ones that get better results. It takes seconds and works with any AI tool.',
  },
  {
    emoji: '✍️',
    title: 'Write your rough prompt',
    body: "Don't overthink it — just describe what you need in plain language. Something like \"help me write an email\" or \"explain quantum computing\" works perfectly.",
    tip: 'Tip: use {{variable}} placeholders for parts you want to fill in later.',
  },
  {
    emoji: '✨',
    title: 'Get a refined version',
    body: 'Prompt Refina rewrites your prompt with specificity, audience, format, and constraints — then scores it across five quality dimensions with a full explanation of every change.',
    tip: 'Tip: click "Iterate" to add follow-up feedback like "make it shorter" or "add examples".',
  },
  {
    emoji: '🚀',
    title: "You're ready to go!",
    body: 'Explore the left panel for History, Saved prompts, Analytics, Prompt Chains, and more. Press ⌘+Enter (or Ctrl+Enter) to refine at any time.',
    tip: 'Tip: try the multi-pass toggle to auto-refine your prompt 2–5 times in a row.',
  },
];

export function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  function finish() {
    localStorage.setItem('prompt-refina-onboarded', '1');
    onClose();
  }

  function next() {
    if (isLast) finish();
    else setStep(s => s + 1);
  }

  function skip() { finish(); }

  const s = STEPS[step];

  return (
    <div className="modal-backdrop">
      <div className="modal onboarding-modal" role="dialog" aria-modal="true">

        {/* Progress dots */}
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="onboarding-body">
          <div className="onboarding-emoji">{s.emoji}</div>
          <h2 className="onboarding-title">{s.title}</h2>
          <p className="onboarding-text">{s.body}</p>
          {s.tip && <div className="onboarding-tip">{s.tip}</div>}
        </div>

        {/* Actions */}
        <div className="onboarding-actions">
          {!isLast && (
            <button className="text-btn onboarding-skip" onClick={skip}>
              Skip tour
            </button>
          )}
          <button className="btn-primary onboarding-next" onClick={next}>
            {isLast ? 'Get started →' : 'Next →'}
          </button>
        </div>

      </div>
    </div>
  );
}
