import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanForPII, hasCriticalFindings } from './scan.js';
import { lintPrompt } from './lint.js';
import { importFile } from './io.js';

test('scanForPII flags an Anthropic-style API key as critical', () => {
  const findings = scanForPII('my key is sk-ant-abc123def456ghi789jkl012 please use it');
  const cred = findings.filter(f => f.category === 'credentials');
  assert.ok(cred.length >= 1);
  assert.equal(cred[0].severity, 'critical');
  assert.ok(hasCriticalFindings(findings));
});

test('scanForPII flags a Luhn-valid card but ignores an invalid one', () => {
  const valid = scanForPII('card 4111 1111 1111 1111 on file');
  assert.ok(valid.some(f => f.category === 'financial'));

  const invalid = scanForPII('number 1111 1111 1111 1111 here');
  assert.ok(!invalid.some(f => f.category === 'financial'));
});

test('scanForPII returns nothing for clean prose', () => {
  const findings = scanForPII('Write a friendly welcome email for new users.');
  assert.deepEqual(findings, []);
});

test('lintPrompt flags a too-short prompt as critical', () => {
  const hints = lintPrompt('hi');
  assert.ok(Array.isArray(hints));
  assert.ok(hints.some(h => h.severity === 'critical'));
});

test('importFile round-trips a JSON export and skips duplicates', () => {
  const payload = JSON.stringify({
    format: 'prompt-refina-export',
    version: 1,
    history: [
      { rough: 'rough one', improved: 'refined one', model: 'claude-sonnet-4-6' },
      { rough: '', improved: 'no rough — invalid' },
    ],
    saved: [],
  });

  const fresh = importFile('export.json', payload, [], []);
  assert.equal(fresh.format, 'json');
  assert.equal(fresh.importedHistory.length, 1);
  assert.equal(fresh.invalidCount, 1);
  assert.equal(fresh.importedHistory[0].imported, true);

  // Re-importing against existing data should skip the duplicate.
  const again = importFile('export.json', payload, fresh.importedHistory, []);
  assert.equal(again.importedHistory.length, 0);
  assert.equal(again.duplicateCount, 1);
});
