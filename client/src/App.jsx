import { useState, useEffect, useRef } from 'react';
import './App.css';
import { HELP_CONTENT } from './help-content.js';
import { TEMPLATES } from './templates-content.js';

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
const MAX_HISTORY = 20;

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

const DEFAULT_SETTINGS = { model: DEFAULT_MODEL };

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

function averageScore(scoreSet) {
  if (!scoreSet) return null;
  const values = SCORE_DIMENSIONS.map((d) => scoreSet[d.id]?.score).filter((s) => typeof s === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function modelShortName(modelId) {
  return MODELS.find((m) => m.id === modelId)?.shortName || modelId;
}

/* ── Icons ───────────────────────────────────────────────── */

function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <polyline points="3 3 3 8 8 8" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function StarIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L13.5 9 L19 10.5 L13.5 12 L12 18 L10.5 12 L5 10.5 L10.5 9 Z" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14l4-4" />
      <path d="M3.34 17a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="7" height="14" rx="1.5" />
      <rect x="14" y="5" width="7" height="14" rx="1.5" />
      <line x1="10" y1="12" x2="14" y2="12" strokeDasharray="2 2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* Geometric funnel logo — concept 04 */
function FunnelLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6 L27 6 L19 16 L19 26 L13 28 L13 16 Z" />
      <line x1="9" y1="11" x2="23" y2="11" opacity="0.5" />
    </svg>
  );
}

