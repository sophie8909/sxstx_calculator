import { loadGlobalContext, saveGlobalContext } from '../services/storageService.js';
import { normalizeTool } from './router.js';

const CONTEXT_KEYS = [
  'playerNumber', 'playerSuffix', 'serverId', 'serverName', 'realmCode', 'realm', 'world',
  'seasonId', 'language', 'theme', 'activeTool', 'dataStatus',
];

function hasStateChanged(state, patch) {
  return Object.entries(patch).some(([key, value]) => state[key] !== value);
}

export function createGlobalStore(initial = {}) {
  const persisted = loadGlobalContext();
  const listeners = new Set();
  let state = {
    playerNumber: '',
    playerSuffix: '',
    serverId: '',
    serverName: '',
    realmCode: '',
    realm: '',
    world: '',
    seasonId: 's2',
    parsedServer: null,
    worldNumber: null,
    rallyGroup: [],
    language: 'zh-Hant',
    theme: 'light',
    activeTool: 'primordial',
    dataStatus: 'loading',
    ...persisted,
    ...initial,
  };
  state.activeTool = normalizeTool(state.activeTool);
  state.world = state.world || (state.worldNumber == null ? '' : String(state.worldNumber).padStart(2, '0'));

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      if (!hasStateChanged(state, patch)) return state;
      state = { ...state, ...patch };
      saveGlobalContext(state);
      listeners.forEach((listener) => listener(state));
      return state;
    },
    keys: CONTEXT_KEYS,
  };
}
