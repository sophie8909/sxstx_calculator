// model.js

import { getGoogleSheetCsvUrl, loadUpgradeCostTablesForSeason, clearDataServiceMemoryCache } from './services/dataService.js';
import { fetchTextWithCache } from './services/dataCache.js';
import {
  buildCumulativeCostData,
  getCharacterCumulativeExpFromTable,
  getCumulative as getCumulativeFromTable,
} from './core/upgradeCost.js';
import {
  calculateSeasonScore as calculateSeasonScoreFromData,
  calculateUpgradeResults,
  computeEtaToNextLevel as computeEtaToNextLevelFromData,
  computeEtaToTargetLevel as computeEtaToTargetLevelFromData,
  computeReachableCharacterLevel as computeReachableCharacterLevelFromData,
  convertPrimordialStar as convertPrimordialStarFromData,
  expCalculation as expCalculationFromData,
  getSpeedupHoursForDays as getSpeedupHoursForDaysFromState,
  getSpeedupHoursForHours as getSpeedupHoursForHoursFromState,
} from './core/calculator.js';
import { t } from './i18n-inline.js';

export const MAX_LEVEL = 200;
export const STORAGE_KEY = 'sxstxCalculatorData';

export const categories = [
  { id: 'character', name: 'Character' },
  { id: 'equipment_main_weapon', name: 'Main Weapon', group: 'Equipment' },
  { id: 'equipment_off_weapon', name: 'Off Weapon', group: 'Equipment' },
  { id: 'equipment_helmet', name: 'Helmet', group: 'Equipment' },
  { id: 'equipment_armor', name: 'Armor', group: 'Equipment' },
  { id: 'equipment_boots', name: 'Boots', group: 'Equipment' },
  { id: 'skill_combat1', name: 'Combat Skill 1', group: 'Skills' },
  { id: 'skill_combat2', name: 'Combat Skill 2', group: 'Skills' },
  { id: 'skill_combat3', name: 'Combat Skill 3', group: 'Skills' },
  { id: 'skill_combat4', name: 'Combat Skill 4', group: 'Skills' },
  { id: 'skill_arcane1', name: 'Arcane Skill 1', group: 'Skills' },
  { id: 'skill_arcane2', name: 'Arcane Skill 2', group: 'Skills' },
  { id: 'skill_arcane3', name: 'Arcane Skill 3', group: 'Skills' },
  { id: 'skill_arcane4', name: 'Arcane Skill 4', group: 'Skills' },
  { id: 'pet1', name: 'Pet 1', group: 'Pets' },
  { id: 'pet2', name: 'Pet 2', group: 'Pets' },
  { id: 'pet3', name: 'Pet 3', group: 'Pets' },
  { id: 'pet4', name: 'Pet 4', group: 'Pets' },
];

export const seasonOptions = [
  { id: 's1', name: 'S1', readonly: false, season: 1 },
  { id: 's2', name: 'S2', readonly: false, season: 2 },
  { id: 's3', name: 'S3', readonly: false, season: 3 },
  { id: 's4', name: 'S4', readonly: false, season: 4 },
  { id: 's5', name: 'S5', readonly: false, season: 5 },
  { id: 'total', name: 'Total', readonly: true },
];

export const targetLevelConfig = [
  { id: 'character', name: 'Character' },
  { id: 'equipment_resonance', name: 'Equipment Resonance' },
  { id: 'skill_resonance', name: 'Skill Resonance' },
  { id: 'pet_resonance', name: 'Pet Resonance' },
  { id: 'relic_resonance', name: 'Relic Resonance' },
  { id: 'primordial_star', name: 'Primordial Star', readonly: true },
];

export const materials = {
  exp: { name: 'Experience', icon: 'EXP' },
  rola: { name: 'Rola', icon: 'R' },
  essence: { name: 'Essence', icon: 'E' },
  sand: { name: 'Sand', icon: 'S' },
  stoneOre: { name: 'Stone Ore', icon: 'O' },
  refiningStone: { name: 'Refining Stone', icon: 'RS' },
  freezeDried: { name: 'Freeze-Dried Food', icon: 'FD' },
};

