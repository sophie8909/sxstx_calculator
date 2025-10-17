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
  rola: { name: '羅拉幣', icon: '💰' },
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

/** 各賽季 CSV 路徑 */
const DATA_BASE = new URL('../data/', import.meta.url); // model.js 在 /js/，data 在 /data/
const u = (name) => new URL(name, DATA_BASE).href;

export const DATA_FILES_CONFIG = {
  s1: {
    equipmentUpgradeCosts: u('equipment_upgrade_costs_s1.csv'),
    skillUpgradeCosts:     u('skill_upgrade_costs_s1.csv'),
    petUpgradeCosts:       u('pet_upgrade_costs_s1.csv'),
    relicUpgradeCosts:     u('relic_upgrade_costs_s1.csv'),
    characterUpgradeCosts: u('character_upgrade_costs_s1.csv'),
  },
  s2: {
    equipmentUpgradeCosts: u('equipment_upgrade_costs_s2.csv'),
    skillUpgradeCosts:     u('skill_upgrade_costs_s2.csv'),
    petUpgradeCosts:       u('pet_upgrade_costs_s2.csv'),
    relicUpgradeCosts:     u('relic_upgrade_costs_s2.csv'),
    characterUpgradeCosts: u('character_upgrade_costs_s2.csv'),
  },
};


/** 內部狀態 */
export const state = {
  seasonId: 's1',
  gameData: {},           // 原始表
  cumulativeCostData: {}, // 累積成本表
  missingFiles: [],       // 載入失敗清單
  notificationTimerId: null,
};

