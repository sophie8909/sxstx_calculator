import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlayerNumber,
  deriveServerContext,
  parsePlayerNumber,
  resolvePlayerContext,
} from '../src/core/serverWorlds.js';

const servers = [
  { server_id: '6001509', server_name: '星河之境', realm_id: '60015' },
  { server_id: '6002603', server_name: '蒼穹之門', realm_id: '60026' },
];

test('canonical player parsing preserves the seven-digit server, five-digit suffix, realm, and world strings', () => {
  assert.deepEqual(parsePlayerNumber('600150900582', servers), {
    ok: true,
    playerNumber: '600150900582',
    playerSuffix: '00582',
    serverId: '6001509',
    server: servers[0],
    serverName: '星河之境',
    realmCode: '60015',
    realm: '60015',
    world: '09',
    worldNumber: 9,
  });
});

test('player input selects the matching server and switches on another valid prefix', () => {
  const first = resolvePlayerContext({ source: 'player-input', playerNumber: '600150900582', serverRows: servers });
  const second = resolvePlayerContext({ source: 'player-input', playerNumber: '600260300582', serverRows: servers });
  assert.equal(first.serverId, '6001509');
  assert.equal(second.serverId, '6002603');
  assert.equal(second.playerSuffix, '00582');
});

test('incomplete input clears a previously parsed server context', () => {
  const result = resolvePlayerContext({ source: 'player-input', playerNumber: '6001509', serverRows: servers });
  assert.equal(result.serverId, '');
  assert.equal(result.playerNumber, '6001509');
});

test('unknown but structurally valid server IDs remain representable', () => {
  const result = resolvePlayerContext({ source: 'player-input', playerNumber: '600150900582', serverRows: [] });
  assert.equal(result.serverId, '6001509');
  assert.equal(result.serverName, '未知伺服器');
  assert.equal(result.realmCode, '60015');
  assert.equal(result.world, '09');
});

test('server selection replaces only the prefix and preserves leading-zero suffixes', () => {
  const result = resolvePlayerContext({ source: 'server-select', serverId: '6002603', playerNumber: '600150900582', serverRows: servers });
  assert.equal(result.playerNumber, '600260300582');
  assert.equal(result.playerSuffix, '00582');
  assert.equal(buildPlayerNumber('6002603', '00582'), '600260300582');
});

test('server selection without a usable suffix never fabricates zeros', () => {
  const result = resolvePlayerContext({ source: 'server-select', serverId: '6002603', playerNumber: '', serverRows: servers });
  assert.equal(result.playerNumber, '');
  assert.equal(result.playerSuffix, '');
  assert.notEqual(result.playerNumber, '6002603000000');
  assert.equal(deriveServerContext('6002603', servers).world, '03');
});
