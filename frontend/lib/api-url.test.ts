import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiUrl, buildQuery } from './api-url.ts';

test('buildQuery encodes and joins pairs in insertion order', () => {
  assert.equal(buildQuery({ a: '1', b: 'two' }), 'a=1&b=two');
});

test('buildQuery drops undefined, null, and empty-string values', () => {
  assert.equal(buildQuery({ a: '', b: null, c: undefined, d: 'x' }), 'd=x');
});

test('buildQuery keeps falsy-but-meaningful values (false, 0)', () => {
  assert.equal(buildQuery({ a: false, b: 0 }), 'a=false&b=0');
});

test('buildQuery percent-encodes keys and values', () => {
  assert.equal(buildQuery({ q: 'a b&c' }), 'q=a%20b%26c');
});

test('apiUrl trims a trailing base slash and adds a missing path slash', () => {
  assert.equal(apiUrl('http://host:3001/', 'api/sources'), 'http://host:3001/api/sources');
});

test('apiUrl appends a query string when params are present', () => {
  assert.equal(
    apiUrl('http://host:3001', '/api/observations', { station: 'WASHING', lineId: 'LINE-A' }),
    'http://host:3001/api/observations?station=WASHING&lineId=LINE-A',
  );
});

test('apiUrl omits the ? when every param is empty', () => {
  assert.equal(apiUrl('http://host:3001', '/api/observations', { station: undefined }), 'http://host:3001/api/observations');
});
