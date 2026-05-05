// model.js
// ★ 資料層：常數、狀態、CSV 載入、預處理、計算邏輯、儲存載入 ★

import { findLastIndexByLevel, costKeyToMaterialId } from './utils.js';

/** 全域常數 */
export const MAX_LEVEL = 200;
export const STORAGE_KEY = 'sxstxCalculatorData';

/** 左欄類別（可輸入的目前等級） */
export const categories = [
  { id: 'character', name: '角色等級' },
  { id: 'equipment_main_weapon', name: '主武器', group: '裝備等級' },
  { id: 'equipment_off_weapon', name: '副武器', group: '裝備等級' },
  { id: 'equipment_helmet', name: '頭盔', group: '裝備等級' },
  { id: 'equipment_armor', name: '鎧甲', group: '裝備等級' },
  { id: 'equipment_boots', name: '戰靴', group: '裝備等級' },
  { id: 'skill_combat1', name: '戰技一', group: '技能等級' },
  { id: 'skill_combat2', name: '戰技二', group: '技能等級' },
  { id: 'skill_combat3', name: '戰技三', group: '技能等級' },
  { id: 'skill_combat4', name: '戰技四', group: '技能等級' },
  { id: 'skill_arcane1', name: '祕法一', group: '技能等級' },
  { id: 'skill_arcane2', name: '祕法二', group: '技能等級' },
  { id: 'skill_arcane3', name: '祕法三', group: '技能等級' },
  { id: 'skill_arcane4', name: '祕法四', group: '技能等級' },
  { id: 'pet1', name: '幻獸一', group: '幻獸等級' },
  { id: 'pet2', name: '幻獸二', group: '幻獸等級' },
  { id: 'pet3', name: '幻獸三', group: '幻獸等級' },
  { id: 'pet4', name: '幻獸四', group: '幻獸等級' },
];

export const seasonOptions = [
  { id: 's1', name: 'S1 澤之國', readonly: false, season: 1 },
  { id: 's2', name: 'S2 龍之國', readonly: false, season: 2 },
  { id: 's3', name: 'S3 羽之國', readonly: false, season: 3 },
  { id: 's4', name: 'S4 哈帕迪', readonly: false, season: 4 },
  { id: 'total', name: '總計', readonly: true },
];

/** 頂部目標等級群 */
export const targetLevelConfig = [
  { id: 'character', name: '角色等級' },
  { id: 'equipment_resonance', name: '裝備共鳴' },
  { id: 'skill_resonance', name: '技能共鳴' },
  { id: 'pet_resonance', name: '幻獸共鳴' },
  { id: 'relic_resonance', name: '遺物共鳴' },
  { id: 'primordial_star', name: '原初之星', readonly: true }, // 自動計算
];

/** 可用素材 */
export const materials = {
  exp: { name: '角色經驗', icon: '📖' },
  rola: { name: '羅拉', icon: '💰' },
  essence: { name: '歷戰精華', icon: '✨' },
  sand: { name: '時之砂', icon: '⏳' },
  stoneOre: { name: '粗煉石', icon: '💎' },
  refiningStone: { name: '精煉石', icon: '🔨' },
  freezeDried: { name: '幻獸凍乾', icon: '🍖' },
};

/** 小推車來源（手動時產） */
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

/** 模擬資料（CSV 缺檔備援） */
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

// 1) 資源代號（需與試算表第一欄一致）
export const MATERIAL_TYPES = ['stone', 'essence', 'sand', 'rola', 'freeze_dried'];

export const MATERIAL_DISPLAY_NAMES = {
  stone: '粗煉石',
  essence: '歷戰精華',
  sand: '時之砂',
  rola: '羅拉',
  freeze_dried: '幻獸凍乾',
};

// TODO: 每日次數的預設值，目前先全部給空物件，需要時再填
const MATERIAL_DAILY_DEFAULTS = {
  dungeon: {},
  explore: {},
  store: {},
};


/** 各賽季 CSV 路徑（model.js 在 /js/，data 在 /data/） */
const DATA_BASE = new URL('../data/', import.meta.url);
const dataUrl = (name) => new URL(name, DATA_BASE).href;