export const productionSources = {
  rola: { materialId: 'rola' },
  essence: { materialId: 'essence' },
  stoneOre: { materialId: 'stoneOre' },
  sand: { materialId: 'sand' },
  freezeDried: { materialId: 'freezeDried' },
};

export const SPEEDUP_HOURS_PER_USE = 2;
export const NEXT_SEASON_EXP_HOARD_HOURS = 36;
export const NEXT_SEASON_EXP_HOARD_REMINDER_HOURS = NEXT_SEASON_EXP_HOARD_HOURS - SPEEDUP_HOURS_PER_USE;
export const RELIC_COUNT = 20;

export function getAvailableRelicLevels() {
  const relicRows = state.gameData?.relicUpgradeCosts;
  if (!Array.isArray(relicRows) || relicRows.length === 0) return [];

  return [...new Set(
    relicRows
      .map((row) => Number(row?.level))
      .filter((level) => Number.isFinite(level) && level > 0)
  )].sort((a, b) => a - b);
}

export function getDerivedRelicDistribution() {
  if (document.getElementById('relic-ui-mode')?.value === 'legacy') {
    const distribution = [];
    document.querySelectorAll('[id^="relic-level-"]').forEach((input) => {
      const level = Number(String(input.id).replace('relic-level-', ''));
      const count = parseInt(input.value, 10) || 0;
      if (Number.isFinite(level) && count > 0) {
        distribution.push({ level, count });
      }
    });
    return distribution;
  }

  const completedInput = document.getElementById('relic-completed-level');
  const progressInput = document.getElementById('relic-next-progress');
  const completedLevel = Math.max(0, parseInt(completedInput?.value, 10) || 0);
  const rawProgress = parseInt(progressInput?.value, 10) || 0;
  const nextProgress = Math.max(0, Math.min(RELIC_COUNT, rawProgress));

  if (progressInput && progressInput.value !== '') {
    progressInput.value = String(nextProgress);
  }

  const distribution = [];
  if (completedLevel <= 0 && nextProgress <= 0) return distribution;

  const baseCount = RELIC_COUNT - nextProgress;
  if (baseCount > 0) {
    distribution.push({ level: completedLevel, count: baseCount });
  }
  if (nextProgress > 0) {
    distribution.push({ level: completedLevel + 1, count: nextProgress });
  }
  return distribution;
}

/** Fallback data used when generated tables cannot be loaded. */
export const MOCK_GAME_DATA = {
  equipmentUpgradeCosts: [
    { level: 1, cost_stone_ore: 10, cost_rola: 100, cost_refining_stone: 0 },
    { level: 2, cost_stone_ore: 20, cost_rola: 200, cost_refining_stone: 0 },
    { level: 30, cost_stone_ore: 500, cost_rola: 5000, cost_refining_stone: 1 },
  ],
  skillUpgradeCosts: [
    { level: 1, cost_essence: 50 },
    { level: 2, cost_essence: 75 },
    { level: 3, cost_essence: 100 },
  ],
  petUpgradeCosts: [
    { level: 1, cost_freeze_dried: 30 },
    { level: 2, cost_freeze_dried: 45 },
    { level: 3, cost_freeze_dried: 60 },
  ],
  relicUpgradeCosts: [
    { level: 1, cost_sand: 100, cost_rola: 1000 },
    { level: 2, cost_sand: 150, cost_rola: 1500 },
    { level: 3, cost_sand: 200, cost_rola: 2000 },
  ],
  characterUpgradeCosts: Array.from({ length: MAX_LEVEL }, (_, i) => ({
    level: i + 1,
    cost_exp: Math.floor(200 * Math.pow(i + 1, 2.2)),
  })),
};

export const MATERIAL_TYPES = ['stone', 'essence', 'sand', 'rola', 'freeze_dried'];
export const STAMINA_BIG_MINE_RATE = 0.0932;
export const STAMINA_BIG_MINE_EXPECTED_MULTIPLIER = 1 + STAMINA_BIG_MINE_RATE;

export const MATERIAL_DISPLAY_NAMES = {
  stone: '石礦',
  essence: '精華',
  sand: '沙',
  rola: '蘿拉',
  freeze_dried: '凍乾',
};

