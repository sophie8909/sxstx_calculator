const GLOBAL_CONTEXT_KEY = 'sxstxGlobalContext';
const LEGACY_CALCULATOR_KEY = 'sxstxCalculatorData';

export function loadGlobalContext() {
  if (typeof localStorage === 'undefined') return {};

  const current = localStorage.getItem(GLOBAL_CONTEXT_KEY);
  if (current) {
    try {
      return JSON.parse(current) || {};
    } catch {
      return {};
    }
  }

  const legacy = localStorage.getItem(LEGACY_CALCULATOR_KEY);
  if (!legacy) return {};
  try {
    const parsed = JSON.parse(legacy) || {};
    return {
      playerNumber: parsed.playerNumber || parsed.player_number || '',
      seasonId: parsed.seasonId || parsed.season || 's2',
    };
  } catch {
    return {};
  }
}

export function saveGlobalContext(context) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GLOBAL_CONTEXT_KEY, JSON.stringify({
    playerNumber: context.playerNumber,
    seasonId: context.seasonId,
    language: context.language,
    theme: context.theme,
    activeTool: context.activeTool,
  }));
}