/** Google 試算表基底連結（固定不動） */
const GOOGLE_SHEET_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTS_dK7OUmUkWmUTj_iotltVPzO-2Bjz0cefAshVWuu5qL6e2VXV-cr-wm1bkrVShI7mSZovU_zwz2B/pub';

/** 各賽季資料設定，只保留 gid */
export const DATA_FILES_CONFIG = {
  characterUpgradeCosts: 314585849,  // 角色等級
  equipmentUpgradeCosts: 1205841685,  // 裝備
  skillUpgradeCosts:     682954597,  // 技能
  relicUpgradeCosts:     1548103854,  // 遺物
  petUpgradeCosts:       1910677696,  // 幻獸
  resource:              751788076,  // 資源
  seasonScore:          1012321192,  // 賽季分數
};

/** 內部狀態 */
export const state = {
  seasonId: 's2',         // 預設賽季
  serverName: '淨心護甲', // 預設伺服器
  gameData: {},           // 升級表
  seasonScore: {},      // 賽季分數表
  resource: {},          // 資源表（依 type 分組）
  cumulativeCostData: {}, // 累積成本表
  missingFiles: [],       // 載入失敗清單
  materialAvgDefaults: {             // TODO: 新增，給素材來源估算使用的平均值
    dungeon: {},
    explore: {},
    store: {},
  },
};


// --- 放在 model.js ---
// 小工具：正規化 key（去掉 BOM、trim）
const normalizeKey = (k) => k ? k.replace(/^\uFEFF/, '').trim() : k;

// 強韌版 CSV 解析：處理 BOM、CR/LF、千分位、空值
export async function fetchAndParseCsv(url) {
  const res = await fetch(url, { cache: 'no-store' }); // 免快取，避免 GH Pages 舊檔
  if (!res.ok) throw new Error(`無法載入 CSV: ${url}`);
  const text = await res.text();
  // 統一成 LF，避免 \r 影響 split
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  if (lines.length === 0) return [];
  // 標頭去掉 BOM
  const rawHeaders = lines[0].split(',').map(h => normalizeKey(h));
  const headers = rawHeaders.map(h => h.toLowerCase()); // 全轉小寫，之後一致用小寫
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      const raw = (values[i] ?? '').trim();
      // 去掉千分位逗號後再轉數字；空字串給 0；轉不動就保留字串
      const num = Number(raw.replace(/,/g, ''));
      obj[h] = Number.isFinite(num) ? num : (raw === '' ? 0 : raw);
    });
    return obj;
  });
  return rows;
}

// 將成本資料轉為「累積表」—— 同時容錯任何大小寫 / BOM 的欄位名
export function preprocessCostData() {
  const src = state.gameData;
  const out = {};
  const tables = {
    character: src.characterUpgradeCosts,
    equipment: src.equipmentUpgradeCosts,
    skill:     src.skillUpgradeCosts,
    relic:     src.relicUpgradeCosts,
    pet:       src.petUpgradeCosts,
  };
  for (const type in tables) {
    const source = tables[type];
    out[type] = [];
    if (!source || source.length === 0) continue;
    // 取出所有以 cost_ 開頭的欄位（忽略大小寫、BOM）
    const firstRow = source[0];
    const costKeys = Object.keys(firstRow)
      .map(k => normalizeKey(k))
      .filter(k => /^cost_/.test(k.toLowerCase()));
    // 累積器
    const cumulative = {};
    costKeys.forEach(k => { cumulative[k] = 0; });
    for (let i = 0; i < source.length; i++) {
      const rawRow = source[i];
      // 正規化 row：key 全去 BOM + toLowerCase
      const row = {};
      Object.keys(rawRow).forEach(k => {
        const nk = normalizeKey(k).toLowerCase();
        row[nk] = rawRow[k];
      });
      // level 也可能帶 BOM 或大小寫不同
      const level = Number(row['level'] ?? row['等級'] ?? row['lvl'] ?? 0);
      costKeys.forEach(k => {
        const key = k.toLowerCase();
        const v = Number(row[key] ?? 0);
        cumulative[key] = (cumulative[key] || 0) + (Number.isFinite(v) ? v : 0);
      });
      out[type].push({ level, ...cumulative });
    }
  }
  state.cumulativeCostData = out;
}

/** 根據 gid 自動拼出 CSV URL */
function makeCsvUrl(gid) {
  return `${GOOGLE_SHEET_BASE}?gid=${gid}&single=true&output=csv`;
}

