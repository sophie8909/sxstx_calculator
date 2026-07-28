import { loadGlobalContext, saveGlobalContext } from '../services/storageService.js';
import { normalizeTool } from './router.js';

export function createGlobalStore(initial = {}) {
  const persisted = loadGlobalContext();
  const listeners = new Set();
  let state = {
    playerNumber: '',
    seasonId: 's2',
    parsedServer: null,
    realmCode: '',
    worldNumber: null,
    serverName: '',
    rallyGroup: [],
    language: 'zh-Hant',
    theme: 'light',
    activeTool: 'primordial',
    dataStatus: 'loading',
    ...persisted,
    ...initial,
  };
  state.activeTool = normalizeTool(state.activeTool);

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      state = { ...state, ...patch };
      saveGlobalContext(state);
      listeners.forEach((listener) => listener(state));
      return state;
    },
  };
}
