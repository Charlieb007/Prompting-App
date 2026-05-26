/**
 * Left-rail drawer views for Prompt Refinery.
 * Includes: DrawerLogo, HistoryView, SavedView, FolderSection, SavedItem,
 *           TemplatesView, UsageView, AnalyticsView, ChainView,
 *           HelpView, SettingsView, ScoringDimensionsSettings, ImportExportModal
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FunnelLogo, FolderIcon, PencilIcon, TrashIcon, CloseIcon,
  CheckIcon, ChevronUpIcon, DownloadIcon, UploadIcon,
  SearchIcon, PinIcon, MoonIcon, SunIcon,
} from './icons.jsx';
import { CATEGORIES, MODELS, PRICING, SCORE_DIMENSIONS } from './constants.js';
import { formatTime, formatCost, formatLatency, modelShortName, makeId } from './utils.js';
import { TEMPLATES } from './templates-content.js';
import { HELP_CONTENT } from './help-content.js';
import { exportMarkdown, exportJSON, exportCSV, importFile } from './io.js';

/* ── DrawerLogo ──────────────────────────────────────────── */

export function DrawerLogo() {
  return (
    <div className="drawer-logo">
      <div className="drawer-logo-mark"><FunnelLogo /></div>
      <div className="drawer-logo-text">
        <div className="drawer-logo-name">Prompt Refinery</div>
        <div className="drawer-logo-tagline">Well-structured prompts.</div>
      </div>
    </div>
  );
}

/* ── HistoryView ─────────────────────────────────────────── */