/** 載入對應賽季的資料 */
export async function loadDataForSeason(seasonId) {
  const targetSeason = seasonId;         // 's1' / 's2' / 's3'
  const loaded = {};
  state.missingFiles = [];

  for (const [key, gid] of Object.entries(DATA_FILES_CONFIG)) {
    const url = makeCsvUrl(gid);
    console.log(`[data load] loading ${key} from ${url} for season ${targetSeason}`);
    try {
      const rows = await fetchAndParseCsv(url);

      // 所有表都加了 season 欄位的情況
      const filtered = rows.filter((row) => {
        const s = String(row.season || '').toLowerCase();
        // 若這一列沒有 season（例如共用），就全賽季通用
        if (!s) return true;
        return s === targetSeason.toLowerCase();
      });

      if (key === 'resource') {
        // 將 resource 的資料寫入 state.resource
        state.resource = buildResourceDataForSeason(filtered, seasonId);
      } else if (key === 'seasonScore') {
        state.seasonScore = buildSeasonScoreData(filtered);
      } else {
        loaded[key] = filtered;
      }

    } catch (err) {
      console.warn(`❌ 無法載入 ${key} (${url})，改用模擬數據`, err);
      loaded[key] = MOCK_GAME_DATA[key];
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

// 由 resource CSV 生成：依 type（dungeon / explore / store）分組
function buildResourceDataForSeason(rows, seasonId) {
  const resourceData = {}; // TODO: { dungeon: { stone: row, ... }, explore: {...}, store: {...} }

  rows.forEach((r) => {
    const season = String(r.season || '').toLowerCase();
    if (season && season !== seasonId.toLowerCase()) return; // 只取當前賽季或共用

    const resKey = String(r.resource || '').trim();
    const typeKey = String(r.type || '').toLowerCase(); // dungeon / explore / store
    if (!resKey || !typeKey) return;

    if (!resourceData[typeKey]) resourceData[typeKey] = {};
    resourceData[typeKey][resKey] = r;
  });
  console.log('[data load] built resource data for season:', seasonId, resourceData);
  return resourceData;
}
// TODO: 從 resource 表載入「平均每次」預設值，填進 state.materialAvgDefaults
export async function loadMaterialAvgDefaults() {
  const avgDefaults = {
    dungeon: {},
    explore: {},
    store: {},  // 目前不使用，但保留結構
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
      if (avg === undefined) return;
      if (!avgDefaults[targetSource]) avgDefaults[targetSource] = {};
      avgDefaults[targetSource][mat] = avg;
    });
  });

  console.log('[data load] loaded material average defaults:', avgDefaults);
  state.materialAvgDefaults = avgDefaults;
}


// 給 controller / view 用的統一介面
export function getMaterialSourceConfig() {
  const avgDefaults =
    state.materialAvgDefaults || { dungeon: {}, explore: {}, store: {} }; // TODO: 加上安全預設

  return {
    displayNames: MATERIAL_DISPLAY_NAMES,
    dailyDefaults: MATERIAL_DAILY_DEFAULTS,
    avgDefaults,
    sourceMaterials: {
      dungeon: ['stone', 'essence', 'sand', 'rola'],
      explore: ['stone', 'essence', 'sand', 'rola'],
      store: ['stone', 'essence', 'sand', 'freeze_dried'], // 商店沒有 rola
    },
  };
}


/** 取得指定等級的累積成本（若不存在取最近低等級） */
export function getCumulative(costTable, level) {
  const empty = {};
  if (!costTable || costTable.length === 0) return empty;
  costTable.forEach(row => Object.keys(row).forEach(k => (empty[k] = 0)));
  delete empty.level;
  if (level <= 0) return empty;
  const idx = findLastIndexByLevel(costTable, level);
  return idx !== -1 ? { ...empty, ...costTable[idx] } : empty;
}