const RAIL_ITEMS = [
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'saved', label: 'Saved prompts', icon: StarIcon },
  { id: 'templates', label: 'Templates', icon: TemplatesIcon },
  { id: 'help', label: 'Help & Documentation', icon: HelpIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

/* ── Drawer views ────────────────────────────────────────── */

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

function HistoryView({ history, onLoad, onClear }) {
  return (
    <>
      <div className="drawer-head">
        <h3>History</h3>
        {history.length > 0 && (
          <button className="text-btn" onClick={onClear}>Clear all</button>
        )}
      </div>
      <div className="drawer-body">
        {history.length === 0 ? (
          <div className="drawer-empty">Your refined prompts will appear here.</div>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.timestamp}>
                <button className="history-item" onClick={() => onLoad(entry)}>
                  <div className="history-row">
                    <span className="history-cat">{entry.category}</span>
                    {entry.isFollowUp && <span className="history-followup">follow-up</span>}
                    {entry.comparison && <span className="history-followup">compare</span>}
                    <span className="history-time">{formatTime(entry.timestamp)}</span>
                  </div>
                  <span className="history-text">{entry.rough}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SavedView({ saved, onLoad, onRename, onRemove }) {
  return (
    <>
      <div className="drawer-head">
        <h3>Saved</h3>
      </div>
      <div className="drawer-body">
        {saved.length === 0 ? (
          <div className="drawer-empty">Star a refined prompt to save it here for later.</div>
        ) : (
          <ul className="saved-list">
            {saved.map((entry) => (
              <SavedItem
                key={entry.id}
                entry={entry}
                onLoad={onLoad}
                onRename={onRename}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SavedItem({ entry, onLoad, onRename, onRemove }) {
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
    <li className="saved-item">
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

function HelpView() {
  const [activeSection, setActiveSection] = useState(HELP_CONTENT[0].id);

  return (
    <>
      <div className="drawer-head">
        <h3>Help & Docs</h3>
      </div>
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
      <div className="drawer-body help-body">
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
    </>
  );
}

function SettingsView({ settings, onChange, onReset }) {
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
          <div className="settings-group-label">Model</div>
          <div className="settings-group-hint">
            Choose which AI model refines your prompts. Claude Sonnet 4.6 is the default.
          </div>

          <div className="model-section-label">Anthropic</div>
          <div className="model-list">
            {claudeModels.map((m) => (
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
                </div>
                <div className="model-radio">
                  {settings.model === m.id && <CheckIcon />}
                </div>
              </button>
            ))}
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
      </div>
    </>
  );
}

/* ── Display panels ──────────────────────────────────────── */

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

function ScoresPanel({ scores }) {
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

      <div className="scores-charts">
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

  // Available comparison candidates — everything except the primary model and unavailable ones.
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
  const refinedAvg = averageScore(column.scores?.refined);

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

  const isStreaming = !column.complete && column.refined;
  const isPending = !column.refined && !column.complete;

  return (
    <div className="compare-col">
      <div className="compare-col-header">
        <span className="compare-col-model">{modelShortName(column.modelId)}</span>
        {refinedAvg !== null && (
          <span className="compare-col-score">{refinedAvg.toFixed(1)}/5</span>
        )}
        {isStreaming && <span className="streaming-pulse" />}
      </div>

      {isPending && (
        <div className="compare-col-pending">
          <span className="thinking-dots">
            <span className="thinking-dot"></span>
            <span className="thinking-dot"></span>
            <span className="thinking-dot"></span>
          </span>
        </div>
      )}

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

      {column.complete && (
        <div className="compare-col-actions">
          <button
            className="compare-col-action"
            onClick={() => navigator.clipboard.writeText(column.refined)}
          >
            Copy
          </button>
          <button
            className="compare-col-action primary"
            onClick={() => onUseVersion(column)}
          >
            Use this version
          </button>
          {(column.changes?.length > 0 || column.scores) && (
            <button
              className="compare-col-action"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide details' : 'Show details'}
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

function ComparisonStrip({ comparison, primaryModel, primaryRefined, primaryScores, primaryChanges, onUseVersion }) {
  if (!comparison) return null;

  // Build column list: primary first, then each compared model.
  const primaryColumn = {
    modelId: primaryModel,
    refined: primaryRefined,
    scores: primaryScores,
    changes: primaryChanges,
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
      </div>
      <div className="compare-grid" data-cols={columns.length}>
        {columns.map((column) => (
          <ComparisonColumn
            key={column.modelId}
            column={column}
            onUseVersion={column.isPrimary ? () => {} : onUseVersion}
          />
        ))}
      </div>
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

/* ── SSE stream parsers ──────────────────────────────────── */

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
    'model-done': (p) => onModelDone?.(p.modelId),
    'model-error': (p) => onModelError?.(p.modelId, p.error),
    'compare-done': () => onDone?.(),
    'error': (p) => onError?.(p.error || 'Unknown error'),
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
  const [activeView, setActiveView] = useState('history');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const textareaRef = useRef(null);
  const conversationRef = useRef(null);
  const abortRef = useRef(null);
  const compareAbortRef = useRef(null);

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
  }, []);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  useEffect(() => { autoResize(); }, [roughPrompt]);

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

  function clearCurrentRefinement() {
    setImprovedPrompt('');
    setChanges([]);
    setScores(null);
    setComparison(null);
    setRefinedComplete(false);
    setCurrentSavedId(null);
  }

  function loadFromHistory(entry) {
    if (streaming || comparing) return;
    setRoughPrompt('');
    setSubmittedPrompt(entry.rough);
    setSubmittedFeedback(entry.feedback || '');
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setScores(entry.scores || null);
    setPrimaryModel(entry.model || DEFAULT_MODEL);
    setComparison(entry.comparison || null);
    setRefinedComplete(true);
    setError('');
    setCurrentSavedId(null);
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function loadFromTemplate(template) {
    if (streaming || comparing) return;
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
    if (streaming || comparing) return;
    setRoughPrompt('');
    setSubmittedPrompt(entry.rough);
    setSubmittedFeedback('');
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setScores(entry.scores || null);
    setPrimaryModel(entry.model || DEFAULT_MODEL);
    setComparison(entry.comparison || null);
    setRefinedComplete(true);
    setError('');
    setCurrentSavedId(entry.id);
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

  function toggleView(id) {
    setActiveView(activeView === id ? null : id);
  }

  function toggleSidebar() {
    setActiveView(activeView === null ? 'history' : null);
  }

  async function runRefinement({ feedback = null } = {}) {
    const sourcePrompt = feedback ? submittedPrompt : roughPrompt;
    if (!sourcePrompt.trim() || streaming || comparing) return;

    setLoading(true);
    setStreaming(true);
    setError('');
    setRefinedComplete(false);
    setCopied(false);
    setCurrentSavedId(null);
    setComparison(null); // Reset any comparison on new refinement

    const previousRefined = feedback ? improvedPrompt : null;

    if (feedback) {
      setSubmittedFeedback(feedback);
    } else {
      setSubmittedPrompt(roughPrompt);
      setSubmittedFeedback('');
      setRoughPrompt('');
    }

    setImprovedPrompt('');
    setChanges([]);
    setScores(null);
    setPrimaryModel(settings.model);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulatedRefined = '';
    let accumulatedChanges = [];
    let accumulatedScores = null;

    try {
      await streamRefinement({
        url: `${API_URL}/api/improve`,
        body: {
          prompt: sourcePrompt,
          category,
          model: settings.model,
          previousRefined: previousRefined || undefined,
          feedback: feedback || undefined,
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
        onDone: () => {
          if (accumulatedRefined) {
            saveToHistory({
              rough: sourcePrompt,
              improved: accumulatedRefined,
              changes: accumulatedChanges,
              scores: accumulatedScores,
              category,
              model: settings.model,
              timestamp: Date.now(),
              isFollowUp: Boolean(feedback),
              feedback: feedback || undefined,
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
    }
  }

  async function runComparison(modelIds) {
    if (!submittedPrompt.trim() || comparing || streaming) return;

    setComparing(true);
    setError('');

    // Seed columns dictionary with pending entries for each model.
    const initialColumns = modelIds.map((modelId) => ({
      modelId,
      refined: '',
      changes: [],
      scores: null,
      complete: false,
      error: null,
    }));
    setComparison({ columns: initialColumns });

    const controller = new AbortController();
    compareAbortRef.current = controller;

    // Mutable working copy so we can update columns by id without stale state.
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
        body: {
          prompt: submittedPrompt,
          category,
          models: modelIds,
        },
        signal: controller.signal,
        onStart: () => { /* noop */ },
        onModelChunk: (modelId, text) => {
          const col = workingColumns.find((c) => c.modelId === modelId);
          if (col) updateColumn(modelId, { refined: col.refined + text });
        },
        onModelChanges: (modelId, modelChanges) => {
          updateColumn(modelId, { changes: modelChanges });
        },
        onModelScores: (modelId, modelScores) => {
          updateColumn(modelId, { scores: modelScores });
        },
        onModelDone: (modelId) => {
          updateColumn(modelId, { complete: true });
        },
        onModelError: (modelId, errMsg) => {
          updateColumn(modelId, { error: errMsg, complete: true });
        },
        onDone: () => {
          // Save the completed comparison to the most recent history entry
          // so reloads preserve it.
          setHistory((current) => {
            const updated = [...current];
            if (updated.length > 0) {
              updated[0] = {
                ...updated[0],
                comparison: { columns: workingColumns },
              };
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
    // Promote this column to the primary refinement.
    setImprovedPrompt(column.refined);
    setChanges(column.changes || []);
    setScores(column.scores || null);
    setPrimaryModel(column.modelId);
    setComparison(null); // Clear comparison since we've adopted one
    setCurrentSavedId(null);
  }

  function handleImprove() {
    runRefinement();
  }

  function handleFollowUp(feedback) {
    runRefinement({ feedback });
  }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort();
    if (compareAbortRef.current) compareAbortRef.current.abort();
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

  const showEmpty = !improvedPrompt && !submittedPrompt && !loading && !error && !streaming;
  const drawerOpen = activeView !== null;
  const isSaved = Boolean(currentSavedId);
  const showFollowUp = Boolean(improvedPrompt) && refinedComplete && !comparing;
  const showCompareInvite = Boolean(improvedPrompt) && refinedComplete && !comparison && !comparing;
  const busy = streaming || comparing;

  return (
    <div className="shell">
      <nav className="rail">
        <button
          className="rail-btn"
          onClick={toggleSidebar}
          aria-label={drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <SidebarIcon />
          <span className="rail-tooltip">
            {drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          </span>
        </button>
        <div className="rail-divider" />
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`rail-btn ${activeView === item.id ? 'active' : ''}`}
              onClick={() => toggleView(item.id)}
              aria-label={item.label}
            >
              <Icon />
              <span className="rail-tooltip">{item.label}</span>
            </button>
          );
        })}
        <div className="rail-spacer" />
      </nav>

      <aside className={`drawer ${drawerOpen ? '' : 'closed'}`}>
        <div className="drawer-inner">
          <DrawerLogo />
          {activeView === 'history' && (
            <HistoryView history={history} onLoad={loadFromHistory} onClear={clearHistory} />
          )}
          {activeView === 'saved' && (
            <SavedView
              saved={saved}
              onLoad={loadFromSaved}
              onRename={renameSaved}
              onRemove={removeSaved}
            />
          )}
          {activeView === 'templates' && (
            <TemplatesView onSelect={loadFromTemplate} />
          )}
          {activeView === 'help' && <HelpView />}
          {activeView === 'settings' && (
            <SettingsView settings={settings} onChange={updateSettings} onReset={resetSettings} />
          )}
        </div>
      </aside>

      <main className="main">
        <div className="conversation" ref={conversationRef}>
          <div className="conversation-inner">
            {showEmpty && (
              <div className="empty-state">
                <h2>What can I help you refine?</h2>
                <p>Type a rough prompt below, or pick a template from the sidebar.</p>
              </div>
            )}

            {submittedPrompt && (
              <RoughPromptMessage
                text={submittedPrompt}
                category={category}
                isFollowUp={false}
              />
            )}

            {submittedFeedback && (
              <RoughPromptMessage
                text={submittedFeedback}
                category={null}
                isFollowUp={true}
              />
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
                  Thinking...
                </div>
              </div>
            )}

            {improvedPrompt && (
              <>
                <div className="message">
                  <div className="message-header">
                    <span className="message-label">
                      Refined prompt
                      <span className="primary-model-tag">{modelShortName(primaryModel)}</span>
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
                        className="copy-btn"
                        onClick={handleCopy}
                        disabled={busy}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="message-body">
                    {improvedPrompt}
                    {streaming && <span className="caret" />}
                  </div>
                </div>
                <ChangesPanel changes={changes} />
                <ScoresPanel scores={scores} />

                {showCompareInvite && (
                  <CompareInvite
                    primaryModel={primaryModel}
                    onCompare={runComparison}
                    disabled={busy}
                  />
                )}

                {(comparison || comparing) && (
                  <ComparisonStrip
                    comparison={comparison}
                    primaryModel={primaryModel}
                    primaryRefined={improvedPrompt}
                    primaryScores={scores}
                    primaryChanges={changes}
                    onUseVersion={useComparisonVersion}
                  />
                )}

                {showFollowUp && (
                  <FollowUpPanel
                    disabled={busy}
                    onSubmit={handleFollowUp}
                  />
                )}
              </>
            )}

            {error && (
              <div className="message">
                <div className="error">{error}</div>
              </div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer">
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
              placeholder={submittedPrompt ? "Type another rough prompt..." : "Type a rough prompt... (Cmd+Enter to submit)"}
              rows={1}
              disabled={busy}
            />

            <div className="composer-actions">
              <span className="char-count">
                {roughPrompt.length > 0 && `${roughPrompt.length} characters`}
              </span>
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
      </main>
    </div>
  );
}

export default App;