/** 讀取 CSV 並解析為物件陣列（第一列為標頭） */
export async function fetchAndParseCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`無法載入 CSV: ${url}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      const num = parseFloat(values[i]);
      obj[h] = isNaN(num) ? 0 : num;
    });
    return obj;
  });
}

/** 載入指定賽季的資料（CSV 缺檔則套用 MOCK） */
export async function loadDataForSeason(seasonId) {
  state.missingFiles = [];
  const dataFiles = DATA_FILES_CONFIG[seasonId] || DATA_FILES_CONFIG.s1;
  const loaded = {};

  for (const key in dataFiles) {
    try {
      loaded[key] = await fetchAndParseCsv(dataFiles[key]);
    } catch (err) {
      console.warn(`無法載入 ${dataFiles[key]}，改用模擬數據`, err);
      loaded[key] = MOCK_GAME_DATA[key];
      state.missingFiles.push(dataFiles[key]);
    }
  }
  state.gameData = loaded;
}

/** 將成本資料轉為「累積表」 */
export function preprocessCostData() {
  const src = state.gameData;
  const out = {};
  const tables = {
    equipment: src.equipmentUpgradeCosts,
    skill: src.skillUpgradeCosts,
    pet: src.petUpgradeCosts,
    relic: src.relicUpgradeCosts,
    character: src.characterUpgradeCosts,
  };

  for (const type in tables) {
    const source = tables[type];
    out[type] = [];
    let cumulative = {};
    if (source && source.length > 0) {
      Object.keys(source[0]).forEach(k => { if (k.startsWith('cost_')) cumulative[k] = 0; });
    }
    for (let i = 0; i < (source?.length || 0); i++) {
      const row = source[i];
      Object.keys(cumulative).forEach(k => cumulative[k] += (row[k] || 0));
      out[type].push({ level: row.level, ...cumulative });
    }
  }
  state.cumulativeCostData = out;
}

/** 取得指定等級的累積成本（若不存在取最近低等級） */
export function getCumulative(costTable, level) {
  const empty = {};
  if (!costTable || costTable.length === 0) return empty;
  costTable.forEach(row => Object.keys(row).forEach(k => empty[k] = 0));
  delete empty.level;
  if (level <= 0) return empty;
  const idx = findLastIndexByLevel(costTable, level);
  return idx !== -1 ? { ...empty, ...costTable[idx] } : empty;
}

/** S1 賽季分數換算 */
export function calculateSeasonScore_S1(targets) {
  let score = 0;
  if (targets.character > 100) score += (targets.character - 100) * 100;
  if (targets.equipment_resonance > 100) score += (targets.equipment_resonance - 100) * 190;
  if (targets.skill_resonance > 100) score += (targets.skill_resonance - 100) * 104;
  if (targets.pet_resonance > 100) score += (targets.pet_resonance - 100) * 56;
  if (targets.relic_resonance > 10) score += (targets.relic_resonance - 10) * 1140;
  return score;
}

/** S2 賽季分數換算（暫沿用現有假設） */
export function calculateSeasonScore_S2(targets) {
  let score = 0;
  if (targets.character > 100) score += (targets.character - 100) * 120;
  if (targets.equipment_resonance > 100) score += (targets.equipment_resonance - 100) * 200;
  if (targets.skill_resonance > 100) score += (targets.skill_resonance - 100) * 110;
  if (targets.pet_resonance > 100) score += (targets.pet_resonance - 100) * 60;
  if (targets.relic_resonance > 10) score += (targets.relic_resonance - 10) * 1200;
  return score;
}

/** 原初之星換算（S1 公式） */
export function convertPrimordialStar_S1(score) {
  return Math.floor(score / 100 + 10);
}

/** 計算最低可達角色等級（依目標時間/床） */
export function computeReachableCharacterLevel(curLv, ownedExp, bedExpHourly, targetTimeStr) {
  let reachable = curLv;
  const table = state.cumulativeCostData['character'];
  if (!targetTimeStr || !table) return reachable;

  const hours = Math.max(0, (new Date(targetTimeStr).getTime() - Date.now()) / 36e5);
  const currentCum = getCumulative(table, curLv - 1).cost_exp || 0;
  const totalExp = currentCum + (ownedExp || 0) + (bedExpHourly || 0) * hours;
  const idx = table.findLastIndex(d => (d.cost_exp || 0) <= totalExp);
  reachable = idx !== -1 ? table[idx].level : curLv;
  return reachable;
}

/** 主計算：需求 / 時產收益 / 缺口（回傳渲染需要的物件） */
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

  // 可達角色等級（顯示用）
  const curCharLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedExp = parseInt(document.getElementById('owned-exp')?.value) || 0; // 可加欄位後使用
  const bedExpHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const targetTimeStr = document.getElementById('target-time')?.value;

  const reachable = computeReachableCharacterLevel(curCharLv, ownedExp, bedExpHourly, targetTimeStr);
  const reachableEl = document.getElementById('target-char-reachable-level');
  if (reachableEl) reachableEl.textContent = `最低可達: ${reachable > 0 ? reachable : '--'}`;

  // 原初之星自動計算
  const seasonId = state.seasonId;
  let score = 0;
  if (seasonId === 's1') score = calculateSeasonScore_S1(targets);
  else if (seasonId === 's2') score = calculateSeasonScore_S2(targets);
  const ps = convertPrimordialStar_S1(score);
  const psInput = document.getElementById('target-primordial_star');
  if (psInput) psInput.value = ps;

  // 遺物成本（需 20 件）
  const targetRelicRes = targets.relic_resonance || 0;
  let relicCount = 0;
  for (let i = 10; i <= 20; i++) {
    const count = parseInt(document.getElementById(`relic-level-${i}`)?.value) || 0;
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
              missing = true;
              break;
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
  }
  if (relicCount > 0 && relicCount !== 20) hasError = true;

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
        itemName = '裝備';
        affected = ['stoneOre', 'rola', 'refiningStone'];
      } else if (cat.id.startsWith('skill_')) {
        costTable = state.cumulativeCostData.skill;
        sourceTable = g.skillUpgradeCosts;
        itemName = '技能';
        affected = ['essence'];
      } else if (cat.id.startsWith('pet')) {
        costTable = state.cumulativeCostData.pet;
        sourceTable = g.petUpgradeCosts;
        itemName = '幻獸';
        affected = ['freezeDried'];
      } else {
        costTable = state.cumulativeCostData[cat.id];
        sourceTable = g.characterUpgradeCosts;
        itemName = '角色';
        affected = ['exp'];
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

  // 若輸入錯誤（如遺物非 20） → 回傳錯訊
  if (hasError) {
    return { error: '輸入有誤 (例如遺物總數不為20)，請檢查。' };
  }
  // 若完全沒輸入 → 提示
  if (!hasInput) {
    return { required: {}, gains: {}, deficit: {}, materialErrors: missingDataErrors };
  }

  // 掛機收益（以手動時產 + 床、依目標時間）
  if (targetTimeStr) {
    const hours = Math.max(0, (new Date(targetTimeStr).getTime() - Date.now()) / 36e5);
    Object.entries(productionSources).forEach(([srcId, src]) => {
      const hourly = parseFloat(document.getElementById(`manual-hourly-${srcId}`)?.value) || 0;
      const mat = src.materialId;
      gains[mat] = (gains[mat] || 0) + Math.floor(hourly * hours);
    });
    if (bedExpHourly > 0) gains['exp'] = (gains['exp'] || 0) + Math.floor(bedExpHourly * hours);
  }

  // 缺口：需求 - (持有 + 掛機)
  for (const matId in materials) {
    const need = required[matId] || 0;
    const owned = parseInt(document.getElementById(`owned-${matId}`)?.value) || 0;
    const g = gains[matId] || 0;
    deficit[matId] = Math.max(0, need - owned - g);
  }

  return { required, gains, deficit, materialErrors: missingDataErrors };
}

/** 升級時間估算 + 通知排程（UI 顯示文字在 Controller 端更新） */
export function scheduleLevelUpNotification(currentLevel, ownedExp, bedExpHourly) {
  if (state.notificationTimerId) {
    clearTimeout(state.notificationTimerId);
    state.notificationTimerId = null;
  }
  if (bedExpHourly <= 0 || currentLevel >= MAX_LEVEL) return { levelupTs: NaN, minutesNeeded: 0 };

  const table = state.cumulativeCostData['character'];
  const next = table?.find(d => d.level === currentLevel);
  const cur = getCumulative(table, currentLevel - 1);
  if (!next) return { levelupTs: NaN, minutesNeeded: 0 };

  const nextCost = (next.cost_exp || 0) - (cur.cost_exp || 0);
  const expNeeded = Math.max(0, nextCost - (Number(ownedExp) || 0));
  if (expNeeded <= 0) return { levelupTs: Date.now(), minutesNeeded: 0 };

  const ratePerHour = Number(bedExpHourly);
  if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) return { levelupTs: NaN, minutesNeeded: 0 };

  const ratePerSec = ratePerHour / 3600;
  const secondsNeeded = Math.ceil(expNeeded / ratePerSec);
  const minutesNeeded = Math.ceil(secondsNeeded / 60);
  const levelupTs = Date.now() + minutesNeeded * 60 * 1000;

  // 瀏覽器通知（提前 3 分鐘）
  if ('Notification' in window && Notification.permission === 'granted') {
    const aligned = Math.ceil(levelupTs / 60000) * 60000;
    const notifyAt = aligned - 3 * 60 * 1000;
    const delay = notifyAt - Date.now();
    if (delay > 0) {
      const MAX_DELAY = 0x7fffffff; // 約 24.8 天
      const schedule = (ms) => {
        if (ms > MAX_DELAY) {
          state.notificationTimerId = setTimeout(() => schedule(ms - MAX_DELAY), MAX_DELAY);
        } else {
          state.notificationTimerId = setTimeout(() => {
            new Notification('杖劍傳說提醒', {
              body: `您的角色約 3 分鐘後可升級至 ${currentLevel + 1} 級！`,
              icon: 'https://placehold.co/192x192/31c9be/ffffff?text=LV',
            });
            state.notificationTimerId = null;
          }, ms);
        }
      };
      schedule(delay);
    }
  }
  return { levelupTs, minutesNeeded };
}

/** LocalStorage 儲存/載入 */
export function saveAllInputs() {
  const data = {};
  document.querySelectorAll('input[type=number], input[type=datetime-local], select')
    .forEach(input => { if (input.id) data[input.id] = input.value; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAllInputs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.keys(data).forEach(id => {
    const n = document.getElementById(id);
    if (n) n.value = data[id];
  });
}
