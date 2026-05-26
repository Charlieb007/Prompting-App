// Prompt Refinery extension popup logic.
// Consumes the existing /api/improve SSE stream from the local backend,
// collects all chunks, and displays the complete result when ready.
// No streaming tokens shown in popup — kept simple for the small UI.

const SCORE_DIMENSIONS = ['specificity', 'audience', 'format', 'constraints', 'examples'];

const API_URL = window.PROMPT_REFINERY_CONFIG?.apiUrl || 'http://localhost:3001';

// ── DOM references ──────────────────────────────────────────

const els = {
  roughInput: document.getElementById('rough-input'),
  categorySelect: document.getElementById('category'),
  refineBtn: document.getElementById('refine-btn'),
  refineBtnText: document.querySelector('.refine-btn-text'),
  charCount: document.getElementById('char-count'),

  emptyState: document.getElementById('empty-state'),
  loadingState: document.getElementById('loading-state'),
  resultState: document.getElementById('result-state'),
  errorState: document.getElementById('error-state'),

  resultBody: document.getElementById('result-body'),
  scorePill: document.getElementById('score-pill'),
  changesDetails: document.getElementById('changes-details'),
  changesList: document.getElementById('changes-list'),
  copyBtn: document.getElementById('copy-btn'),
  copyBtnText: document.getElementById('copy-btn-text'),
  newBtn: document.getElementById('new-btn'),

  errorText: document.getElementById('error-text'),
  errorRetryBtn: document.getElementById('error-retry-btn'),
};

// ── State ───────────────────────────────────────────────────

let lastRoughPrompt = '';
let lastCategory = 'general';
let abortController = null;

// ── Helpers ─────────────────────────────────────────────────

function averageScore(scoreSet) {
  if (!scoreSet) return null;
  const values = SCORE_DIMENSIONS
    .map((d) => scoreSet[d]?.score)
    .filter((s) => typeof s === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function showOnly(state) {
  els.emptyState.classList.toggle('hidden', state !== 'empty');
  els.loadingState.classList.toggle('hidden', state !== 'loading');
  els.resultState.classList.toggle('hidden', state !== 'result');
  els.errorState.classList.toggle('hidden', state !== 'error');
}

function updateCharCount() {
  const len = els.roughInput.value.length;
  els.charCount.textContent = len > 0 ? `${len} / 3000` : '';
  els.refineBtn.disabled = els.roughInput.value.trim().length === 0;
}

// ── Refine flow ─────────────────────────────────────────────

async function refine() {
  const prompt = els.roughInput.value.trim();
  if (!prompt) return;

  lastRoughPrompt = prompt;
  lastCategory = els.categorySelect.value;

  showOnly('loading');
  els.refineBtn.disabled = true;

  // Reset previous result UI
  els.resultBody.textContent = '';
  els.changesList.innerHTML = '';
  els.changesDetails.classList.add('hidden');
  els.scorePill.classList.add('hidden');
  els.scorePill.textContent = '';

  abortController = new AbortController();

  let refined = '';
  let changes = [];
  let scores = null;

  try {
    const response = await fetch(`${API_URL}/api/improve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, category: lastCategory }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Server returned ${response.status}`);
    }

    // Consume the SSE stream but DON'T render incrementally —
    // collect everything, then show the complete result at the end.
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

        if (eventName === 'refined-chunk') refined += payload.text;
        else if (eventName === 'changes') changes = payload.changes || [];
        else if (eventName === 'scores') scores = payload.scores;
        else if (eventName === 'error') throw new Error(payload.error || 'Unknown error');
      }
    }

    renderResult(refined, changes, scores);
  } catch (err) {
    if (err.name === 'AbortError') {
      showOnly('empty');
      return;
    }
    console.error(err);

    let message;
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      message =
        `Could not reach Prompt Refinery at ${API_URL}.\n\n` +
        `Make sure your backend is running:\n` +
        `cd ~/prompt-improver/server && npm run dev`;
    } else {
      message = err.message || 'Something went wrong. Please try again.';
    }

    els.errorText.textContent = message;
    showOnly('error');
  } finally {
    abortController = null;
    els.refineBtn.disabled = false;
  }
}

function renderResult(refined, changes, scores) {
  els.resultBody.textContent = refined;

  // Score pill: show refined-prompt overall + lift if both rough and refined are present
  if (scores) {
    const refinedAvg = averageScore(scores.refined);
    const roughAvg = averageScore(scores.rough);
    if (refinedAvg !== null) {
      let text = `${refinedAvg.toFixed(1)} / 5`;
      if (roughAvg !== null) {
        const lift = refinedAvg - roughAvg;
        if (lift > 0) text += `  +${lift.toFixed(1)}`;
      }
      els.scorePill.textContent = text;
      els.scorePill.classList.remove('hidden');
    }
  }

  // Changes list
  if (changes.length > 0) {
    changes.forEach((c) => {
      const li = document.createElement('li');
      const title = document.createElement('div');
      title.className = 'change-title';
      title.textContent = c.title;
      const explanation = document.createElement('div');
      explanation.className = 'change-explanation';
      explanation.textContent = c.explanation;
      li.appendChild(title);
      li.appendChild(explanation);
      els.changesList.appendChild(li);
    });
    els.changesDetails.classList.remove('hidden');
  }

  showOnly('result');
}

// ── Copy handler ────────────────────────────────────────────

async function handleCopy() {
  const text = els.resultBody.textContent;
  try {
    await navigator.clipboard.writeText(text);
    els.copyBtnText.textContent = 'Copied';
    setTimeout(() => {
      els.copyBtnText.textContent = 'Copy';
    }, 1500);
  } catch (err) {
    console.error('Copy failed:', err);
    els.copyBtnText.textContent = 'Copy failed';
    setTimeout(() => {
      els.copyBtnText.textContent = 'Copy';
    }, 2000);
  }
}

// ── New / reset handler ─────────────────────────────────────

function handleNew() {
  els.roughInput.value = '';
  updateCharCount();
  showOnly('empty');
  els.roughInput.focus();
}

// ── Retry handler ───────────────────────────────────────────

function handleRetry() {
  if (lastRoughPrompt) {
    els.roughInput.value = lastRoughPrompt;
    els.categorySelect.value = lastCategory;
    refine();
  } else {
    showOnly('empty');
  }
}

// ── Wire up event listeners ─────────────────────────────────

els.roughInput.addEventListener('input', updateCharCount);

els.roughInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    refine();
  }
});

els.refineBtn.addEventListener('click', refine);
els.copyBtn.addEventListener('click', handleCopy);
els.newBtn.addEventListener('click', handleNew);
els.errorRetryBtn.addEventListener('click', handleRetry);

// ── Initial focus ───────────────────────────────────────────

updateCharCount();
showOnly('empty');
// Brief delay so the popup is fully painted before the focus call,
// otherwise some browsers ignore the focus.
setTimeout(() => els.roughInput.focus(), 50);