export function HistoryView({ history, onLoad, onReRefine, onClear, onOpenImportExport, onTogglePin }) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? history.filter(e =>
        e.rough.toLowerCase().includes(query.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(query.toLowerCase()) ||
        (e.model || '').toLowerCase().includes(query.toLowerCase())
      )
    : history;

  const pinned   = filtered.filter(e => e.pinned);
  const unpinned = filtered.filter(e => !e.pinned);

  function renderEntry(entry) {
    return (
      <li key={entry.timestamp} className={`history-li ${entry.pinned ? 'history-li-pinned' : ''}`}>
        <div className="history-meta">
          <span className="history-cat">{entry.category}</span>
          {entry.isFollowUp && <span className="history-followup">follow-up</span>}
          {entry.comparison && <span className="history-followup">compare</span>}
          {entry.imported   && <span className="history-followup">imported</span>}
          <span className="history-time">{formatTime(entry.timestamp)}</span>
        </div>
        <button className="history-text-btn" onClick={() => onLoad(entry)} title="Load this refinement">
          {entry.rough}
        </button>
        <div className="history-actions">
          <button
            className={`history-pin-btn ${entry.pinned ? 'active' : ''}`}
            onClick={() => onTogglePin(entry.timestamp)}
            title={entry.pinned ? 'Unpin' : 'Pin to top'}
            aria-label={entry.pinned ? 'Unpin' : 'Pin to top'}
          >
            <PinIcon filled={entry.pinned} />
          </button>
          <button className="history-action-btn" onClick={() => onLoad(entry)}>Load</button>
          <button className="history-action-btn accent" onClick={() => onReRefine(entry)}>Re-refine</button>
        </div>
      </li>
    );
  }

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
        {history.length > 0 && (
          <div className="drawer-search-wrap">
            <span className="drawer-search-icon"><SearchIcon /></span>
            <input
              className="drawer-search-input"
              type="text"
              placeholder="Search history…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className="drawer-search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
            )}
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="drawer-empty">
            {query ? 'No matches found.' : 'Your refined prompts will appear here.'}
          </div>
        ) : (
          <ul className="history-list">
            {pinned.length > 0 && (
              <>
                <li className="history-section-label">📌 Pinned</li>
                {pinned.map(renderEntry)}
                {unpinned.length > 0 && <li className="history-section-label">Recent</li>}
              </>
            )}
            {unpinned.map(renderEntry)}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── SavedView helpers ───────────────────────────────────── */

// Module-level drag state (only one drag at a time)
let _draggedSavedId = null;

export function SavedView({ saved, folders, onLoad, onRename, onRemove, onMoveToFolder, onAddFolder, onRenameFolder, onDeleteFolder }) {
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [query, setQuery] = useState('');
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

  const visibleSaved = query.trim()
    ? saved.filter(s =>
        (s.name || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.rough || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.category || '').toLowerCase().includes(query.toLowerCase())
      )
    : saved;

  const uncategorized = visibleSaved.filter(s => !s.folderId);
  const byFolder = folders.map(f => ({
    folder: f,
    items: visibleSaved.filter(s => s.folderId === f.id),
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
        {saved.length > 0 && (
          <div className="drawer-search-wrap">
            <span className="drawer-search-icon"><SearchIcon /></span>
            <input
              className="drawer-search-input"
              type="text"
              placeholder="Search saved prompts…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className="drawer-search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
            )}
          </div>
        )}
        {folders.length > 0 && !query && (
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

  return (
    <div
      className={`folder-section ${dragOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        if (_draggedSavedId) { onMoveToFolder(_draggedSavedId, folder.id); _draggedSavedId = null; }
      }}
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
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  function commitName() { onRename(entry.id, draftName.trim()); setEditing(false); }
  function cancelEdit() { setDraftName(entry.name || ''); setEditing(false); }

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
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitName(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
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
          onClick={e => { e.stopPropagation(); setEditing(true); }}
          aria-label="Rename" title="Rename"
        ><PencilIcon /></button>
        <button
          className="saved-action-btn"
          onClick={e => { e.stopPropagation(); onRemove(entry.id); }}
          aria-label="Remove" title="Remove"
        ><TrashIcon /></button>
      </div>
    </li>
  );
}

/* ── TemplatesView ───────────────────────────────────────── */

export function TemplatesView({ onSelect }) {
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    templates: TEMPLATES.filter((t) => t.category === cat.id),
  })).filter((group) => group.templates.length > 0);

  return (
    <>
      <div className="drawer-head"><h3>Templates</h3></div>
      <div className="drawer-body templates-body">
        <p className="templates-intro">
          Start from a common scenario. Click any template to fill the composer, then edit or submit as-is.
        </p>
        {grouped.map((group) => (
          <div key={group.id} className="templates-group">
            <div className="templates-group-label">{group.label}</div>
            <div className="templates-list">
              {group.templates.map((t) => (
                <button key={t.id} className="template-card" onClick={() => onSelect(t)}>
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

/* ── UsageView ───────────────────────────────────────────── */

export function UsageView({ usage, onClear }) {
  const stats = useMemo(() => {
    if (!usage || usage.length === 0) return null;
    const now   = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs  = 7 * dayMs;
    const monthMs = 30 * dayMs;

    let last24h = { count: 0, cost: 0, tokens: 0 };
    let last7d  = { count: 0, cost: 0, tokens: 0 };
    let last30d = { count: 0, cost: 0, tokens: 0 };
    let allTime = { count: 0, cost: 0, tokens: 0 };
    const byModel = {};
    const byDay   = {};
    let totalLatency = 0, latencyCount = 0;

    for (const record of usage) {
      const age    = now - record.timestamp;
      const tokens = (record.inputTokens || 0) + (record.outputTokens || 0);
      const cost   = record.costUSD || 0;
      allTime.count++; allTime.cost += cost; allTime.tokens += tokens;
      if (age <= dayMs)   { last24h.count++; last24h.cost += cost; last24h.tokens += tokens; }
      if (age <= weekMs)  { last7d.count++;  last7d.cost  += cost; last7d.tokens  += tokens; }
      if (age <= monthMs) { last30d.count++; last30d.cost += cost; last30d.tokens += tokens; }
      if (record.latencyMs) { totalLatency += record.latencyMs; latencyCount++; }
      const modelKey = record.model || 'unknown';
      if (!byModel[modelKey]) byModel[modelKey] = { count: 0, cost: 0, tokens: 0 };
      byModel[modelKey].count++; byModel[modelKey].cost += cost; byModel[modelKey].tokens += tokens;
      const dayKey = new Date(record.timestamp).toISOString().slice(0, 10);
      if (!byDay[dayKey]) byDay[dayKey] = { count: 0, cost: 0 };
      byDay[dayKey].count++; byDay[dayKey].cost += cost;
    }

    const avgLatency   = latencyCount > 0 ? totalLatency / latencyCount : null;
    const modelEntries = Object.entries(byModel)
      .map(([model, s]) => ({ model, ...s }))
      .sort((a, b) => b.cost - a.cost);
    const dayEntries = [];
    for (let i = 6; i >= 0; i--) {
      const dayKey = new Date(now - i * dayMs).toISOString().slice(0, 10);
      dayEntries.push({ day: dayKey, ...(byDay[dayKey] || { count: 0, cost: 0 }) });
    }
    const maxDayCost = Math.max(0.001, ...dayEntries.map(d => d.cost));
    return { last24h, last7d, last30d, allTime, avgLatency, modelEntries, dayEntries, maxDayCost };
  }, [usage]);

  if (!stats) {
    return (
      <>
        <div className="drawer-head"><h3>Usage & cost</h3></div>
        <div className="drawer-body">
          <div className="drawer-empty">Your usage and cost will appear here after your first refinement.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="drawer-head">
        <h3>Usage & cost</h3>
        <button className="text-btn" onClick={onClear} title="Reset usage tracking">Reset</button>
      </div>
      <div className="drawer-body usage-body">
        <div className="usage-disclaimer">
          Cost estimates based on Anthropic's published rates (May 2026). Final billing is via your Anthropic Console.
        </div>
        <div className="usage-totals">
          {[
            { label: 'Today',   data: stats.last24h },
            { label: '7 days',  data: stats.last7d  },
            { label: '30 days', data: stats.last30d },
          ].map(({ label, data }) => (
            <div key={label} className="usage-total">
              <div className="usage-total-label">{label}</div>
              <div className="usage-total-value">{formatCost(data.cost) || '—'}</div>
              <div className="usage-total-meta">{data.count} {data.count === 1 ? 'call' : 'calls'}</div>
            </div>
          ))}
        </div>
        <div className="usage-section">
          <div className="usage-section-label">Last 7 days</div>
          <div className="usage-chart">
            {stats.dayEntries.map((day) => {
              const heightPct = stats.maxDayCost > 0 ? (day.cost / stats.maxDayCost) * 100 : 0;
              const dayShort  = new Date(day.day).toLocaleDateString(undefined, { weekday: 'short' });
              return (
                <div key={day.day} className="usage-chart-bar"
                  title={`${day.day}: ${formatCost(day.cost) || '$0'} · ${day.count} ${day.count === 1 ? 'call' : 'calls'}`}>
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

/* ── AnalyticsView ───────────────────────────────────────── */

export function AnalyticsView({ history }) {
  const stats = useMemo(() => {
    const withScores = history.filter(e => e.scores?.rough && e.scores?.refined);
    if (withScores.length === 0) return null;

    const SCORE_IDS = SCORE_DIMENSIONS.map(d => d.id);
    function avgScore(scoreSet) {
      if (!scoreSet) return null;
      const vals = SCORE_IDS.map(id => scoreSet[id]?.score).filter(v => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }

    const dimLifts = SCORE_DIMENSIONS.map(d => {
      const lifts = withScores
        .map(e => (e.scores.refined[d.id]?.score ?? 0) - (e.scores.rough[d.id]?.score ?? 0))
        .filter(v => !isNaN(v));
      const avg = lifts.length ? lifts.reduce((a, b) => a + b, 0) / lifts.length : 0;
      return { ...d, avgLift: avg };
    });
    const bestDim = [...dimLifts].sort((a, b) => b.avgLift - a.avgLift)[0];

    const last10 = [...withScores].slice(0, 10).reverse();
    const trendEntries = last10.map(e => ({ ts: e.timestamp, score: avgScore(e.scores?.refined) || 0 }));
    const maxTrend = Math.max(5, ...trendEntries.map(t => t.score));

    const byCat = {};
    for (const e of history) byCat[e.category] = (byCat[e.category] || 0) + 1;
    const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...catEntries.map(c => c[1]));

    const overallLifts = withScores.map(e => (avgScore(e.scores?.refined) || 0) - (avgScore(e.scores?.rough) || 0));
    const avgLift    = overallLifts.length ? overallLifts.reduce((a, b) => a + b, 0) / overallLifts.length : 0;
    const avgRefined = withScores.reduce((a, e) => a + (avgScore(e.scores?.refined) || 0), 0) / withScores.length;

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

        {stats.bestDim && (
          <div className="analytics-best">
            ✨ Most improved: <strong>{stats.bestDim.label}</strong> (+{stats.bestDim.avgLift.toFixed(1)} avg)
          </div>
        )}

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

        {stats.trendEntries.length > 1 && (
          <>
            <div className="analytics-section-title">Refined score trend (last 10)</div>
            <div className="usage-chart">
              {stats.trendEntries.map((t, i) => (
                <div key={i} className="usage-bar-wrap" title={`${new Date(t.ts).toLocaleDateString()}: ${t.score.toFixed(1)}`}>
                  <div className="usage-bar" style={{ height: `${Math.max(4, (t.score / stats.maxTrend) * 100)}%` }} />
                  <div className="usage-bar-label">{WEEKDAYS[new Date(t.ts).getDay()]}</div>
                </div>
              ))}
            </div>
          </>
        )}

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

/* ── ChainView ───────────────────────────────────────────── */

const DEFAULT_CHAIN_STEP = () => ({ id: makeId(), prompt: '', output: '', status: 'idle' });

export function ChainView({ chainSteps, onUpdateSteps, onRunChain, chainRunning, testModel }) {
  function addStep()         { onUpdateSteps([...chainSteps, DEFAULT_CHAIN_STEP()]); }
  function removeStep(id)    { onUpdateSteps(chainSteps.filter(s => s.id !== id)); }
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
              <button className="send-btn chain-run-btn" onClick={onRunChain} disabled={!canRun}>
                {chainRunning ? 'Running…' : 'Run chain'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ── HelpView ────────────────────────────────────────────── */

export function HelpView() {
  const [activeSection, setActiveSection] = useState(HELP_CONTENT[0].id);
  return (
    <>
      <div className="drawer-head"><h3>Help & Docs</h3></div>
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
                if (block.type === 'step') return (
                  <div key={i} className="help-step">
                    <div className="help-step-num">{block.n}</div>
                    <div className="help-step-body">
                      <div className="help-step-title">{block.title}</div>
                      <div className="help-step-text">{block.text}</div>
                    </div>
                  </div>
                );
                if (block.type === 'list') return (
                  <ul key={i} className="help-list">
                    {block.items.map((item, j) => (
                      <li key={j}>
                        <span className="help-list-label">{item.label}</span>
                        <span className="help-list-text">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                );
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

/* ── SettingsView ────────────────────────────────────────── */

export function SettingsView({ settings, onChange, onReset, speechSupported }) {
  const claudeModels = MODELS.filter((m) => m.provider === 'Anthropic');
  const comingSoon   = MODELS.filter((m) => !m.available);

  return (
    <>
      <div className="drawer-head">
        <h3>Settings</h3>
        <button className="text-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="drawer-body settings-body">

        <div className="settings-group">
          <div className="settings-group-label">Appearance</div>
          <button
            type="button"
            className={`toggle-row ${settings.darkMode ? 'on' : ''}`}
            onClick={() => onChange({ darkMode: !settings.darkMode })}
            role="switch" aria-checked={settings.darkMode}
          >
            <div className="toggle-row-text">
              <div className="toggle-row-label">
                <span className="toggle-row-icon">{settings.darkMode ? <MoonIcon /> : <SunIcon />}</span>
                Dark mode
              </div>
              <div className="toggle-row-desc">
                {settings.darkMode ? 'Using dark theme.' : 'Using light theme.'}
              </div>
            </div>
            <div className="toggle-switch"><div className="toggle-switch-thumb" /></div>
          </button>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Prompt linter</div>
          <div className="settings-group-hint">Get instant hints about your rough prompt as you type. No API call — runs locally.</div>
          <button
            type="button"
            className={`toggle-row ${settings.linterEnabled ? 'on' : ''}`}
            onClick={() => onChange({ linterEnabled: !settings.linterEnabled })}
            role="switch" aria-checked={settings.linterEnabled}
          >
            <div className="toggle-row-text">
              <div className="toggle-row-label">Show linter hints</div>
              <div className="toggle-row-desc">
                {settings.linterEnabled ? 'Hints appear under the composer when issues are detected.' : 'No hints will be shown.'}
              </div>
            </div>
            <div className="toggle-switch"><div className="toggle-switch-thumb" /></div>
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
            role="switch" aria-checked={settings.piiScannerEnabled}
          >
            <div className="toggle-row-text">
              <div className="toggle-row-label">Scan for personal info before sending</div>
              <div className="toggle-row-desc">
                {settings.piiScannerEnabled ? 'A warning appears if sensitive-looking content is detected.' : 'Prompts are sent without a privacy check.'}
              </div>
            </div>
            <div className="toggle-switch"><div className="toggle-switch-thumb" /></div>
          </button>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Voice input</div>
          <div className="settings-group-hint">
            {speechSupported
              ? "Dictate rough prompts using your microphone. Transcription uses your browser's built-in speech recognition. On Chrome this routes through Google's servers; on Safari it stays on-device."
              : 'Your browser does not support speech recognition. Try Chrome or Safari.'}
          </div>
          <button
            type="button"
            className={`toggle-row ${settings.voiceEnabled && speechSupported ? 'on' : ''}`}
            onClick={() => speechSupported && onChange({ voiceEnabled: !settings.voiceEnabled })}
            role="switch" aria-checked={settings.voiceEnabled && speechSupported}
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
            <div className="toggle-switch"><div className="toggle-switch-thumb" /></div>
          </button>
        </div>

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Refinement model</div>
          <div className="settings-group-hint">Choose which AI model refines your prompts. Claude Sonnet 4.6 is the default.</div>

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
                  <div className="model-radio">{settings.model === m.id && <CheckIcon />}</div>
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
                <div className="model-radio">{settings.testModel === m.id && <CheckIcon />}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-divider" />

        <ScoringDimensionsSettings settings={settings} onChange={onChange} />

        <div className="settings-divider" />

        <div className="settings-group">
          <div className="settings-group-label">Integrations</div>
          <div className="settings-group-hint">
            Export refined prompts directly to Notion or Slack. Credentials are stored only in your browser.
          </div>

          <div className="integration-section">
            <div className="integration-section-head">
              <span className="integration-section-title">Notion</span>
              <a
                className="integration-docs-link"
                href="https://developers.notion.com/docs/create-a-notion-integration"
                target="_blank" rel="noopener noreferrer"
              >
                How to create a token ↗
              </a>
            </div>
            <label className="settings-field-label" htmlFor="notion-token">Internal Integration Token</label>
            <input
              id="notion-token" type="password" className="settings-text-input"
              placeholder="secret_xxxxxxxxxxxxxxx"
              value={settings.notionToken || ''}
              onChange={e => onChange({ notionToken: e.target.value })}
              autoComplete="off"
            />
            <label className="settings-field-label" htmlFor="notion-db">Database ID</label>
            <input
              id="notion-db" type="text" className="settings-text-input"
              placeholder="32-character database ID from the URL"
              value={settings.notionDatabaseId || ''}
              onChange={e => onChange({ notionDatabaseId: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className="integration-section" style={{ marginTop: '1rem' }}>
            <div className="integration-section-head">
              <span className="integration-section-title">Slack</span>
              <a
                className="integration-docs-link"
                href="https://api.slack.com/messaging/webhooks"
                target="_blank" rel="noopener noreferrer"
              >
                How to create a webhook ↗
              </a>
            </div>
            <label className="settings-field-label" htmlFor="slack-webhook">Incoming Webhook URL</label>
            <input
              id="slack-webhook" type="password" className="settings-text-input"
              placeholder="https://hooks.slack.com/services/…"
              value={settings.slackWebhookUrl || ''}
              onChange={e => onChange({ slackWebhookUrl: e.target.value })}
              autoComplete="off"
            />
          </div>
        </div>

      </div>
    </>
  );
}

function ScoringDimensionsSettings({ settings, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newDesc,  setNewDesc]  = useState('');
  const [adding, setAdding] = useState(false);

  const removedSet = new Set(settings.removedDimensions || []);
  const customDims = settings.customDimensions || [];

  function removeBuiltIn(id) { onChange({ removedDimensions: [...removedSet, id] }); }
  function restoreBuiltIn(id) { onChange({ removedDimensions: [...removedSet].filter(x => x !== id) }); }
  function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    const id = 'custom_' + label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    onChange({ customDimensions: [...customDims, { id, label, description: newDesc.trim() }] });
    setNewLabel(''); setNewDesc(''); setAdding(false);
  }
  function removeCustom(id) { onChange({ customDimensions: customDims.filter(d => d.id !== id) }); }
  function resetToDefaults() { onChange({ customDimensions: [], removedDimensions: [] }); }

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
            className="template-var-input" value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Dimension name (e.g. Creativity)" maxLength={40} autoFocus
          />
          <input
            className="template-var-input" value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Short description (optional)" maxLength={120} style={{ marginTop: 6 }}
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

/* ── ImportExportModal ───────────────────────────────────── */

export function ImportExportModal({ history, saved, onClose, onImport }) {
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
      else if (format === 'csv')  exportCSV(history, saved);
      setImportStatus({ kind: 'success', message: `Exported as ${format.toUpperCase()}. Check your downloads.` });
    } catch (err) {
      console.error(err);
      setImportStatus({ kind: 'error', message: 'Export failed. Please try again.' });
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ kind: 'loading', message: `Reading ${file.name}…` });
    try {
      const text = await file.text();
      const result = importFile(file.name, text, history, saved);
      onImport(result.importedHistory, result.importedSaved);
      const parts = [`${result.totalImported} prompts imported successfully.`];
      if (result.duplicateCount > 0) parts.push(`${result.duplicateCount} skipped as duplicates.`);
      if (result.invalidCount    > 0) parts.push(`${result.invalidCount} skipped as invalid.`);
      setImportStatus({ kind: 'success', message: parts.join(' ') });
    } catch (err) {
      console.error(err);
      setImportStatus({ kind: 'error', message: err.message || 'Import failed. Please check the file and try again.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ie-title">
        <div className="modal-head">
          <h2 id="ie-title">Export / Import</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close" title="Close"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <section className="modal-section">
            <h3>Export</h3>
            <p className="modal-section-hint">
              Save a copy of your {history.length} history {history.length === 1 ? 'entry' : 'entries'}{' '}
              and {saved.length} saved {saved.length === 1 ? 'prompt' : 'prompts'} to a file.
            </p>
            <div className="format-list">
              {[
                { fmt: 'markdown', title: 'Markdown', ext: '.md', badge: null, desc: 'Human-readable. Great for reviewing or sharing.' },
                { fmt: 'json',     title: 'JSON',     ext: '.json', badge: 'Lossless', desc: 'Complete backup with every field. Best for re-importing later.' },
                { fmt: 'csv',      title: 'CSV',      ext: '.csv',  badge: null, desc: 'Flat spreadsheet format. Best for Excel / Google Sheets.' },
              ].map(({ fmt, title, ext, badge, desc }) => (
                <button key={fmt} className="format-card" onClick={() => handleExport(fmt)}>
                  <div className="format-card-head">
                    <DownloadIcon />
                    <span className="format-card-title">{title}</span>
                    <span className="format-card-ext">{ext}</span>
                    {badge && <span className="format-card-badge">{badge}</span>}
                  </div>
                  <div className="format-card-desc">{desc}</div>
                </button>
              ))}
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
            <button className="import-btn" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon />
              <span>Choose file to import…</span>
            </button>
          </section>
          {importStatus && (
            <div className={`modal-status modal-status-${importStatus.kind}`}>{importStatus.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
