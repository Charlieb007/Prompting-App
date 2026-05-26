/**
 * A/B test components: ABTestInvite, ABTestPanel, ABTestResults, ABTestColumn.
 * Also exports FollowUpPanel (sits below A/B test in the conversation flow).
 */

import { useState } from 'react';
import { EyeIcon, PlayIcon, ChevronDownIcon, CloseIcon, ArrowRightIcon } from './icons.jsx';
import { FOLLOWUP_PRESETS } from './constants.js';
import { modelShortName, computeCost, formatCost, formatLatency } from './utils.js';

export function ABTestInvite({ disabled, onOpen, hasResults }) {
  return (
    <button
      type="button"
      className="abtest-invite-btn"
      onClick={onOpen}
      disabled={disabled}
    >
      {hasResults ? <EyeIcon /> : <PlayIcon />}
      <span>{hasResults ? 'View A/B test results' : 'Test this refined prompt (A/B vs rough)'}</span>
      <span className="abtest-chevron"><ChevronDownIcon /></span>
    </button>
  );
}

export function ABTestPanel({ roughPrompt, refinedPrompt, testModel, onClose, onRun, test, busy }) {
  const [mode, setMode] = useState('both');
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
            <button type="button" className={`abtest-mode-btn ${mode === 'both' ? 'active' : ''}`} onClick={() => setMode('both')} disabled={busy}>
              Run both (rough + refined)
            </button>
            <button type="button" className={`abtest-mode-btn ${mode === 'refined-only' ? 'active' : ''}`} onClick={() => setMode('refined-only')} disabled={busy}>
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
            <button type="button" className="abtest-run-btn" onClick={() => onRun(mode)} disabled={busy}>
              {busy ? 'Running…' : `Run test (${mode === 'both' ? '2' : '1'} call${mode === 'both' ? 's' : ''})`}
            </button>
          </div>
        </>
      )}

      {showResults && <ABTestResults test={test} mode={test.mode} testModel={testModel} />}
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

/* ── FollowUpPanel ───────────────────────────────────────── */

export function FollowUpPanel({ disabled, onSubmit }) {
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
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
          placeholder="Or describe what to change..."
          disabled={disabled}
          maxLength={300}
        />
        <button
          className="followup-submit"
          onClick={handleSubmit}
          disabled={disabled || !feedback.trim()}
          aria-label="Apply feedback" title="Apply feedback"
        >
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}
