import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateRallyWorldsFromRule,
  createWorldRallyViewModel,
} from '../src/features/world-rally/model.js';

const s4 = { enabled: true, worldCount: 16, groupSize: 2, strategy: 'mirror' };
const s5 = { enabled: true, worldCount: 16, groupSize: 4, strategy: 'adjacent_mirror_pairs' };

test('S4 and S5 sheet strategies cover every configured world', () => {
  for (let world = 1; world <= 16; world += 1) {
    const s4Worlds = calculateRallyWorldsFromRule(s4, world);
    const s5Worlds = calculateRallyWorldsFromRule(s5, world);
    assert.equal(s4Worlds.length, 2);
    assert.equal(s5Worlds.length, 4);
    assert.ok(s4Worlds.includes(world));
    assert.ok(s5Worlds.includes(world));
    assert.equal(new Set(s4Worlds).size, 2);
    assert.equal(new Set(s5Worlds).size, 4);
  }
});

test('World Rally ViewModel lists the realm, unknown names, current server, and disabled seasons', () => {
  const serverRows = [
    { server_id: '6002601', server_name: 'Alpha', realm_id: '26' },
    { server_id: '6002602', server_name: '', realm_id: '26' },
    { server_id: '6002616', server_name: 'Omega', realm_id: '26' },
    { server_id: '6002701', server_name: 'Other realm', realm_id: '27' },
  ];
  const ruleRows = [
    { season: 's3', enabled: 'false', world_count: 16, group_size: 1, strategy: 'none' },
    { season: 's4', enabled: 'true', world_count: 16, group_size: 2, strategy: 'mirror' },
  ];
  const ready = createWorldRallyViewModel({
    playerNumber: '600260112345',
    season: 's4',
    serverRows,
    ruleRows,
  });
  assert.deepEqual(ready.realmEntries.map((entry) => entry.serverId), ['6002601', '6002602', '6002616']);
  assert.equal(ready.realmEntries[0].isCurrent, true);
  assert.equal(ready.realmEntries[1].label, '[6002602] 未知伺服器');
  assert.deepEqual(ready.rallyEntries.map((entry) => entry.serverId), ['6002601', '6002616']);

  const disabled = createWorldRallyViewModel({
    playerNumber: '600260112345',
    season: 's3',
    serverRows,
    ruleRows,
  });
  assert.equal(disabled.supported, true);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.statusKey, 'rally_disabled');
});
