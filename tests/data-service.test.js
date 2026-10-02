import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  clearDataServiceMemoryCache,
  loadSheet,
  normalizeHeader,
  parseCsvRows,
  validateSheetHeaders,
} from '../src/services/dataService.js';
import { SHEETS } from '../src/services/sheetRegistry.js';
import { fetchAndParseCsv } from '../src/features/progression/legacyAdapter.js';

test('CSV parsing supports BOM, quoted commas, escaped quotes, CRLF, LF, blanks, and empty cells', () => {
  const rows = parseCsvRows('\uFEFFa,b,c\r\n1,"two, too","a ""quote"""\n\n2,,3\r\n');
  assert.deepEqual(rows, [
    ['\uFEFFa', 'b', 'c'],
    ['1', 'two, too', 'a "quote"'],
    ['2', '', '3'],
  ]);
  assert.equal(normalizeHeader(rows[0][0]), 'a');
});

test('required headers accept configured legacy aliases and reject missing columns', () => {
  assert.deepEqual(
    validateSheetHeaders(['伺服器編號', '伺服器名稱', 'server_short', 'realm_id', 'merge_2', 'merge_4', 'merge_8', 'merge_16', 'current_state'], SHEETS.servers),
    ['伺服器編號', '伺服器名稱', 'server_short', 'realm_id', 'merge_2', 'merge_4', 'merge_8', 'merge_16', 'current_state']
  );
  assert.throws(
    () => validateSheetHeaders(['season'], SHEETS.rallyRules),
    /missing required headers/
  );
});

test('production data service has no bundled or mock fallback paths', async () => {
  const [service, model, vite, packageJson] = await Promise.all([
    readFile(new URL('../src/services/dataService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/model.js', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);
  const source = `${service}\n${model}\n${vite}\n${packageJson}`;
  for (const forbidden of [
    'upgrade-costs.json',
    'GENERATED_DATA_PATH',
    'MOCK_GAME_DATA',
    'TIME_PRESETS_FALLBACK',
    'build:data',
    'copy-generated-data',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('legacy CSV loading skips preamble and preserves quoted fields and numeric blanks', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = undefined;
  globalThis.fetch = async () => new Response(
    'Published data\r\nlevel,season,note,cost_exp\r\n1,s2,"comma, value",\r\n2,s2,"line one\nline ""two""","1,234"\r\n',
    { headers: { 'content-type': 'text/csv' } }
  );
  try {
    assert.deepEqual(await fetchAndParseCsv('https://example.test/legacy.csv'), [
      { level: 1, season: 's2', note: 'comma, value', cost_exp: 0 },
      { level: 2, season: 's2', note: 'line one\nline "two"', cost_exp: 1234 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test('sheet loading shares concurrent requests and returns warm cached data', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  clearDataServiceMemoryCache();
  let calls = 0;
  let resolveFetch;
  globalThis.fetch = () => {
    calls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  try {
    const first = loadSheet('gameSettings', { refresh: true });
    const second = loadSheet('gameSettings');
    assert.equal(first, second);
    resolveFetch(new Response('key,value,season,type,description\nspeed,12,s2,number,"a, b"', {
      headers: { 'content-type': 'text/csv' },
    }));
    assert.deepEqual(await first, [{ key: 'speed', value: 12, season: 's2', type: 'number', description: 'a, b' }]);
    assert.equal(calls, 1);
    clearDataServiceMemoryCache();
    globalThis.fetch = async () => new Response('key,value,season,type,description\nspeed,12,s2,number,"a, b"', { headers: { 'content-type': 'text/csv' } });
    const warm = await Promise.race([
      loadSheet('gameSettings'),
      new Promise((resolve) => setTimeout(() => resolve('blocked'), 25)),
    ]);
    assert.deepEqual(warm, [{ key: 'speed', value: 12, season: 's2', type: 'number', description: 'a, b' }]);
  } finally {
    clearDataServiceMemoryCache();
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});
