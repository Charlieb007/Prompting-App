/**
 * Model comparison components: CompareInvite, ComparisonColumn, ComparisonStrip.
 */

import { useState } from 'react';
import { CompareIcon, ChevronDownIcon, CheckIcon, CloseIcon } from './icons.jsx';
import { MODELS, SCORE_DIMENSIONS } from './constants.js';
import { modelShortName, computeCost, formatCost, formatLatency, averageScore, recommendModel } from './utils.js';

// RadarChart is needed inline for ComparisonColumn
function SmallRadarChart({ scoreSet, variant }) {
  const dimension = 160;
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
  function ringPoints(level) {
    return angles
      .map((a) => { const r = (level / 5) * maxR; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; })
      .join(' ');
  }
  const polygon = SCORE_DIMENSIONS
    .map((d, i) => pointAt(scoreSet?.[d.id]?.score ?? 0, i))
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${dimension} ${dimension}`} className={`radar-chart radar-${variant} radar-small`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon key={level} points={ringPoints(level)} className="radar-ring" />
      ))}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + maxR * Math.cos(a)} y2={cy + maxR * Math.sin(a)} className="radar-spoke" />
      ))}
      <polygon points={polygon} className="radar-polygon" />
      {SCORE_DIMENSIONS.map((d, i) => {
        const [lx, ly] = [cx + (maxR + 18) * Math.cos(angles[i]), cy + (maxR + 18) * Math.sin(angles[i])];
        return <text key={d.id} x={lx} y={ly} className="radar-label" textAnchor="middle" dominantBaseline="middle">{d.label}</text>;
      })}
    </svg>
  );
}

export function CompareInvite({ primaryModel, onCompare, disabled }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const candidates = MODELS.filter((m) => m.available && m.id !== primaryModel);

  function toggle(modelId) {
    const next = new Set(selected);
    if (next.has(modelId)) next.delete(modelId); else next.add(modelId);
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
              const isSelected       = selected.has(m.id);
              const disabledForLimit = !isSelected && selected.size >= 3;
              return (
                <button
                  key={m.id}
                  className={`compare-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggle(m.id)}
                  disabled={disabledForLimit}
                >
                  <div className="compare-picker-check">{isSelected && <CheckIcon />}</div>
                  <div className="compare-picker-name">
                    <span>{m.shortName}</span>
                    <span className="compare-picker-desc">{m.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="compare-picker-actions">
            <button className="text-btn" onClick={() => { setPickerOpen(false); setSelected(new Set()); }}>Cancel</button>
            <button className="compare-run-btn" onClick={handleCompare} disabled={selected.size === 0}>
              Run comparison ({selected.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComparisonColumn({ column, onUseVersion }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const refinedAvg = averageScore(column.scores?.refined);
  const cost       = column.usage ? computeCost(column.modelId, column.usage) : null;

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
    return (
      <div className="compare-col compare-col-loading">
        <div className="compare-col-header">
          <span className="compare-col-model">{modelShortName(column.modelId)}</span>
          <span className="streaming-pulse" />
        </div>
      </div>
    );
  }

  const isStreaming = !column.complete && column.refined;

  return (
    <div className="compare-col">
      <div className="compare-col-header">
        <span className="compare-col-model">{modelShortName(column.modelId)}</span>
        {refinedAvg !== null && <span className="compare-col-score">{refinedAvg.toFixed(1)}/5</span>}
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
          <SmallRadarChart scoreSet={column.scores.refined} variant="refined" />
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
            <button type="button" className="compare-col-action primary" onClick={() => onUseVersion(column)}>
              <span>Use this version</span>
            </button>
          )}
          {(column.changes?.length > 0 || column.scores) && (
            <button type="button" className="compare-col-action" onClick={() => setExpanded(!expanded)}>
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

export function ComparisonStrip({
  comparison, primaryModel, primaryRefined, primaryScores, primaryChanges,
  primaryUsage, primaryLatencyMs, onUseVersion, onClose, busy,
}) {
  if (!comparison) return null;

  const primaryColumn = {
    modelId: primaryModel, refined: primaryRefined, scores: primaryScores,
    changes: primaryChanges, usage: primaryUsage, latencyMs: primaryLatencyMs,
    complete: true, isPrimary: true,
  };

  const columns = [primaryColumn, ...comparison.columns];

  // Cost optimizer: among the completed, error-free columns, recommend the
  // cheapest model whose quality is within tolerance of the best.
  const recommendation = recommendModel(
    columns
      .filter((c) => c.complete && !c.error && c.scores?.refined)
      .map((c) => ({
        modelId: c.modelId,
        quality: averageScore(c.scores.refined),
        cost: c.usage ? computeCost(c.modelId, c.usage) : null,
      }))
  );

  return (
    <div className="compare-strip">
      <div className="compare-strip-header">
        <span className="compare-strip-label">Model comparison</span>
        <span className="compare-strip-hint">Same rough prompt refined by {columns.length} models</span>
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
      {recommendation && columns.filter((c) => c.complete && !c.error).length > 1 && (
        <div className="compare-recommendation">
          <span className="compare-recommendation-badge">Best value</span>
          <span className="compare-recommendation-text">
            <strong>{modelShortName(recommendation.modelId)}</strong>
            {recommendation.quality != null && ` · ${recommendation.quality.toFixed(1)}/5`}
            {recommendation.cost != null && ` · ${formatCost(recommendation.cost)}`}
            {' — '}{recommendation.reason}
          </span>
        </div>
      )}
      <div className="compare-grid" data-cols={columns.length}>
        {columns.map((column) => (
          <ComparisonColumn key={column.modelId} column={column} onUseVersion={onUseVersion} />
        ))}
      </div>
    </div>
  );
}
