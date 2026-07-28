export const UNKNOWN_SERVER_NAME = '未知伺服器';
export const SUPPORTED_RALLY_SEASONS = Object.freeze(['s4', 's5']);

export function normalizePlayerNumber(value) {
  return String(value ?? '').replace(/\s/g, '');
}

export function extractServerId(playerNumber) {
  const value = normalizePlayerNumber(playerNumber);
  return /^\d{12}$/.test(value) ? value.slice(0, 7) : '';
}

export function extractPlayerSuffix(playerNumber) {
  const value = normalizePlayerNumber(playerNumber);
  if (/^\d{12}$/.test(value)) return value.slice(7);
  return /^\d{5}$/.test(value) ? value : '';
}

export function buildPlayerNumber(serverId, playerSuffix) {
  const canonicalServerId = String(serverId ?? '').trim();
  const suffix = String(playerSuffix ?? '').trim();
  if (!/^\d{7}$/.test(canonicalServerId)) throw new TypeError('Server ID must contain seven digits.');
  if (!/^\d{5}$/.test(suffix)) throw new TypeError('Player suffix must contain five digits.');
  return `${canonicalServerId}${suffix}`;
}

export function formatWorldNumber(world) {
  const text = String(world ?? '').trim();
  if (!/^\d{1,2}$/.test(text)) throw new RangeError('World number must be an integer from 1 through 16.');
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > 16) {
    throw new RangeError('World number must be an integer from 1 through 16.');
  }
  return text;
}

export function buildServerId(realmCode, world) {
  const canonicalRealmCode = String(realmCode ?? '').trim();
  if (!/^600\d{2}$/.test(canonicalRealmCode)) {
    throw new TypeError('Realm code must use the canonical 600XX format.');
  }
  return `${canonicalRealmCode}${formatWorldNumber(String(world).padStart(2, '0'))}`;
}

export function findServerById(serverRows, serverId) {
  const canonicalServerId = String(serverId ?? '').trim();
  if (serverRows instanceof Map) {
    return serverRows.get(canonicalServerId) || null;
  }
  return (serverRows || []).find(
    (server) => String(server?.server_id ?? '').trim() === canonicalServerId
  ) || null;
}

export function getServerDisplayName(serverRows, serverId) {
  const serverName = String(findServerById(serverRows, serverId)?.server_name ?? '').trim();
  return serverName || UNKNOWN_SERVER_NAME;
}

export function formatServerLabel(serverRows, serverId, unknownName = UNKNOWN_SERVER_NAME) {
  const canonicalServerId = String(serverId ?? '').trim();
  const serverName = String(findServerById(serverRows, canonicalServerId)?.server_name ?? '').trim() || unknownName;
  return `[${canonicalServerId}] ${serverName}`;
}

export function deriveServerContext(serverId, serverRows = []) {
  const canonicalServerId = String(serverId ?? '').trim();
  if (!/^600\d{4}$/.test(canonicalServerId)) {
    return { ok: false, error: 'invalid_server_id' };
  }

  const realmCode = canonicalServerId.slice(0, 5);
  const world = canonicalServerId.slice(5, 7);
  try {
    formatWorldNumber(world);
  } catch {
    return { ok: false, error: 'world_out_of_range' };
  }

  const server = findServerById(serverRows, canonicalServerId);
  return {
    ok: true,
    serverId: canonicalServerId,
    server,
    serverName: String(server?.server_name ?? '').trim() || UNKNOWN_SERVER_NAME,
    realmCode,
    realm: String(server?.realm_id ?? '').trim() || realmCode,
    world,
    worldNumber: Number(world),
  };
}

export function parsePlayerNumber(playerNumber, serverRows = []) {
  const value = normalizePlayerNumber(playerNumber);
  if (!/^\d{12}$/.test(value)) {
    return { ok: false, error: 'invalid_player_number', playerNumber: value };
  }

  const context = deriveServerContext(value.slice(0, 7), serverRows);
  if (!context.ok) return { ...context, playerNumber: value };

  return {
    ...context,
    playerNumber: value,
    playerSuffix: value.slice(7),
  };
}

export function resolvePlayerContext({
  source = 'player-input',
  playerNumber = '',
  serverId = '',
  serverRows = [],
  unknownName = UNKNOWN_SERVER_NAME,
} = {}) {
  const normalizedPlayerNumber = normalizePlayerNumber(playerNumber);
  const suffix = extractPlayerSuffix(normalizedPlayerNumber);
  const shouldUseServer = source === 'server-select' || (source === 'initial-load' && serverId);
  let context = null;
  let resolvedPlayerNumber = normalizedPlayerNumber;

  if (shouldUseServer && serverId) {
    context = deriveServerContext(serverId, serverRows);
    if (context.ok && suffix) resolvedPlayerNumber = buildPlayerNumber(context.serverId, suffix);
  } else if (/^\d{12}$/.test(normalizedPlayerNumber)) {
    const parsed = parsePlayerNumber(normalizedPlayerNumber, serverRows);
    if (parsed.ok) context = parsed;
  }

  if (!context?.ok) {
    return {
      playerNumber: resolvedPlayerNumber,
      playerSuffix: '',
      serverId: '',
      serverName: '',
      realmCode: '',
      realm: '',
      world: '',
      worldNumber: null,
      server: null,
    };
  }

  return {
    playerNumber: resolvedPlayerNumber,
    playerSuffix: extractPlayerSuffix(resolvedPlayerNumber),
    serverId: context.serverId,
    serverName: context.server?.server_name || unknownName,
    realmCode: context.realmCode,
    realm: context.realm,
    world: context.world,
    worldNumber: context.worldNumber,
    server: context.server,
  };
}
export function calculateRallyWorlds(season, world) {
  const current = Number(formatWorldNumber(String(world).padStart(2, '0')));
  const normalizedSeason = String(season ?? '').trim().toLowerCase();

  if (normalizedSeason === 's4') {
    const mirrorWorld = 17 - current;
    return [Math.min(current, mirrorWorld), Math.max(current, mirrorWorld)];
  }

  if (normalizedSeason === 's5') {
    const pairIndex = Math.min(current, 17 - current);
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
