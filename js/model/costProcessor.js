// js/model/costProcessor.js
// ★ 成本處理層：將原始成本數據轉換為累積表 ★

import { state } from './model.js';
import { findLastIndexByLevel } from '../utils.js'; // 引入 utils.js

// 小工具：正規化 key（去掉 BOM、trim）
const normalizeKey = (k) => k ? k.replace(/^\uFEFF/, '').trim() : k;

/**
 * 將成本資料轉為「累積表」。
 * 容錯任何大小寫 / BOM 的欄位名。
 */
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
    
    const firstRow = source[0];
    const costKeys = Object.keys(firstRow)
      .map(k => normalizeKey(k))
      .filter(k => /^cost_/.test(k.toLowerCase()));
    
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

/** 取得指定等級的累積成本（若不存在取最近低等級） */
export function getCumulative(costTable, level) {
  const empty = {};
  if (!costTable || costTable.length === 0) return empty;
  
  // 建立包含所有 cost_ 欄位的空物件
  costTable.forEach(row => Object.keys(row).forEach(k => (empty[k] = 0)));
  delete empty.level;
  
  if (level <= 0) return empty;
  
  // 依賴 utils.js 的 findLastIndexByLevel
  const idx = findLastIndexByLevel(costTable, level); 
  return idx !== -1 ? { ...empty, ...costTable[idx] } : empty;
}