/** 賽季分數計算 **/
export function calculateSeasonScore(targets) {
  const cfg = state.seasonScore?.[state.seasonId]; // TODO: 加入容錯，避免 seasonScore 缺資料就爆掉
  if (!cfg) return 0;

  const season_level = cfg.season_level || 100;
  let score = 0;

  // 角色每一賽季等級 + 100 分
  if (targets.character > season_level) {
    score += (targets.character - season_level) * cfg['character_level_score'];
  }
  // 裝備每一賽季等級 + 14 分，共 5 件
  if (targets.equipment_resonance > season_level) {
    score += (targets.equipment_resonance - season_level) * cfg['equipment_level_score'] * 5;
  }
  // 技能每一賽季等級 + 5 分，共 8 個
  if (targets.skill_resonance > season_level) {
    score += (targets.skill_resonance - season_level) * cfg['skill_level_score'] * 8;
  }
  // 幻獸每一賽季等級 + 6 分，共 4 隻
  if (targets.pet_resonance > season_level) {
    score += (targets.pet_resonance - season_level) * cfg['pet_level_score'] * 4;
  }
  // 遺物每一賽季等級 + 26 分，共 20 件
  if (targets.relic_resonance > season_level / 10) {
    score += (targets.relic_resonance - season_level / 10) * cfg['relic_level_score'] * 20;
  }
  return score;
}

/** 賽季等級轉換原初之星 **/
export function convertPrimordialStar(score) {
  const cfg = state.seasonScore?.[state.seasonId]; // TODO: 加入容錯，缺資料時回傳 0
  if (!cfg) return 0;
  return Math.floor(score / cfg['star_convert'] + cfg['star_basis']);
}

