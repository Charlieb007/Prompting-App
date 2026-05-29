import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRefinerResponse,
  targetModelGuidance,
  promptTypeGuidance,
  buildSystemPrompt,
  REFINER_USER_TEMPLATE,
  FOLLOWUP_USER_TEMPLATE,
} from './lib.js';

test('parseRefinerResponse extracts refined text, changes, and scores', () => {
  const full = `<<<REFINED_PROMPT>>>
  Write a haiku about autumn leaves.
<<<CHANGES_JSON>>>
[{"title":"Added topic","explanation":"Specified autumn leaves."}]
<<<SCORES_JSON>>>
{"rough":{"specificity":{"score":2,"rationale":"vague"}},"refined":{"specificity":{"score":5,"rationale":"clear"}}}
<<<END>>>`;
  const out = parseRefinerResponse(full);
  assert.equal(out.refined, 'Write a haiku about autumn leaves.');
  assert.equal(out.changes.length, 1);
  assert.equal(out.changes[0].title, 'Added topic');
  assert.equal(out.scores.refined.specificity.score, 5);
});

test('parseRefinerResponse tolerates malformed JSON sections', () => {
  const full = `<<<REFINED_PROMPT>>>
Refined here.
<<<CHANGES_JSON>>>
[not valid json
<<<SCORES_JSON>>>
{also broken
<<<END>>>`;
  const out = parseRefinerResponse(full);
  assert.equal(out.refined, 'Refined here.');
  assert.deepEqual(out.changes, []);
  assert.equal(out.scores, null);
});

test('parseRefinerResponse returns empty defaults when delimiters are missing', () => {
  const out = parseRefinerResponse('no delimiters at all');
  assert.equal(out.refined, '');
  assert.deepEqual(out.changes, []);   // defaults to '[]' → []
  assert.deepEqual(out.scores, {});    // defaults to '{}' → {}
});

test('targetModelGuidance maps model families by prefix', () => {
  assert.match(targetModelGuidance('claude-opus-4-8'), /XML/);
  assert.match(targetModelGuidance('gpt-4'), /Markdown/);
  assert.match(targetModelGuidance('gemini-pro'), /Gemini/);
  assert.equal(targetModelGuidance(''), '');
  assert.equal(targetModelGuidance(undefined), '');
  assert.equal(targetModelGuidance('mistral-large'), '');
});

test('promptTypeGuidance only fires for system prompts', () => {
  assert.match(promptTypeGuidance('system'), /SYSTEM prompt/);
  assert.equal(promptTypeGuidance('user'), '');
  assert.equal(promptTypeGuidance(undefined), '');
});

test('buildSystemPrompt includes custom dimensions and appended guidance', () => {
  const sp = buildSystemPrompt(
    [{ id: 'creativity', label: 'Creativity', description: 'How original it is.' }],
    { targetModel: 'gpt-4', promptType: 'system' }
  );
  assert.match(sp, /creativity/);
  assert.match(sp, /Markdown/);       // target guidance
  assert.match(sp, /SYSTEM prompt/);  // prompt-type guidance
});

test('buildSystemPrompt falls back to default dimensions when none given', () => {
  const sp = buildSystemPrompt();
  assert.match(sp, /specificity/);
  assert.match(sp, /examples/);
});

test('user templates embed the prompt and category', () => {
  const u = REFINER_USER_TEMPLATE('do the thing', 'code', 'be terse');
  assert.match(u, /Category: code/);
  assert.match(u, /do the thing/);
  assert.match(u, /be terse/);

  const f = FOLLOWUP_USER_TEMPLATE('rough', 'previous refined', 'make shorter', 'writing');
  assert.match(f, /previous refined/);
  assert.match(f, /make shorter/);
});