const MATERIAL_DAILY_DEFAULTS = {
  dungeon: {},
  explore: {},
  store: {},
};


/** Google Sheet gid values for runtime data. */
export const DATA_FILES_CONFIG = {
  characterUpgradeCosts: 314585849,
  equipmentUpgradeCosts: 1205841685,
  skillUpgradeCosts:     682954597,
  relicUpgradeCosts:     1548103854,
  petUpgradeCosts:       1910677696,
  resource:              751788076,
  seasonScore:          1012321192,
};
const REMOTE_DATA_FILES_CONFIG = {
  resource: DATA_FILES_CONFIG.resource,
  seasonScore: DATA_FILES_CONFIG.seasonScore,
};
const remoteDataRowsCache = new Map();

export const state = {
  seasonId: 's2',
  serverName: '\u53f0\u6e2f\u6fb3',
  gameData: {},
  seasonScore: {},
  resource: {},
  cumulativeCostData: {},
  missingFiles: [],
  cacheFallback: false,
  materialAvgDefaults: {
    dungeon: {},
    explore: {},
    store: {},
  },
  materialRolaCostDefaults: {
    dungeon: {},
    explore: {},
    store: {},
  },
  materialPowerCostDefaults: {
    dungeon: {},
    explore: {},
    store: {},
  },
};


const normalizeKey = (k) => k ? k.replace(/^\uFEFF/, '').trim() : k;

export async function fetchAndParseCsv(url) {
  const text = await fetchTextWithCache(`csv:${url}`, url);
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  if (lines.length === 0) return [];
  // Find the real header row; published sheets can contain preamble rows.
  const knownHeaders = new Set([
    'level',
    'cost_exp',
    'season',
    'type',
    'resource',
    'avg_defaults',
    'cost_stone_ore',
    'cost_rola',
    'cost_refining_stone',
    'cost_essence',
    'cost_freeze_dried',
    'cost_sand',
  ]);
  const headerIndex = lines.findIndex((line) =>
    line.split(',').some((cell) => knownHeaders.has(normalizeKey(cell).toLowerCase()))
  );
  const headerLineIndex = headerIndex === -1 ? 0 : headerIndex;
  const rawHeaders = lines[headerLineIndex].split(',').map(h => normalizeKey(h));
  const headers = rawHeaders.map(h => h.toLowerCase());
  const dataLines = lines.filter((_, index) => index !== headerLineIndex);
  const rows = dataLines.map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      const raw = (values[i] ?? '').trim();
      const num = Number(raw.replace(/,/g, ''));
      obj[h] = Number.isFinite(num) ? num : (raw === '' ? 0 : raw);
    });
    return obj;
  });
  return rows;
}

export function preprocessCostData() {
  state.cumulativeCostData = buildCumulativeCostData(state.gameData);
}

export function clearRemoteDataMemoryCaches() {
  remoteDataRowsCache.clear();
  clearDataServiceMemoryCache();
}

function makeCsvUrl(gid) {
  return getGoogleSheetCsvUrl(gid);
}

export async function loadDataForSeason(seasonId) {
  const targetSeason = seasonId;         // 's1' / 's2' / 's3'
  let loaded;
  state.missingFiles = [];

  try {
    loaded = await loadUpgradeCostTablesForSeason(targetSeason);
  } catch (err) {
    console.warn('[data load] failed to load generated upgrade costs, using fallback', err);
    loaded = {
      characterUpgradeCosts: MOCK_GAME_DATA.characterUpgradeCosts,
      equipmentUpgradeCosts: MOCK_GAME_DATA.equipmentUpgradeCosts,
      skillUpgradeCosts: MOCK_GAME_DATA.skillUpgradeCosts,
      relicUpgradeCosts: MOCK_GAME_DATA.relicUpgradeCosts,
      petUpgradeCosts: MOCK_GAME_DATA.petUpgradeCosts,
    };
    state.missingFiles.push('upgrade-costs');
  }

  for (const [key, gid] of Object.entries(REMOTE_DATA_FILES_CONFIG)) {
    const url = makeCsvUrl(gid);
    console.log(`[data load] loading ${key} from ${url} for season ${targetSeason}`);
    try {
      let rows = remoteDataRowsCache.get(key);
      if (!rows) {
        rows = await fetchAndParseCsv(url);
        remoteDataRowsCache.set(key, rows);
      }

      const filtered = rows.filter((row) => {
        const s = String(row.season || '').toLowerCase();
        if (!s) return true;
        return s === targetSeason.toLowerCase();
      });

      if (key === 'resource') {
        state.resource = buildResourceDataForSeason(filtered, seasonId);
      } else if (key === 'seasonScore') {
        state.seasonScore = buildSeasonScoreData(filtered);
      } else {
        loaded[key] = filtered;
      }

    } catch (err) {
      console.warn(`[data load] failed to load ${key} (${url}), using fallback`, err);
      if (MOCK_GAME_DATA[key]) loaded[key] = MOCK_GAME_DATA[key];
      state.missingFiles.push(key);
    }
  }

  state.gameData = loaded;
}

