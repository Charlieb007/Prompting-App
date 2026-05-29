/**
 * Score-related components and message display components.
 * Includes: SkeletonBar, ChangesSkeleton, ScoresSkeleton, ComparisonColumnSkeleton,
 *           LintHintsPanel, RoughPromptMessage, ChangesPanel, RadarChart, ScoresPanel.
 */

import { useState } from 'react';
import { SparkIcon, GaugeIcon } from './icons.jsx';
import { SCORE_DIMENSIONS } from './constants.js';
import { averageScore } from './utils.js';

/* ── Skeleton placeholders ───────────────────────────────── */

export function SkeletonBar({ width = '100%', height = 12, strong = false }) {
  return (
    <span
      className={`skeleton-bar ${strong ? 'skeleton-strong' : ''}`}
      style={{ width, height: `${height}px` }}
    />
  );
}

export function ChangesSkeleton() {
  return (
    <div className="changes">
      <div className="changes-header">
        <span className="changes-icon skeleton-bar" style={{ width: 18, height: 18, borderRadius: '50%' }} />
        <SkeletonBar width={120} height={14} />
      </div>
      <ol className="changes-list">
        {[1, 2, 3].map((n) => (
          <li key={n} className="changes-item">
            <span className="changes-num">{n}</span>
            <div className="changes-body" style={{ flex: 1 }}>
              <SkeletonBar width="55%" height={13} strong />
              <SkeletonBar width="90%" height={11} />
              <SkeletonBar width="75%" height={11} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ScoresSkeleton() {
  return (
    <div className="scores">
      <div className="scores-header">
        <span className="scores-icon"><GaugeIcon /></span>
        <SkeletonBar width={120} height={14} />
        <div className="scores-summary">
          <SkeletonBar width={60} height={18} strong />
        </div>
      </div>
      <div className="scores-charts">
        <div className="scores-chart-block">
          <SkeletonBar width="100%" height={180} />
        </div>
        <div className="scores-chart-block">
          <SkeletonBar width="100%" height={180} />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="scores-item" style={{ padding: '8px 0' }}>
          <SkeletonBar width="30%" height={12} strong />
          <SkeletonBar width="80%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function ComparisonColumnSkeleton({ modelId }) {
  return (
    <div className="compare-col compare-col-loading">
      <div className="compare-col-header">
        <span className="compare-col-model">{modelId}</span>
        <span className="streaming-pulse" />
      </div>
      <SkeletonBar width="100%" height={120} />
    </div>
  );
}

/* ── LintHintsPanel ─────────────────────────────────────── */

export function LintHintsPanel({ hints, dismissed, onDismiss }) {
  if (!hints || hints.length === 0) return null;
  const visible = hints.filter(h => !dismissed.includes(h.id));
  if (visible.length === 0) return null;

  return (
    <div className="lint-panel">
      {visible.map(h => (
        <div key={h.id} className={`lint-hint lint-hint-${h.severity}`}>
          <div className="lint-hint-body">
            <span className="lint-hint-title">{h.label}</span>
            <span className="lint-hint-text">{h.message}</span>
          </div>
          <button className="lint-hint-dismiss" onClick={() => onDismiss(h.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}

/* ── RoughPromptMessage ─────────────────────────────────── */

export function RoughPromptMessage({ text, category, isFollowUp }) {
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

/* ── ChangesPanel ────────────────────────────────────────── */

export function ChangesPanel({ changes }) {
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

/* ── RadarChart ──────────────────────────────────────────── */

export function RadarChart({ scoreSet, variant, size = 'normal' }) {
  const dimension = size === 'small' ? 160 : 220;
  const cx   = dimension / 2;
  const cy   = dimension / 2;
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
      .map((a) => { const r = (level / 5) * maxR; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; })
      .join(' ');
  }

  const polygon = SCORE_DIMENSIONS
    .map((d, i) => pointAt(scoreSet?.[d.id]?.score ?? 0, i))
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${dimension} ${dimension}`} className={`radar-chart radar-${variant} radar-${size}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon key={level} points={ringPoints(level)} className={`radar-ring ${level === 5 ? 'radar-ring-outer' : ''}`} />
      ))}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + maxR * Math.cos(a)} y2={cy + maxR * Math.sin(a)} className="radar-spoke" />
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
            <text x={x} y={y - 4} className="radar-label" textAnchor="middle" dominantBaseline="middle">{d.label}</text>
            <text x={x} y={y + 9}  className={`radar-score radar-score-${variant}`} textAnchor="middle" dominantBaseline="middle">{score}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── ScoresPanel ─────────────────────────────────────────── */

export function ScoresPanel({ scores, chartContainerRef }) {
  if (!scores || !scores.refined) return null;

  const roughAvg   = averageScore(scores.rough);
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
          {lift !== null && lift > 0 && <span className="scores-summary-lift">+{lift.toFixed(1)}</span>}
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
          const rough   = scores.rough?.[d.id];
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
                  {dimLift !== null && dimLift > 0 && <span className="scores-item-lift">+{dimLift}</span>}
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
