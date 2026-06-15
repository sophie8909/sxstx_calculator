// model.js
// ??鞈?撅歹?撣豢???SV 頛??????蝞?頛胯摮?????

import { getGoogleSheetCsvUrl, loadUpgradeCostTablesForSeason } from './services/dataService.js';
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

/** ?典?撣豢 */
export const MAX_LEVEL = 200;
export const STORAGE_KEY = 'sxstxCalculatorData';

/** 撌行?憿嚗頛詨???蝝? */
export const categories = [
  { id: 'character', name: '????' },
  { id: 'equipment_main_weapon', name: '???', group: '????' },
  { id: 'equipment_off_weapon', name: '???', group: '????' },
  { id: 'equipment_helmet', name: '??', group: '????' },
  { id: 'equipment_armor', name: '??', group: '????' },
  { id: 'equipment_boots', name: '??', group: '????' },
  { id: 'skill_combat1', name: '???', group: '????' },
  { id: 'skill_combat2', name: '???', group: '????' },
  { id: 'skill_combat3', name: '???', group: '????' },
  { id: 'skill_combat4', name: '???', group: '????' },
  { id: 'skill_arcane1', name: '???', group: '????' },
  { id: 'skill_arcane2', name: '???', group: '????' },
  { id: 'skill_arcane3', name: '???', group: '????' },
  { id: 'skill_arcane4', name: '???', group: '????' },
  { id: 'pet1', name: '???', group: '????' },
  { id: 'pet2', name: '???', group: '????' },
  { id: 'pet3', name: '???', group: '????' },
  { id: 'pet4', name: '???', group: '????' },
];

export const seasonOptions = [
  { id: 's1', name: 'S1', readonly: false, season: 1 },
  { id: 's2', name: 'S2', readonly: false, season: 2 },
  { id: 's3', name: 'S3', readonly: false, season: 3 },
  { id: 's4', name: 'S4', readonly: false, season: 4 },
  { id: 'total', name: '??', readonly: true },
];

export const targetLevelConfig = [
  { id: 'character', name: '????' },
  { id: 'equipment_resonance', name: '????' },
  { id: 'skill_resonance', name: '????' },
  { id: 'pet_resonance', name: '????' },
  { id: 'relic_resonance', name: '????' },
  { id: 'primordial_star', name: '????', readonly: true },
];

export const materials = {
  exp: { name: '????', icon: 'EXP' },
  rola: { name: '??', icon: 'R' },
  essence: { name: '??', icon: 'E' },
  sand: { name: '?', icon: 'S' },
  stoneOre: { name: '??', icon: 'O' },
  refiningStone: { name: '???', icon: 'RS' },
  freezeDried: { name: '??', icon: 'FD' },
};

export const productionSources = {
  rola: { materialId: 'rola' },
  essence: { materialId: 'essence' },
  stoneOre: { materialId: 'stoneOre' },
  sand: { materialId: 'sand' },
  freezeDried: { materialId: 'freezeDried' },
};

export const SPEEDUP_HOURS_PER_USE = 2;
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

/** 璅⊥鞈?嚗SV 蝻箸??嚗?*/
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

// 1) 鞈?隞??嚗??岫蝞”蝚砌?甈??湛?
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

// TODO: 瘥甈⊥??閮剖潘??桀???函策蝛箇隞塚??閬??‵
const MATERIAL_DAILY_DEFAULTS = {
  dungeon: {},
  explore: {},
  store: {},
};


/** ?魚摮???身摰??芯???gid */
export const DATA_FILES_CONFIG = {
  characterUpgradeCosts: 314585849,  // 閫蝑?
  equipmentUpgradeCosts: 1205841685,  // 鋆?
  skillUpgradeCosts:     682954597,  // ???
  relicUpgradeCosts:     1548103854,  // ?箇
  petUpgradeCosts:       1910677696,  // 撟餌
  resource:              751788076,  // 鞈?
  seasonScore:          1012321192,  // 鞈賢迤?
};
const REMOTE_DATA_FILES_CONFIG = {
  resource: DATA_FILES_CONFIG.resource,
  seasonScore: DATA_FILES_CONFIG.seasonScore,
};
const remoteDataRowsCache = new Map();

/** ?折???*/
export const state = {
  seasonId: 's2',         // ?身鞈賢迤
  serverName: '瘛典?霅瑞', // ?身隡箸???
  gameData: {},           // ??銵?
  seasonScore: {},      // 鞈賢迤?銵?
  resource: {},          // 鞈?銵剁?靘?type ??嚗?
  cumulativeCostData: {}, // 蝝舐??銵?
  missingFiles: [],       // 頛憭望?皜
  materialAvgDefaults: {             // TODO: ?啣?嚗策蝝?靘?隡啁?雿輻?像??
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


// --- ?曉 model.js ---
// 撠極?瘀?甇????key嚗??BOM?rim嚗?
const normalizeKey = (k) => k ? k.replace(/^\uFEFF/, '').trim() : k;

// 撘琿???CSV 閫??嚗???BOM?R/LF?????征??
export async function fetchAndParseCsv(url) {
  const res = await fetch(url, { cache: 'no-store' }); // ?翰???踹? GH Pages ??
  if (!res.ok) throw new Error(`?⊥?頛 CSV: ${url}`);
  const text = await res.text();
  // 蝯曹???LF嚗??\r 敶梢 split
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  if (lines.length === 0) return [];
  // 璅?餅? BOM
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
  const headers = rawHeaders.map(h => h.toLowerCase()); // ?刻?撠神嚗?敺??渡撠神
  const dataLines = lines.filter((_, index) => index !== headerLineIndex);
  const rows = dataLines.map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      const raw = (values[i] ?? '').trim();
      // ?餅???雿?敺?頧摮?蝛箏?銝脩策 0嚗?銝?撠曹???銝?
      const num = Number(raw.replace(/,/g, ''));
      obj[h] = Number.isFinite(num) ? num : (raw === '' ? 0 : raw);
    });
    return obj;
  });
  return rows;
}

