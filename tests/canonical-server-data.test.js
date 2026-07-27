import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createServerMap,
  mergeCanonicalServerRows,
  mergeServerRows,
  normalizeSubmittedServerRows,
} from '../src/core/serverData.js';
import { parsePlayerNumber } from '../src/core/serverWorlds.js';

test('canonical sheet names override local names while preserving local merge metadata', () => {
  const local = [{
    server_id: '6000101',
    server_name: 'Local name',
    merge_16: '0101-0116',
  }];
  const canonical = normalizeSubmittedServerRows([
    { server_id: '6000101', server_name: 'Manual canonical name' },
    { server_id: '6002902', server_name: '龍之逆鱗' },
  ]).rows;
  const map = createServerMap(mergeCanonicalServerRows(local, canonical));

  assert.equal(map.get('6000101').server_name, 'Manual canonical name');
  assert.equal(map.get('6000101').merge_16, '0101-0116');
  assert.equal(map.get('6002902').server_name, '龍之逆鱗');
});

test('valid player IDs remain parseable when a server name is not loaded yet', () => {
  const parsed = parsePlayerNumber('600291512345', []);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.realmCode, '60029');
  assert.equal(parsed.world, 15);
  assert.equal(parsed.server, null);
});

test('canonical rows override submissions while form-only server names remain available', () => {
  const local = [{ server_id: '6000101', server_name: 'Built-in' }];
  const submitted = normalizeSubmittedServerRows([
    { server_id: '6000101', server_name: 'Submitted conflict' },
    { server_id: '6003206', server_name: '測試' },
  ]).rows;
  const canonical = normalizeSubmittedServerRows([
    { server_id: '6000101', server_name: 'Canonical' },
  ]).rows;
  const map = createServerMap(
    mergeCanonicalServerRows(mergeServerRows(local, submitted), canonical)
  );

  assert.equal(map.get('6000101').server_name, 'Canonical');
  assert.equal(map.get('6003206').server_name, '測試');
});

test('website server loading uses only the canonical server sheet', async () => {
  const [dataService, registry] = await Promise.all([
    readFile(new URL('../src/services/dataService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/sheetRegistry.js', import.meta.url), 'utf8'),
  ]);

  assert.match(registry, /servers:[\s\S]*gid: 1981289603/);
  assert.match(dataService, /loadSheet\('servers'\)/);
  assert.doesNotMatch(dataService, /serverSubmissions|mergeServerRows|mergeCanonicalServerRows|data\/raw/);
});

test('World Rally falls back to the selected complete server ID when Player ID is empty', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');

  assert.match(controller, /selectedOption\?\.dataset\.serverId/);
  assert.match(controller, /enteredPlayerNumber \|\| `\$\{selectedServerId\}00000`/);
  assert.match(controller, /serverSelect\.addEventListener\('change', renderWhenActive\)/);
});
