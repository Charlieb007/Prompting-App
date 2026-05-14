import { useState, useEffect, useRef } from 'react';
import './App.css';
import { HELP_CONTENT } from './help-content.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'writing', label: 'Writing' },
  { id: 'code', label: 'Code' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'brainstorm', label: 'Brainstorm' },
];

const STORAGE_HISTORY = 'prompt-improver-history';
const STORAGE_SETTINGS = 'prompt-improver-settings';
const MAX_HISTORY = 20;

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const MODELS = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'Anthropic', description: 'Most capable. Best for complex prompts.', available: true },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', description: 'Balanced speed and capability.', available: true, isDefault: true },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', description: 'Previous flagship. Still highly capable.', available: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', description: 'Fastest and cheapest. Good for simple prompts.', available: true },
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', description: 'Coming soon', available: false },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', description: 'Coming soon', available: false },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', description: 'Coming soon', available: false },
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

/* ── Icon components ─────────────────────────────────────── */

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

const RAIL_ITEMS = [
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'help', label: 'Help & Documentation', icon: HelpIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

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
          <div className="drawer-empty">
            Your refined prompts will appear here.
          </div>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.timestamp}>
                <button className="history-item" onClick={() => onLoad(entry)}>
                  <div className="history-row">
                    <span className="history-cat">{entry.category}</span>
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

/* ── Changes panel (the teaching layer) ──────────────────── */

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

function App() {
  const [roughPrompt, setRoughPrompt] = useState('');
  const [category, setCategory] = useState('general');
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeView, setActiveView] = useState('history');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const textareaRef = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_HISTORY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        setHistory([]);
      }
    }

    const savedSettings = localStorage.getItem(STORAGE_SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, []);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  useEffect(() => {
    autoResize();
  }, [roughPrompt]);

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

  function loadFromHistory(entry) {
    setRoughPrompt(entry.rough);
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setError('');
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function toggleView(id) {
    setActiveView(activeView === id ? null : id);
  }

  function toggleSidebar() {
    setActiveView(activeView === null ? 'history' : null);
  }

  async function handleImprove() {
    if (!roughPrompt.trim()) return;

    setLoading(true);
    setError('');
    setImprovedPrompt('');
    setChanges([]);
    setCopied(false);

    try {
      const response = await fetch(`${API_URL}/api/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: roughPrompt,
          category,
          model: settings.model,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Server returned an error.');
      }

      const data = await response.json();
      setImprovedPrompt(data.improvedPrompt);
      setChanges(data.changes || []);
      saveToHistory({
        rough: roughPrompt,
        improved: data.improvedPrompt,
        changes: data.changes || [],
        category,
        model: settings.model,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  const showEmpty = !improvedPrompt && !loading && !error;
  const drawerOpen = activeView !== null;

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
          {activeView === 'history' && (
            <HistoryView history={history} onLoad={loadFromHistory} onClear={clearHistory} />
          )}
          {activeView === 'help' && <HelpView />}
          {activeView === 'settings' && (
            <SettingsView settings={settings} onChange={updateSettings} onReset={resetSettings} />
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Prompt Refinery</h1>
            <p>Well-structured prompts.</p>
          </div>
        </header>

        <div className="conversation" ref={conversationRef}>
          <div className="conversation-inner">
            {showEmpty && (
              <div className="empty-state">
                <h2>What can I help you refine?</h2>
                <p>Type a rough prompt below and pick a category.</p>
              </div>
            )}

            {loading && (
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

            {improvedPrompt && !loading && (
              <>
                <div className="message">
                  <div className="message-header">
                    <span className="message-label">Refined prompt</span>
                    <button className="copy-btn" onClick={handleCopy}>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="message-body">{improvedPrompt}</div>
                </div>
                <ChangesPanel changes={changes} />
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
              placeholder="Type a rough prompt... (Cmd+Enter to submit)"
              rows={1}
            />

            <div className="composer-actions">
              <span className="char-count">
                {roughPrompt.length > 0 && `${roughPrompt.length} characters`}
              </span>
              <button
                className="send-btn"
                onClick={handleImprove}
                disabled={loading || !roughPrompt.trim()}
                aria-label="Refine prompt"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