function buildSeasonScoreData(rows) {
  const result = {};
  rows.forEach((r) => {
    result[r.season] = r;
  });
  return result;
}

function buildResourceDataForSeason(rows, seasonId) {
  const resourceData = {}; // TODO: { dungeon: { stone: row, ... }, explore: {...}, store: {...} }

  rows.forEach((r) => {
    const season = String(r.season || '').toLowerCase();
    if (season && season !== seasonId.toLowerCase()) return;

    const resKey = String(r.resource || '').trim();
    const typeKey = String(r.type || '').toLowerCase(); // dungeon / explore / store
    if (!resKey || !typeKey) return;

    if (!resourceData[typeKey]) resourceData[typeKey] = {};
    resourceData[typeKey][resKey] = r;
  });
  console.log('[data load] built resource data for season:', seasonId, resourceData);
  return resourceData;
}
export async function loadMaterialAvgDefaults() {
  const avgDefaults = {
    dungeon: {},
    explore: {},
    store: {},
  };
  const rolaCostDefaults = {
    dungeon: {},
    explore: {},
    store: {},
  };
  const powerCostDefaults = {
    dungeon: {},
    explore: {},
    store: {},
  };

  const resourceData = state.resource || {};
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  Object.entries(resourceData).forEach(([typeKey, byMat]) => {
    const type = typeKey.toLowerCase();
    let targetSource = null;
    console.log('[data load] processing material avg defaults for type:', type, byMat);
    if (type === 'dungeon') targetSource = 'dungeon';
    else if (type === 'explore') targetSource = 'explore';
    else if (type === 'store') targetSource = 'store';

    if (!targetSource) return;

    Object.entries(byMat).forEach(([mat, row]) => {
      const avg = toNum(row['avg_defaults']);
      const rolaCost = toNum(row['rola_cost']);
      const powerCost = toNum(row['power_cost']);

      if (avg !== undefined) {
        if (!avgDefaults[targetSource]) avgDefaults[targetSource] = {};
        avgDefaults[targetSource][mat] = avg;
      }
      if (rolaCost !== undefined) {
        if (!rolaCostDefaults[targetSource]) rolaCostDefaults[targetSource] = {};
        rolaCostDefaults[targetSource][mat] = rolaCost;
      }
      if (powerCost !== undefined) {
        if (!powerCostDefaults[targetSource]) powerCostDefaults[targetSource] = {};
        powerCostDefaults[targetSource][mat] = powerCost;
      }
    });
  });

  console.log('[data load] loaded material average defaults:', avgDefaults);
  state.materialAvgDefaults = avgDefaults;
  state.materialRolaCostDefaults = rolaCostDefaults;
  state.materialPowerCostDefaults = powerCostDefaults;
}


export function getMaterialSourceConfig() {
  const avgDefaults =
    state.materialAvgDefaults || { dungeon: {}, explore: {}, store: {} };
  const rolaCostDefaults =
    state.materialRolaCostDefaults || { dungeon: {}, explore: {}, store: {} };
  const powerCostDefaults =
    state.materialPowerCostDefaults || { dungeon: {}, explore: {}, store: {} };

  return {
    displayNames: MATERIAL_DISPLAY_NAMES,
    dailyDefaults: MATERIAL_DAILY_DEFAULTS,
    avgDefaults,
    rolaCostDefaults,
    powerCostDefaults,
    sourceMaterials: {
      dungeon: ['stone', 'essence', 'sand', 'rola'],
      explore: ['stone', 'essence', 'sand', 'rola'],
      store: ['stone', 'essence', 'sand', 'freeze_dried'],
    },
  };
}


