import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recommendModel, buildCodeSnippet, computeWordDiff,
  extractVariables, fillVariables, computeCost, averageScore,
} from './utils.js';

test('recommendModel picks the cheapest model within quality tolerance', () => {
  const rec = recommendModel([
    { modelId: 'a', quality: 5.0, cost: 0.10 },
    { modelId: 'b', quality: 4.8, cost: 0.02 },
  ], 0.4);
  assert.equal(rec.modelId, 'b');
  assert.equal(rec.isBest, false);
});

test('recommendModel keeps the top model when others fall outside tolerance', () => {
  const rec = recommendModel([
    { modelId: 'a', quality: 5.0, cost: 0.10 },
    { modelId: 'b', quality: 4.0, cost: 0.02 },
  ], 0.4);
  assert.equal(rec.modelId, 'a');
  assert.equal(rec.isBest, true);
});

test('recommendModel returns null with no usable entries', () => {
  assert.equal(recommendModel([]), null);
  assert.equal(recommendModel([{ modelId: 'a', quality: null, cost: 1 }]), null);
});

test('buildCodeSnippet produces valid-looking snippets per language', () => {
  const py = buildCodeSnippet('Summarize this.', { lang: 'anthropic-python', model: 'claude-opus-4-8' });
  assert.match(py, /anthropic\.Anthropic\(\)/);
  assert.match(py, /claude-opus-4-8/);
  assert.match(py, /Summarize this\./);

  const node = buildCodeSnippet('Summarize this.', { lang: 'anthropic-node' });
  assert.match(node, /new Anthropic\(\)/);

  const openai = buildCodeSnippet('Summarize this.', { lang: 'openai-python' });
  assert.match(openai, /from openai import OpenAI/);

  const curl = buildCodeSnippet('Summarize this.', { lang: 'curl' });
  assert.match(curl, /api\.anthropic\.com\/v1\/messages/);
});

test('buildCodeSnippet escapes backticks for the node template literal', () => {
  const node = buildCodeSnippet('use `code` here', { lang: 'anthropic-node' });
  assert.match(node, /\\`code\\`/);
});

test('extractVariables returns unique placeholder names in order', () => {
  assert.deepEqual(extractVariables('Hi {{name}}, {{name}} from {{place}}'), ['name', 'place']);
  assert.deepEqual(extractVariables('no vars'), []);
});

test('fillVariables substitutes known values and preserves unknowns', () => {
  assert.equal(fillVariables('Hi {{name}}', { name: 'Bob' }), 'Hi Bob');
  assert.equal(fillVariables('Hi {{name}}', {}), 'Hi {{name}}');
});

test('computeCost multiplies token usage by per-MTok rates', () => {
  const cost = computeCost('claude-opus-4-8', { inputTokens: 1_000_000, outputTokens: 1_000_000 });
  assert.equal(cost, 30); // 5 + 25
  assert.equal(computeCost('unknown-model', { inputTokens: 1, outputTokens: 1 }), null);
});

test('averageScore averages the per-dimension scores', () => {
  const scoreSet = {
    specificity: { score: 4 }, audience: { score: 4 }, format: { score: 4 },
    constraints: { score: 4 }, examples: { score: 4 },
  };
  assert.equal(averageScore(scoreSet), 4);
  assert.equal(averageScore(null), null);
});

test('computeWordDiff marks inserts and deletes', () => {
  const diff = computeWordDiff('the cat sat', 'the dog sat');
  assert.ok(diff.some(t => t.type === 'delete' && /cat/.test(t.text)));
  assert.ok(diff.some(t => t.type === 'insert' && /dog/.test(t.text)));
  assert.ok(diff.some(t => t.type === 'equal'));
});
