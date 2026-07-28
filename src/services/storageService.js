const GLOBAL_CONTEXT_KEY = 'sxstxGlobalContext';
const LEGACY_CALCULATOR_KEY = 'sxstxCalculatorData';

export function loadGlobalContext() {
  if (typeof localStorage === 'undefined') return {};

  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  };

  const current = read(GLOBAL_CONTEXT_KEY);
  const legacy = read(LEGACY_CALCULATOR_KEY);
  const legacyServer = current.serverId || current.serverName || current['server-select'] || legacy.serverId || legacy.server;
  return {
    ...current,
    playerNumber: current.playerNumber || current['player-code-input'] || legacy.playerNumber || legacy.player_number || '',
    serverId: current.serverId || (typeof legacyServer === 'string' && /^\d{7}$/.test(legacyServer) ? legacyServer : ''),
    seasonId: current.seasonId || current['season-select'] || legacy.seasonId || legacy.season || 's2',
  };
}

export function saveGlobalContext(context) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GLOBAL_CONTEXT_KEY, JSON.stringify({
    playerNumber: context.playerNumber,
    playerSuffix: context.playerSuffix,
    serverId: context.serverId,
    serverName: context.serverName,
    realmCode: context.realmCode,
    realm: context.realm,
    world: context.world,
    seasonId: context.seasonId,
    language: context.language,
    theme: context.theme,
    activeTool: context.activeTool,
  }));
}