export function getCumulative(costTable, level) {
  return getCumulativeFromTable(costTable, level);
}

export function getCharacterCumulativeExp(level) {
  return getCharacterCumulativeExpFromTable(state.cumulativeCostData.character, level);
}

export function calculateSeasonScore(targets) {
  return calculateSeasonScoreFromData(targets, state.seasonScore, state.seasonId);
}

export function convertPrimordialStar(score) {
  return convertPrimordialStarFromData(score, state.seasonScore, state.seasonId);
}

function readNumberInput(id) {
  const node = document.getElementById(id);
  if (!node) return 0;

  if (node.type === 'checkbox') return node.checked ? 1 : 0;

  const value = Number(node.value);
  return Number.isFinite(value) ? value : 0;
}

export function getSpeedupState() {
  return {
    freeUsedToday: !!document.getElementById('free-speedup-used-today')?.checked,
    stoneCount: Math.max(0, Math.floor(readNumberInput('speedup-stone-count'))),
  };
}

export function getSpeedupHoursForDays(dayCount) {
  return getSpeedupHoursForDaysFromState(dayCount, getSpeedupState(), SPEEDUP_HOURS_PER_USE);
}

export function getSpeedupHoursForHours(hours) {
  return getSpeedupHoursForHoursFromState(hours, getSpeedupState(), SPEEDUP_HOURS_PER_USE);
}

function getBedProgressTargetTime() {
  const targetTimeInput = document.getElementById('target-time');
  const targetTime = targetTimeInput?.value || '';
  const shouldHoardExp = !!document.getElementById('next-season-exp-hoard-enabled')?.checked;

  if (!shouldHoardExp || targetTimeInput?.dataset.presetKind !== 'season_end' || !targetTime) {
    return targetTime;
  }

  const targetTs = new Date(targetTime).getTime();
  if (!Number.isFinite(targetTs)) return targetTime;

  return new Date(targetTs - NEXT_SEASON_EXP_HOARD_REMINDER_HOURS * 60 * 60 * 1000).toISOString();
}

export function computeReachableCharacterLevel(curLv, ownedExp, bedExpHourly, targetTimeStr) {
  return computeReachableCharacterLevelFromData({
    cumulativeCostData: state.cumulativeCostData,
    currentLevel: curLv,
    ownedExp,
    bedExpHourly,
    targetTime: targetTimeStr,
    speedupState: getSpeedupState(),
    speedupHoursPerUse: SPEEDUP_HOURS_PER_USE,
  });
}

