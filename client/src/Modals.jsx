/**
 * Modal dialogs for Prompt Refinery:
 * PIIWarningModal, TemplateVariablesModal, ShareModal,
 * PromptDiffPanel, ConfirmDialog, ToastList.
 */

import { useState, useEffect, useRef } from 'react';
import { ShieldIcon, KeyIcon, CardIcon, ContactIcon, CloseIcon } from './icons.jsx';
import { hasCriticalFindings, groupFindings, CATEGORY_META } from './scan.js';
import { buildShareMarkdown, computeWordDiff } from './utils.js';

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
