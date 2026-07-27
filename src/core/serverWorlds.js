export const UNKNOWN_SERVER_NAME = '名稱未知';
export const SUPPORTED_RALLY_SEASONS = Object.freeze(['s4', 's5']);

export function formatWorldNumber(world) {
  const value = Number(world);
  if (!Number.isInteger(value) || value < 1 || value > 16) {
    throw new RangeError('World number must be an integer from 1 through 16.');
  }
  return String(value).padStart(2, '0');
}

export function buildServerId(realmCode, world) {
  const canonicalRealmCode = String(realmCode ?? '').trim();
  if (!/^600\d{2}$/.test(canonicalRealmCode)) {
    throw new TypeError('Realm code must use the canonical 600XX format.');
  }
  return `${canonicalRealmCode}${formatWorldNumber(world)}`;
}

export function findServerById(serverRows, serverId) {
  const canonicalServerId = String(serverId ?? '').trim();
  return (serverRows || []).find(
    (server) => String(server?.server_id ?? '').trim() === canonicalServerId
  ) || null;
}

export function getServerDisplayName(serverRows, serverId) {
  const serverName = String(findServerById(serverRows, serverId)?.server_name ?? '').trim();
  return serverName || UNKNOWN_SERVER_NAME;
}

export function formatServerLabel(serverRows, serverId) {
  return `[${serverId}]${getServerDisplayName(serverRows, serverId)}`;
}

export function parsePlayerNumber(playerNumber, serverRows) {
  const value = String(playerNumber ?? '').trim();
  if (!/^\d{12}$/.test(value)) {
    return { ok: false, error: 'invalid_player_number' };
  }

  const serverId = value.slice(0, 7);
  const realmCode = serverId.slice(0, 5);
  if (!/^600\d{2}$/.test(realmCode)) {
    return { ok: false, error: 'realm_not_found' };
  }

  const worldText = serverId.slice(5, 7);
  if (!/^\d{2}$/.test(worldText)) {
    return { ok: false, error: 'world_not_found' };
  }

  const world = Number(worldText);
  if (!Number.isInteger(world) || world < 1 || world > 16) {
    return { ok: false, error: 'world_out_of_range' };
  }

  const server = findServerById(serverRows, serverId);
  if (!server) {
    return { ok: false, error: 'server_not_found' };
  }

  const realm = String(server.realm_id ?? '').trim() || realmCode.slice(3);
  if (!realm) {
    return { ok: false, error: 'realm_not_found' };
  }

  return {
    ok: true,
    playerNumber: value,
    serverId,
    server,
    realm,
    realmCode,
    world,
  };
}

export function calculateRallyWorlds(season, world) {
  formatWorldNumber(world);
  const normalizedSeason = String(season ?? '').trim().toLowerCase();

  if (normalizedSeason === 's4') {
    const mirrorWorld = 17 - world;
    return [Math.min(world, mirrorWorld), Math.max(world, mirrorWorld)];
  }

  if (normalizedSeason === 's5') {
    const pairIndex = Math.min(world, 17 - world);
    const groupStart = pairIndex % 2 === 1 ? pairIndex : pairIndex - 1;
    return [
      groupStart,
      17 - groupStart,
      groupStart + 1,
      17 - (groupStart + 1),
    ];
  }

  throw new RangeError('Unsupported World Rally season.');
}

export function createRallyResult(player, season, serverRows) {
  if (!player?.ok) throw new TypeError('A valid parsed player number is required.');

  const worlds = calculateRallyWorlds(season, player.world);
  return {
    realm: player.realm,
    realmCode: player.realmCode,
    season: String(season).toLowerCase(),
    currentServerId: player.serverId,
    entries: worlds.map((world) => {
      const serverId = buildServerId(player.realmCode, world);
      return {
        world,
        serverId,
        label: formatServerLabel(serverRows, serverId),
        isCurrent: serverId === player.serverId,
      };
    }),
  };
}
