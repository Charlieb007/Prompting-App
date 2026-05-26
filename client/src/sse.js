/**
 * SSE streaming client utilities for Prompt Refinery.
 * All functions are pure async — no React, no side-effects.
 */

export async function consumeSSE(response, handlers) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Server returned an error.');
  }

  const reader  = response.body.getReader();
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
      let dataLine  = '';
      for (const line of lines) {
        if (line.startsWith('event:'))      eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine   = line.slice(5).trim();
      }
      if (!dataLine) continue;
      let payload;
      try { payload = JSON.parse(dataLine); }
      catch { continue; }
      handlers[eventName]?.(payload);
    }
  }
}

export async function streamRefinement({ url, body, onChunk, onRefinedDone, onChanges, onScores, onDone, onError, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'refined-chunk': (p) => onChunk?.(p.text),
    'refined-done':  ()  => onRefinedDone?.(),
    'changes':       (p) => onChanges?.(p.changes || []),
    'scores':        (p) => onScores?.(p.scores || null),
    'done':          (p) => onDone?.(p),
    'error':         (p) => onError?.(p.error || 'Unknown error'),
  });
}

export async function streamComparison({ url, body, onStart, onModelChunk, onModelChanges, onModelScores, onModelDone, onModelError, onDone, onError, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'compare-start':  (p) => onStart?.(p),
    'model-chunk':    (p) => onModelChunk?.(p.modelId, p.text),
    'model-changes':  (p) => onModelChanges?.(p.modelId, p.changes || []),
    'model-scores':   (p) => onModelScores?.(p.modelId, p.scores || null),
    'model-done':     (p) => onModelDone?.(p.modelId, p.usage, p.latencyMs),
    'model-error':    (p) => onModelError?.(p.modelId, p.error),
    'compare-done':   ()  => onDone?.(),
    'error':          (p) => onError?.(p.error || 'Unknown error'),
  });
}

export async function streamTest({ url, body, onChunk, onDone, onError, onComplete, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'test-start':    () => { /* noop */ },
    'test-chunk':    (p) => onChunk?.(p.id, p.text),
    'test-done':     (p) => onDone?.(p.id, p.usage, p.latencyMs),
    'test-error':    (p) => onError?.(p.id, p.error),
    'test-complete': ()  => onComplete?.(),
    'error':         (p) => onError?.(null, p.error || 'Unknown error'),
  });
}

export async function streamRunPrompt({ url, body, onChunk, onDone, onError, signal }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSSE(response, {
    'run-chunk': (p) => onChunk?.(p.text),
    'run-done':  (p) => onDone?.(p),
    'run-error': (p) => onError?.(p.error || 'Run failed.'),
  });
}
