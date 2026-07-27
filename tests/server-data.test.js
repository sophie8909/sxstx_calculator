import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createServerMap,
  isValidServerId,
  mergeServerRows,
  normalizeSubmittedServerRows,
  parseSubmittedServerTimestamp,
} from '../src/core/serverData.js';

test('server IDs enforce seven digits and worlds 01 through 16', () => {
  for (const serverId of ['6002902', '6002909', '6003211', '6003204']) {
    assert.equal(isValidServerId(serverId), true, serverId);
  }
  for (const serverId of ['6002921', '6000152', '600290', '60029020', 'server']) {
    assert.equal(isValidServerId(serverId), false, serverId);
  }
});

test('submitted rows trim values, reject invalid data, and keep the latest duplicate', () => {
  const normalized = normalizeSubmittedServerRows([
    { timestamp: '2026/7/20 上午 1:43:21', server_id: ' 6002902 ', server_name: ' 龍之逆鱗 ' },
    { timestamp: '2026/7/20 下午 11:38:00', server_id: '6002909', server_name: '异世相遇' },
    { timestamp: '2026/7/21 下午 11:27:06', server_id: '6003211', server_name: '共鳴空間' },
    { timestamp: '2026/7/22 上午 7:16:09', server_id: '6003204', server_name: '舊名稱' },
    { timestamp: '2026/7/23 下午 9:53:39', server_id: '6003204', server_name: '完美結構' },
    { timestamp: '2026/7/26 下午 11:42:53', server_id: '6000152', server_name: '世界 52' },
    { timestamp: '', server_id: '6002921', server_name: '世界 21' },
    { timestamp: '', server_id: '6003001', server_name: '' },
  ]);
  const map = createServerMap(normalized.rows);

  assert.equal(map.get('6002902').server_name, '龍之逆鱗');
  assert.equal(map.get('6002909').server_name, '异世相遇');
  assert.equal(map.get('6003211').server_name, '共鳴空間');
  assert.equal(map.get('6003204').server_name, '完美結構');
  assert.deepEqual(normalized.invalidRows.map((row) => row.server_id), ['6000152', '6002921', '6003001']);
});

test('unparseable duplicate timestamps deterministically use the last sheet row', () => {
  const normalized = normalizeSubmittedServerRows([
    { timestamp: 'unknown', server_id: '6003001', server_name: 'First' },
    { timestamp: 'also unknown', server_id: '6003001', server_name: 'Last' },
  ]);
  assert.equal(normalized.rows[0].server_name, 'Last');
});

test('built-in rows remain canonical and submitted rows only fill missing IDs', () => {
  const builtIn = [
    { server_id: '6002601', server_name: 'Canonical' },
    { server_id: '6002902', server_name: 'Built-in wins' },
  ];
  const submitted = normalizeSubmittedServerRows([
    { server_id: '6002902', server_name: 'Must not overwrite' },
    { server_id: '6003204', server_name: 'New server' },
  ]).rows;
  const map = createServerMap(mergeServerRows(builtIn, submitted));

  assert.equal(map.get('6002601').server_name, 'Canonical');
  assert.equal(map.get('6002902').server_name, 'Built-in wins');
  assert.equal(map.get('6003204').server_name, 'New server');
});

test('Traditional Chinese timestamps parse in chronological order', () => {
  assert.ok(
    parseSubmittedServerTimestamp('2026/7/23 下午 9:53:39')
      > parseSubmittedServerTimestamp('2026/7/23 上午 7:16:09')
  );
});
