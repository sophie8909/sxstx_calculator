import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UNKNOWN_SERVER_NAME,
  buildServerId,
  calculateRallyWorlds,
  createRallyResult,
  formatServerLabel,
  parsePlayerNumber,
} from '../src/core/serverWorlds.js';

const serverRows = [
  { server_id: '6001201', server_name: '晨曦之城', realm_id: '12' },
  { server_id: '6001202', server_name: '', realm_id: '12' },
  { server_id: '6001215', server_name: '永夜王庭', realm_id: '12' },
  { server_id: '6001216', server_name: '星海之境', realm_id: '12' },
  { server_id: '6003501', server_name: '遠方之門', realm_id: '35' },
  { server_id: '6003502', server_name: '霧海', realm_id: '35' },
  { server_id: '6003503', server_name: '白塔', realm_id: '35' },
  { server_id: '6003508', server_name: '潮汐', realm_id: '35' },
  { server_id: '6003510', server_name: '星橋', realm_id: '35' },
  { server_id: '6003515', server_name: '月庭', realm_id: '35' },
  { server_id: '6003516', server_name: '天際', realm_id: '35' },
];

test('buildServerId keeps the canonical realm code and pads worlds', () => {
  assert.equal(buildServerId('60012', 1), '6001201');
  assert.equal(buildServerId('60012', 9), '6001209');
  assert.equal(buildServerId('60012', 16), '6001216');
});

test('S4 mirrored groups are correct in two independent realms', () => {
  const expected = new Map([
    [1, [1, 16]],
    [2, [2, 15]],
    [8, [8, 9]],
    [16, [1, 16]],
  ]);

  for (const realmCode of ['60012', '60035']) {
    for (const [world, worlds] of expected) {
      assert.deepEqual(calculateRallyWorlds('s4', world), worlds);
      assert.ok(worlds.every((entry) => buildServerId(realmCode, entry).startsWith(realmCode)));
    }
  }
});

test('S5 adjacent mirrored groups are correct in two independent realms', () => {
  const expected = new Map([
    [1, [1, 16, 2, 15]],
    [15, [1, 16, 2, 15]],
    [3, [3, 14, 4, 13]],
    [10, [7, 10, 8, 9]],
  ]);

  for (const realmCode of ['60012', '60035']) {
    for (const [world, worlds] of expected) {
      assert.deepEqual(calculateRallyWorlds('s5', world), worlds);
      assert.ok(worlds.every((entry) => entry <= 16));
      assert.ok(worlds.every((entry) => buildServerId(realmCode, entry).startsWith(realmCode)));
    }
  }
});

test('canonical player parsing returns realm and world without global normalization', () => {
  const realm12 = parsePlayerNumber('600120212345', serverRows);
  const realm35 = parsePlayerNumber('600351012345', serverRows);
  assert.deepEqual(
    { realm: realm12.realm, realmCode: realm12.realmCode, world: realm12.world },
    { realm: '12', realmCode: '60012', world: 2 }
  );
  assert.deepEqual(
    { realm: realm35.realm, realmCode: realm35.realmCode, world: realm35.world },
    { realm: '35', realmCode: '60035', world: 10 }
  );
  assert.equal(parsePlayerNumber('600121712345', serverRows).error, 'world_out_of_range');
  assert.equal(parsePlayerNumber('60012021234', serverRows).error, 'invalid_player_number');
});

test('rally results look up every server, preserve order, and highlight the full ID', () => {
  const player = parsePlayerNumber('600121512345', serverRows);
  const result = createRallyResult(player, 's5', serverRows);

  assert.equal(result.realmCode, '60012');
  assert.deepEqual(
    result.entries.map((entry) => entry.serverId),
    ['6001201', '6001216', '6001202', '6001215']
  );
  assert.deepEqual(
    result.entries.map((entry) => entry.label),
    ['[6001201]晨曦之城', '[6001216]星海之境', `[6001202]${UNKNOWN_SERVER_NAME}`, '[6001215]永夜王庭']
  );
  assert.deepEqual(result.entries.filter((entry) => entry.isCurrent).map((entry) => entry.serverId), ['6001215']);
});

test('missing server rows still render exact unknown labels', () => {
  assert.equal(formatServerLabel(serverRows, '6001214'), '[6001214]未知伺服器');
  assert.equal(formatServerLabel(serverRows, '6001203'), '[6001203]未知伺服器');
});

test('unsupported seasons and invalid worlds are rejected', () => {
  assert.throws(() => calculateRallyWorlds('s3', 1), /Unsupported/);
  assert.throws(() => calculateRallyWorlds('s4', 17), /1 through 16/);
  assert.throws(() => buildServerId('60012', 0), /1 through 16/);
});
