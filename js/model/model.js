// js/model/model.js
// ★ 狀態管理層：聚合所有 model 模組並對外提供接口 ★

import {
  MAX_LEVEL,
  STORAGE_KEY,
  categories,
  seasonOptions,
  targetLevelConfig,
  materials,
  productionSources,
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_DAILY_DEFAULTS,
} from './constants.js';

import {
  loadDataForSeason,
  loadMaterialAvgDefaults,
} from './dataLoader.js';

import {
  preprocessCostData,
  getCumulative,
} from './costProcessor.js';

import {
  computeAll,
  computeEtaToNextLevel,
  computeEtaToTargetLevel,
  computeReachableCharacterLevel,
  clearLevelUpNotification,
  scheduleLevelUpNotification,
  scheduleTargetLevelNotification,
} from './calculator.js';


/** 內部狀態 */
export const state = {
  seasonId: 's2',         // 預設賽季
  serverName: '淨心護甲', // 預設伺服器
  gameData: {},           // 原始表
  cumulativeCostData: {}, // 累積成本表
  missingFiles: [],       // 載入失敗清單
  notificationTimerIdLevelUp: null, // 升級通知計時器 ID
  notificationTimerIdTargetLevel: null, // 目標等級通知計時器 ID
  materialAvgDefaults: {  // 存放從 CSV 讀回來的平均值
    dungeon: {},
    explore: {},
    shop: {},
  },
};


// --- 對外開放的常數與函式 ---

// 核心狀態與常數
export { MAX_LEVEL, STORAGE_KEY, categories, seasonOptions, targetLevelConfig, materials, productionSources };

// 成本與數據處理
export { preprocessCostData, getCumulative };

// 數據載入
export { loadDataForSeason, loadMaterialAvgDefaults };

// 核心計算
export { computeAll, computeEtaToNextLevel, computeEtaToTargetLevel, computeReachableCharacterLevel };

// 通知
export { clearLevelUpNotification, scheduleLevelUpNotification, scheduleTargetLevelNotification };


// LocalStorage 儲存/載入 (此部分仍需依賴 DOM，故保留於此層)
export function saveAllInputs() {
  const data = {};
  document.querySelectorAll('input[type=number], input[type=datetime-local], select')
    .forEach(input => { if (input.id) data[input.id] = input.value; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAllInputs(excludeKeys = []) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.keys(data).forEach(id => {
    if (excludeKeys.includes(id)) return;
    const n = document.getElementById(id);
    if (n) n.value = data[id];
  });
}

// 給 controller / view 用的素材來源統一介面
export function getMaterialSourceConfig() {
  return {
    displayNames: MATERIAL_DISPLAY_NAMES,
    dailyDefaults: MATERIAL_DAILY_DEFAULTS,
    avgDefaults: state.materialAvgDefaults,
    sourceMaterials: {
      dungeon: ['stone', 'essence', 'sand', 'rola'],
      explore: ['stone', 'essence', 'sand', 'rola'],
      shop: ['stone', 'essence', 'sand', 'freeze_dried'], // 商店沒有 rola
    },
  };
}