import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batchStateTone, formatDuration, relativeTime, runStatusTone, sourceStatusTone, titleCase } from './format.ts';

test('formatDuration renders ms / s / m and null', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(undefined), '—');
  assert.equal(formatDuration(340), '340ms');
  assert.equal(formatDuration(1500), '1.5s');
  assert.equal(formatDuration(12000), '12s');
  assert.equal(formatDuration(125000), '2m 05s');
});

test('relativeTime is pure with an injected "now"', () => {
  const now = Date.parse('2026-09-03T12:00:00Z');
  assert.equal(relativeTime(null, now), '—');
  assert.equal(relativeTime('2026-09-03T11:59:30Z', now), 'just now');
  assert.equal(relativeTime('2026-09-03T11:50:00Z', now), '10m ago');
  assert.equal(relativeTime('2026-09-03T09:00:00Z', now), '3h ago');
  assert.equal(relativeTime('2026-09-01T12:00:00Z', now), '2d ago');
});

test('titleCase humanizes SCREAMING_SNAKE', () => {
  assert.equal(titleCase('IN_PROGRESS'), 'In progress');
  assert.equal(titleCase('RECEIVING'), 'Receiving');
});

test('status → tone maps', () => {
  assert.equal(sourceStatusTone('VERIFIED'), 'ok');
  assert.equal(sourceStatusTone('FAILED'), 'bad');
  assert.equal(sourceStatusTone('REGISTERED'), 'neutral');
  assert.equal(runStatusTone('SUCCESS'), 'ok');
  assert.equal(runStatusTone('PARTIAL'), 'warn');
  assert.equal(runStatusTone('FAILED'), 'bad');
  assert.equal(runStatusTone('RUNNING'), 'info');
  assert.equal(batchStateTone('COMPLETED'), 'ok');
  assert.equal(batchStateTone('IN_PROGRESS'), 'info');
  assert.equal(batchStateTone('BLOCKED'), 'bad');
  assert.equal(batchStateTone('PLANNED'), 'neutral');
});