/**
 * 計算「最低可達角色等級」
 *
 * 定義：
 * - cum(k-1) : 抵達 k 級所需的『累積』經驗。
 * - 當前等級 L ：玩家已經累積到 cum(L-1)（即剛達成 L 級的門檻）。
 * - ownedExp：目前持有、尚未用掉的經驗資源（包含手動輸入與床持續累加）。
 * - bedExpHourly：床每小時產出的經驗速率。
 * - targetTimeStr：目標時間（datetime-local 字串），若無則視為 0 小時。
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

function getNextDailyResetTimestamp(fromTs = Date.now()) {
  const resetAt = new Date(fromTs);
  resetAt.setHours(8, 0, 0, 0);
  if (fromTs >= resetAt.getTime()) {
    resetAt.setDate(resetAt.getDate() + 1);
  }
  return resetAt.getTime();
}

function countAvailableFreeSpeedupsUntil(targetTs, freeUsedToday, nowTs = Date.now()) {
  if (!Number.isFinite(targetTs) || targetTs <= nowTs) return 0;

  let uses = freeUsedToday ? 0 : 1;
  let resetTs = getNextDailyResetTimestamp(nowTs);
  while (resetTs <= targetTs) {
    uses += 1;
    const nextReset = new Date(resetTs);
    nextReset.setDate(nextReset.getDate() + 1);
    resetTs = nextReset.getTime();
  }
  return uses;
}

function getDynamicSpeedupHoursForEta(targetTs) {
  const { freeUsedToday, stoneCount } = getSpeedupState();
  const freeUses = countAvailableFreeSpeedupsUntil(targetTs, freeUsedToday);
  return (freeUses + stoneCount) * SPEEDUP_HOURS_PER_USE;
}

export function getSpeedupHoursForDays(dayCount) {
  const normalizedDays = Math.max(0, Math.ceil(Number(dayCount) || 0));
  if (normalizedDays <= 0) return 0;

  const { freeUsedToday, stoneCount } = getSpeedupState();
  const freeUses = Math.max(0, normalizedDays - (freeUsedToday ? 1 : 0));
  return (freeUses + stoneCount) * SPEEDUP_HOURS_PER_USE;
}

export function getSpeedupHoursForHours(hours) {
  const normalizedHours = Math.max(0, Number(hours) || 0);
  const dayCount = normalizedHours > 0 ? Math.ceil(normalizedHours / 24) : 0;
  return getSpeedupHoursForDays(dayCount);
}

export function computeReachableCharacterLevel(curLv, ownedExp, bedExpHourly, targetTimeStr) {
  const table = state.cumulativeCostData['character'];
  if (!table || !Number.isFinite(curLv)) return curLv;
  // 1) 目標時間 → 小時差（負值視為 0）
  const hours = targetTimeStr
    ? Math.max(0, (new Date(targetTimeStr).getTime() - Date.now()) / 36e5)
    : 0;
  const bonusHours = getSpeedupHoursForHours(hours);
  // 2) 目前已達成的累積經驗：cum(L)
  const baseCum = (getCumulative(table, curLv - 1)?.cost_exp || 0);
  // 3) 可用經驗（持有 + 床產），負值一律當 0 避免汙染
  const available =
    Math.max(0, Number(ownedExp) || 0) +
    Math.max(0, Number(bedExpHourly) || 0) * (hours + bonusHours);
  // 4) 總可支配的『累積』經驗值
  const totalExp = baseCum + available;
  // 5) 找出 cost_exp <= totalExp 的最大等級
  const idx = table.findLastIndex(d => (d.cost_exp || 0) <= totalExp);
  const reachable = (idx !== -1 ? table[idx].level : curLv);
  // 6) 不倒退，且不超過表中最大等級
  const maxLevelInTable = table[table.length - 1]?.level ?? curLv;
  return Math.min(Math.max(reachable, curLv), maxLevelInTable);
}

/** 主計算：需求 / 時產收益 / 缺口（渲染用 payload） */
export function computeAll(containers) {
  const required = {};
  const gains = {};
  const deficit = {};
  const missingDataErrors = {};
  let hasError = false;
  let hasInput = false;
  // 目標等級
  const targets = {};
  targetLevelConfig.forEach(t => {
    const v = parseInt(document.getElementById(`target-${t.id}`)?.value) || 0;
    targets[t.id] = v;
  });
  // 可達角色等級（顯示）
  const curCharLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedExp = parseInt(document.getElementById('owned-exp')?.value) || 0;
  const bedExpHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const targetTimeStr = document.getElementById('target-time')?.value;
  const targetHours = targetTimeStr
    ? Math.max(0, (new Date(targetTimeStr).getTime() - Date.now()) / 36e5)
    : 0;
  const targetBonusHours = getSpeedupHoursForHours(targetHours);
  const reachable = computeReachableCharacterLevel(curCharLv, ownedExp, bedExpHourly, targetTimeStr);
  const reachableEl = document.getElementById('target-char-reachable-level');
  if (reachableEl) reachableEl.textContent = `最低可達: ${reachable > 0 ? reachable : '--'}`;
  // 本季可得原初之星（自動）
  const score = calculateSeasonScore(targets);
  const ps = convertPrimordialStar(score);
  const psInput = document.getElementById('target-primordial_star');
  if (psInput) psInput.value = ps;
  // Primordial total is now accumulated plus the manually entered current-season target.
  const accumulatedPs = parseInt(document.getElementById('primordial-star-accumulated')?.value, 10) || 0;
  const currentSeasonPs = parseInt(document.getElementById('primordial-star-current-season')?.value, 10) || 0;
  const totalPs = accumulatedPs + currentSeasonPs;
  const totalPsEl = document.getElementById('primordial-star-total');
  if (totalPsEl) totalPsEl.value = totalPs;
  // Relic costs are derived from 20 relics split across completed and next levels.
  const targetRelicRes = targets.relic_resonance || 0;
  let relicCount = 0;
  getDerivedRelicDistribution().forEach(({ level, count }) => {
    const i = Number(level) || 0;
    if (count > 0) hasInput = true;
    relicCount += count;
    for (let j = 0; j < count; j++) {
      const current = i;
      const finalTarget = Math.max(current, targetRelicRes);
      if (finalTarget > current) {
        const costTable = state.cumulativeCostData.relic;
        const sourceTable = state.gameData.relicUpgradeCosts;
        let missing = false;
        if (sourceTable) {
          for (let lvl = current; lvl < finalTarget; lvl++) {
            if (!sourceTable.find(d => d.level === lvl)) {
              const msg = `數據缺失: 遺物缺少 ${lvl} 級`;
              if (!missingDataErrors.sand) missingDataErrors.sand = msg;
              if (!missingDataErrors.rola) missingDataErrors.rola = msg;
              missing = true; break;
            }
          }
        }
        if (!missing && costTable) {
          const start = getCumulative(costTable, current - 1);
          const end = getCumulative(costTable, finalTarget - 1);
          Object.keys(end).forEach(key => {
            if (key.startsWith('cost_')) {
              const matId = costKeyToMaterialId(key);
              const delta = (end[key] || 0) - (start[key] || 0);
              required[matId] = (required[matId] || 0) + delta;
            }
          });
        }
      }
    }
  });
  if (relicCount > 0 && relicCount !== RELIC_COUNT) hasError = true;
  // 角色 / 裝備 / 技能 / 幻獸成本
  categories.forEach(cat => {
    const current = parseInt(document.getElementById(`${cat.id}-current`)?.value) || 0;
    if (current > 0) hasInput = true;
    let targetRes = 0;
    if (cat.id === 'character') targetRes = targets.character || 0;
    else if (cat.id.startsWith('equipment_')) targetRes = targets.equipment_resonance || 0;
    else if (cat.id.startsWith('skill_')) targetRes = targets.skill_resonance || 0;
    else if (cat.id.startsWith('pet')) targetRes = targets.pet_resonance || 0;
    const finalTarget = Math.max(current, targetRes);
    if (finalTarget > current) {
      let costTable, sourceTable, itemName, affected = [];
      const g = state.gameData;
      if (cat.id.startsWith('equipment_')) {
        costTable = state.cumulativeCostData.equipment;
        sourceTable = g.equipmentUpgradeCosts;
        itemName = '裝備'; affected = ['stoneOre', 'rola', 'refiningStone'];
      } else if (cat.id.startsWith('skill_')) {
        costTable = state.cumulativeCostData.skill;
        sourceTable = g.skillUpgradeCosts;
        itemName = '技能'; affected = ['essence'];
      } else if (cat.id.startsWith('pet')) {
        costTable = state.cumulativeCostData.pet;
        sourceTable = g.petUpgradeCosts;
        itemName = '幻獸'; affected = ['freezeDried'];
      } else {
        costTable = state.cumulativeCostData[cat.id];
        sourceTable = g.characterUpgradeCosts;
        itemName = '角色'; affected = ['exp'];
      }
      let missing = false;
      if (sourceTable) {
        for (let lvl = current; lvl < finalTarget; lvl++) {
          if (!sourceTable.find(d => d.level === lvl)) {
            const msg = `數據缺失: ${itemName}缺少 ${lvl} 級`;
            affected.forEach(id => { if (!missingDataErrors[id]) missingDataErrors[id] = msg; });
            missing = true; break;
          }
        }
      }
      if (!missing && costTable) {
        const start = getCumulative(costTable, current - 1);
        const end = getCumulative(costTable, finalTarget - 1);
        Object.keys(end).forEach(key => {
          if (key.startsWith('cost_')) {
            const matId = costKeyToMaterialId(key);
            const delta = (end[key] || 0) - (start[key] || 0);
            required[matId] = (required[matId] || 0) + delta;
          }
        });
      }
    }
  });
  if (hasError) return { error: '輸入有誤 (例如遺物總數不為20)，請檢查。' };
  if (!hasInput) return { required: {}, gains: {}, deficit: {}, materialErrors: missingDataErrors };
    // 掛機收益（目標時間）
  if (targetTimeStr) {
    const hours = targetHours + targetBonusHours;
    Object.entries(productionSources).forEach(([srcId, src]) => {
      const hourly = parseFloat(document.getElementById(`manual-hourly-${srcId}`)?.value) || 0;
      const mat = src.materialId;
      gains[mat] = (gains[mat] || 0) + Math.floor(hourly * hours);
    });
    if (bedExpHourly > 0) {
      gains['exp'] = (gains['exp'] || 0) + Math.floor(bedExpHourly * hours);
    }
  }

  // TODO: 讀取「素材來源估算」的約可獲得數值，灌入 gains
  // data-source：dungeon / explore / store
  // data-material：stone / essence / sand / rola / freeze_dried
  const materialSpanList = document.querySelectorAll('.material-source-total');
  materialSpanList.forEach((span) => {
    const src = span.dataset.source;
    const matKey = span.dataset.material;
    if (!src || !matKey) return;

    const raw = (span.textContent || '').replace(/,/g, '').trim();
    const total = Number(raw) || 0;
    if (total <= 0) return;

    // material-key → computeAll 用的 materialId 映射
    let matId = null;
    // TODO: 將素材代號對應到 materials 內部使用的 id
    switch (matKey) {
      case 'stone':
        matId = 'stoneOre';
        break;
      case 'essence':
        matId = 'essence';
        break;
      case 'sand':
        matId = 'sand';
        break;
      case 'rola':
        matId = 'rola';
        break;
      case 'freeze_dried':
        matId = 'freezeDried';
        break;
      default:
        matId = null;
    }
    if (!matId) return;

    gains[matId] = (gains[matId] || 0) + total;
  });
  // 缺口：需求 - (持有 + 掛機)
  for (const matId in materials) {
    const need = required[matId] || 0;
    const owned = parseInt(document.getElementById(`owned-${matId}`)?.value) || 0;
    const g = gains[matId] || 0;
    deficit[matId] = Math.max(0, need - owned - g);
  }
  return { required, gains, deficit, materialErrors: missingDataErrors };
}