// 撠??祈????箝敞蝛”????摰寥隞颱?憭批?撖?/ BOM ??雿?
export function preprocessCostData() {
  state.cumulativeCostData = buildCumulativeCostData(state.gameData);
}

/** ?寞? gid ?芸??澆 CSV URL */
function makeCsvUrl(gid) {
  return getGoogleSheetCsvUrl(gid);
}

/** 頛撠?鞈賢迤????*/
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

      // ??”?賢?鈭?season 甈???瘜?
      const filtered = rows.filter((row) => {
        const s = String(row.season || '').toLowerCase();
        // ?仿?????season嚗?憒?剁?嚗停?刻魚摮?
        if (!s) return true;
        return s === targetSeason.toLowerCase();
      });

      if (key === 'resource') {
        // 撠?resource ???神??state.resource
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

// ??resource CSV ??嚗? type嚗ungeon / explore / store嚗?蝯?
function buildResourceDataForSeason(rows, seasonId) {
  const resourceData = {}; // TODO: { dungeon: { stone: row, ... }, explore: {...}, store: {...} }

  rows.forEach((r) => {
    const season = String(r.season || '').toLowerCase();
    if (season && season !== seasonId.toLowerCase()) return; // ?芸??嗅?鞈賢迤???

    const resKey = String(r.resource || '').trim();
    const typeKey = String(r.type || '').toLowerCase(); // dungeon / explore / store
    if (!resKey || !typeKey) return;

    if (!resourceData[typeKey]) resourceData[typeKey] = {};
    resourceData[typeKey][resKey] = r;
  });
  console.log('[data load] built resource data for season:', seasonId, resourceData);
  return resourceData;
}
// TODO: 敺?resource 銵刻??乓像??甈～?閮剖潘?憛恍?state.materialAvgDefaults
export async function loadMaterialAvgDefaults() {
  const avgDefaults = {
    dungeon: {},
    explore: {},
    store: {},  // ?桀?銝蝙?剁?雿???瑽?
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


// 蝯?controller / view ?函?蝯曹?隞
export function getMaterialSourceConfig() {
  const avgDefaults =
    state.materialAvgDefaults || { dungeon: {}, explore: {}, store: {} }; // TODO: ??摰?身
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
      store: ['stone', 'essence', 'sand', 'freeze_dried'], // ??瘝? rola
    },
  };
}


/** ????蝑??敞蝛??穿??乩?摮??餈?蝑?嚗?*/
export function getCumulative(costTable, level) {
  return getCumulativeFromTable(costTable, level);
}

export function getCharacterCumulativeExp(level) {
  return getCharacterCumulativeExpFromTable(state.cumulativeCostData.character, level);
}

/** 鞈賢迤?閮? **/
export function calculateSeasonScore(targets) {
  return calculateSeasonScoreFromData(targets, state.seasonScore, state.seasonId);
}

/** 鞈賢迤蝑?頧???銋? **/
export function convertPrimordialStar(score) {
  return convertPrimordialStarFromData(score, state.seasonScore, state.seasonId);
}

/**
 * 閮???雿???脩?蝝?
 *
 * 摰儔嚗?
 * - cum(k-1) : ?菟? k 蝝???敞蝛?撽?
 * - ?嗅?蝑? L 嚗摰嗅歇蝬敞蝛 cum(L-1)嚗????L 蝝??瑼鳴???
 * - ownedExp嚗?????芰??蝬?鞈?嚗??急??撓?亥?摨?蝥敞????
 * - bedExpHourly嚗?瘥???箇?蝬?????
 * - targetTimeStr嚗璅???datetime-local 摮葡嚗??亦????0 撠???
 */
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

/** 銝餉?蝞??瘙?/ ??嗥? / 蝻箏嚗葡? payload嚗?*/
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
        targetTime: document.getElementById('target-time')?.value || '',
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

/** 閮??圈?銝?蝝?ETA */
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

/** 閮??圈??璅??脩?蝝TA嚗誑?蜇??蝬?嚗?*/
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

/** LocalStorage ?脣?/頛 */
export function saveAllInputs() {
  const data = {};
  document.querySelectorAll('input[type=number], input[type=text], input[type=datetime-local], input[type=checkbox], select')
    .forEach(input => {
      if (!input.id) return;
      data[input.id] = input.type === 'checkbox' ? input.checked : input.value;
    });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 霈??localStorage嚗敹賜???菟????靘? season-select嚗?*/
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

