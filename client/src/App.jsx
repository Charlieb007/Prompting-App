import { useState, useEffect } from 'react';
import './App.css';

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'writing', label: 'Writing' },
  { id: 'code', label: 'Code' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'brainstorm', label: 'Brainstorm' },
];

const STORAGE_KEY = 'prompt-improver-history';
const MAX_HISTORY = 10;

function App() {
  const [roughPrompt, setRoughPrompt] = useState('');
  const [category, setCategory] = useState('general');
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  function saveToHistory(entry) {
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function clearHistory() {
    if (!confirm('Clear all history?')) return;
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  function loadFromHistory(entry) {
    setRoughPrompt(entry.rough);
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setError('');
  }

  async function handleImprove() {
    if (!roughPrompt.trim()) {
      setError('Please enter a prompt first.');
      return;
    }

    setLoading(true);
    setError('');
    setImprovedPrompt('');
    setCopied(false);

    try {
      const response = await fetch('http://localhost:3001/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: roughPrompt, category }),
      });

      if (!response.ok) {
        throw new Error('Server returned an error.');
      }

      const data = await response.json();
      setImprovedPrompt(data.improvedPrompt);
      saveToHistory({
        rough: roughPrompt,
        improved: data.improvedPrompt,
        category,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError('Something went wrong. Is the backend running?');
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

  return (
    <div className="app">
      <header className="header">
        <h1>Prompt Improver</h1>
        <p className="tagline">Turn rough ideas into clear, well-structured prompts.</p>
      </header>

      <div className="card">
        <label>Category</label>
        <div className="category-row">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`category-chip ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
              type="button"
            >
              {c.label}
            </button>
          ))}
        </div>

        <label htmlFor="prompt-input">Your rough prompt</label>
        <textarea
          id="prompt-input"
          value={roughPrompt}
          onChange={(e) => setRoughPrompt(e.target.value)}
          placeholder="e.g. help me write a presentation about our Q2 sales"
          rows={5}
        />

        <div className="button-row">
          <button onClick={handleImprove} disabled={loading}>
            {loading ? 'Improving...' : 'Improve prompt'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      {improvedPrompt && (
        <div className="result">
          <div className="result-header">
            <h2>Improved prompt</h2>
            <button className="copy-button" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="result-body">{improvedPrompt}</div>
        </div>
      )}

      {history.length > 0 && (
        <div className="history">
          <div className="history-header">
            <h2>Recent prompts</h2>
            <button className="copy-button" onClick={clearHistory}>Clear all</button>
          </div>
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.timestamp}>
                <button className="history-item" onClick={() => loadFromHistory(entry)}>
                  <span className="history-category">{entry.category}</span>
                  <span className="history-text">{entry.rough}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