export function expCalculation(currentLevel, ownedExp, bedExpHourly, targetLevel, bonusHours = 0) {
  const table = state.cumulativeCostData['character'];
  if (!table || !Number.isFinite(currentLevel) || currentLevel >= MAX_LEVEL) {
    return { levelupTs: NaN, minutesNeeded: 0, expNeeded: NaN };
  }
  if (targetLevel <= currentLevel) {
    return { minutesNeeded: 0, etaTs: Date.now(), needExp: 0, status: 'reached' };
  }
  const cumPrev = (getCumulative(table, currentLevel - 1).cost_exp || 0);
  const cumThis = (getCumulative(table, targetLevel - 1).cost_exp || 0);
  const acceleratedExp = Math.max(0, Number(bedExpHourly) || 0) * Math.max(0, Number(bonusHours) || 0);
  const expNeeded = Math.max(0, cumThis - cumPrev - (Number(ownedExp) || 0) - acceleratedExp);
  if (expNeeded <= 0) return { levelupTs: Date.now(), minutesNeeded: 0, expNeeded: 0 };
  const ratePerHour = Number(bedExpHourly);
  if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) {
    return { levelupTs: NaN, minutesNeeded: 0, expNeeded };
  }
  const minutesNeeded = Math.ceil((expNeeded / ratePerHour) * 60);

  let day_cnt = Math.floor(minutesNeeded / (24 * 60));
  

  const levelupTs = Date.now() + minutesNeeded * 60 * 1000;
  return { levelupTs, minutesNeeded, expNeeded };
}