export function computeAll(containers) {
  const readInteger = (id) => parseInt(document.getElementById(id)?.value, 10) || 0;
  const readFloat = (id) => parseFloat(document.getElementById(id)?.value) || 0;

  const targets = {};
  targetLevelConfig.forEach((target) => {
    targets[target.id] = readInteger('target-' + target.id);
  });

  const categoryCurrentLevels = {};
  categories.forEach((category) => {
    categoryCurrentLevels[category.id] = readInteger(category.id + '-current');
  });

  const materialSourceMap = {
    stone: 'stoneOre',
    essence: 'essence',
    sand: 'sand',
    rola: 'rola',
    freeze_dried: 'freezeDried',
  };
  const materialSourceGains = {};
  document.querySelectorAll('.material-source-total').forEach((span) => {
    const materialId = materialSourceMap[span.dataset.material];
    if (!materialId) return;

    const total = Number(String(span.textContent || '').replace(/,/g, '').trim()) || 0;
    if (total > 0) materialSourceGains[materialId] = (materialSourceGains[materialId] || 0) + total;
  });
  const productionHourly = {};
  Object.keys(productionSources).forEach((sourceId) => {
    productionHourly[sourceId] = readFloat('manual-hourly-' + sourceId);
  });

  const ownedMaterials = {};
  Object.keys(materials).forEach((materialId) => {
    ownedMaterials[materialId] = readInteger('owned-' + materialId);
  });

  const result = calculateUpgradeResults(
    {
      targets,
      categoryCurrentLevels,
      relicDistribution: getDerivedRelicDistribution(),
      speedupState: getSpeedupState(),
      bedProgress: {
        currentLevel: readInteger('character-current'),
        ownedExp: readInteger('owned-exp'),
        bedExpHourly: readFloat('bed-exp-hourly'),
        targetTime: getBedProgressTargetTime(),
      },
      primordial: {
        accumulated: readInteger('primordial-star-accumulated'),
        currentSeason: readInteger('primordial-star-current-season'),
      },
      productionHourly,
      materialSourceGains,
      ownedMaterials,
      now: Date.now(),
    },
    {
      categories,
      cumulativeCostData: state.cumulativeCostData,
      gameData: state.gameData,
      labels: {
        character: 'character',
        equipment: 'equipment',
        skill: 'skill',
        pet: 'pet',
      },
      materials,
      messages: {
        missingItemLevel: (itemName, level) => 'Missing data: ' + itemName + ' level ' + level,
        missingRelicLevel: (level) => 'Missing data: relic level ' + level,
        relicCountError: 'Invalid relic count. Please make sure the total is 20.',
      },
      productionSources,
      relicCountRequired: RELIC_COUNT,
      seasonId: state.seasonId,
      seasonScore: state.seasonScore,
      speedupHoursPerUse: SPEEDUP_HOURS_PER_USE,
    }
  );

  const reachableEl = document.getElementById('target-char-reachable-level');
  if (reachableEl) {
    const value = result.derived?.reachableLevel > 0 ? result.derived.reachableLevel : '--';
    reachableEl.textContent = t('reachable_label', { value });
  }

  const primordialStarInput = document.getElementById('target-primordial_star');
  if (primordialStarInput) primordialStarInput.value = result.derived?.primordialStar || 0;

  const currentSeasonPrimordialStarInput = document.getElementById('primordial-star-current-season');
  if (currentSeasonPrimordialStarInput) currentSeasonPrimordialStarInput.value = result.derived?.primordialStar || 0;

  const totalPrimordialStarInput = document.getElementById('primordial-star-total');
  if (totalPrimordialStarInput) totalPrimordialStarInput.value = result.derived?.primordialStarTotal || 0;

  return result;
}

export function expCalculation(currentLevel, ownedExp, bedExpHourly, targetLevel, bonusHours = 0) {
  return expCalculationFromData({
    cumulativeCostData: state.cumulativeCostData,
    currentLevel,
    ownedExp,
    bedExpHourly,
    targetLevel,
    bonusHours,
  });
}

export function computeEtaToNextLevel(currentLevel, ownedExp, bedExpHourly, bonusHours = 0) {
  const { levelupTs, minutesNeeded, expNeeded } = computeEtaToNextLevelFromData({
    cumulativeCostData: state.cumulativeCostData,
    currentLevel,
    ownedExp,
    bedExpHourly,
    bonusHours,
  });
  return { levelupTs, minutesNeeded, expNeeded };
}

export function computeEtaToTargetLevel(currentLevel, ownedExp, bedExpHourly, targetLevel, bonusHours = 0) {
  return computeEtaToTargetLevelFromData({
    cumulativeCostData: state.cumulativeCostData,
    currentLevel,
    ownedExp,
    bedExpHourly,
    targetLevel,
    bonusHours,
    speedupState: getSpeedupState(),
    speedupHoursPerUse: SPEEDUP_HOURS_PER_USE,
  });
}

export function saveAllInputs() {
  const data = {};
  document.querySelectorAll('input[type=number], input[type=text], input[type=datetime-local], input[type=checkbox], select')
    .forEach(input => {
      if (!input.id) return;
      data[input.id] = input.type === 'checkbox' ? input.checked : input.value;
    });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAllInputs(excludeKeys = []) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.keys(data).forEach(id => {
    if (excludeKeys.includes(id)) return;
    const n = document.getElementById(id);
    if (!n) return;
    if (n.type === 'checkbox') n.checked = !!data[id];
    else n.value = data[id];
  });
}

