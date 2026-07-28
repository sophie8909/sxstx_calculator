import {
  buildServerId,
  deriveServerContext,
  formatServerLabel,
  parsePlayerNumber,
} from '../../core/serverWorlds.js';

export function normalizeRallyRule(row) {
  return {
    season: String(row?.season || '').trim().toLowerCase(),
    enabled: /^(true|1|yes)$/i.test(String(row?.enabled || '').trim()),
    worldCount: Number(row?.world_count),
    groupSize: Number(row?.group_size),
    strategy: String(row?.strategy || '').trim(),
  };
}

export function calculateRallyWorldsFromRule(rule, world) {
  const current = Number(world);
  if (!Number.isInteger(current) || current < 1 || current > rule.worldCount) {
    throw new RangeError('World number is outside the configured range.');
  }
  if (!rule.enabled) return [];

  const mirror = rule.worldCount + 1 - current;
  if (rule.strategy === 'mirror') {
    return [Math.min(current, mirror), Math.max(current, mirror)];
  }
  if (rule.strategy === 'adjacent_mirror_pairs') {
    const pairIndex = Math.min(current, mirror);
    const start = pairIndex % 2 === 1 ? pairIndex : pairIndex - 1;
    return [start, rule.worldCount + 1 - start, start + 1, rule.worldCount - start];
  }
  throw new RangeError('Unsupported World Rally strategy.');
}

export function createWorldRallyViewModel({ playerNumber = '', serverId = '', season, serverRows, ruleRows }) {
  const player = playerNumber
    ? parsePlayerNumber(playerNumber, serverRows)
    : deriveServerContext(serverId, serverRows);
  if (!player.ok) return { supported: false, enabled: false, statusKey: player.error };

  const rule = ruleRows.map(normalizeRallyRule).find((item) => item.season === season.toLowerCase());
  const playerSummary = {
    playerNumber: playerNumber || '',
    season: season.toUpperCase(),
    serverId: player.serverId,
    serverName: player.server?.server_name || '',
    realmCode: player.realmCode,
    worldNumber: player.world,
  };
  const realmEntries = serverRows
    .filter((row) => String(row.server_id || '').startsWith(player.realmCode))
    .map((row) => ({
      serverId: String(row.server_id),
      world: Number(String(row.server_id).slice(-2)),
      label: formatServerLabel(serverRows, String(row.server_id)),
      isCurrent: String(row.server_id) === player.serverId,
    }))
    .filter((entry) => Number.isInteger(entry.world))
    .sort((left, right) => left.world - right.world);

  if (!rule) {
    return { playerSummary, realmEntries, rallyEntries: [], supported: false, enabled: false, statusKey: 'rally_rule_unavailable' };
  }
  if (!rule.enabled) {
    return { playerSummary, realmEntries, rallyEntries: [], supported: true, enabled: false, statusKey: 'rally_disabled' };
  }

  const rallyEntries = calculateRallyWorldsFromRule(rule, player.world).map((world) => {
    const serverId = buildServerId(player.realmCode, world);
    return {
      serverId,
      world,
      label: formatServerLabel(serverRows, serverId),
      isCurrent: serverId === player.serverId,
    };
  });
  return { playerSummary, realmEntries, rallyEntries, supported: true, enabled: true, statusKey: 'ready' };
}