/** 計算到達下一級 ETA */
export function computeEtaToNextLevel(currentLevel, ownedExp, bedExpHourly, bonusHours = 0) {
  const { levelupTs, minutesNeeded, expNeeded } = expCalculation(
    currentLevel,
    ownedExp,
    bedExpHourly,
    currentLevel + 1,
    bonusHours
  );
  return { levelupTs, minutesNeeded, expNeeded };
}

/** 計算到達「目標角色等級」ETA（以及總所需經驗） */
export function computeEtaToTargetLevel(currentLevel, ownedExp, bedExpHourly, targetLevel, bonusHours = 0) {
  let appliedBonusHours = Math.max(0, Number(bonusHours) || 0);
  let result = expCalculation(
    currentLevel,
    ownedExp,
    bedExpHourly,
    targetLevel,
    appliedBonusHours
  );

  for (let i = 0; i < 8; i += 1) {
    if (!Number.isFinite(result.levelupTs) || result.minutesNeeded <= 0) break;

    const nextBonusHours = getDynamicSpeedupHoursForEta(result.levelupTs);
    if (nextBonusHours === appliedBonusHours) break;

    appliedBonusHours = nextBonusHours;
    result = expCalculation(
      currentLevel,
      ownedExp,
      bedExpHourly,
      targetLevel,
      appliedBonusHours
    );
  }

  return {
    etaTs: result.levelupTs,
    minutesNeeded: result.minutesNeeded,
    needExp: result.expNeeded,
    bonusHours: appliedBonusHours,
  };
}

/** LocalStorage 儲存/載入 */
export function saveAllInputs() {
  const data = {};
  document.querySelectorAll('input[type=number], input[type=datetime-local], input[type=checkbox], select')
    .forEach(input => {
      if (!input.id) return;
      data[input.id] = input.type === 'checkbox' ? input.checked : input.value;
    });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 讀回 localStorage：可忽略某些鍵避免覆蓋（例如 season-select） */
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

