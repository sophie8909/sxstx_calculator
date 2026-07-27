import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  normalizeHeader,
  parseCsvRows,
  validateSheetHeaders,
} from '../src/services/dataService.js';
import { SHEETS } from '../src/services/sheetRegistry.js';

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
