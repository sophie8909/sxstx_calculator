// js/controller/materialSource.js
// ★ 處理素材來源估算表格的互動與計算 ★

import { state } from '../model/model.js';

// 讀取素材來源的 input（每日次數 / 平均值 / 商店每日購買/羅拉單價）
export function getMaterialInput(source, material, role) {
  const el = document.querySelector(
    `.material-source-input[data-source="${source}"][data-material="${material}"][data-role="${role}"]`
  );

  if (!el) return 0;

  const v = parseFloat(el.value);
  return Number.isNaN(v) ? 0 : v;
}

// 由 #target-time 推算剩餘天數（目標時間 - 現在時間）
export function updateDaysRemainingFromTarget() {
  const hidden = document.getElementById('target-time');
  const daysInput = document.getElementById('days-remaining');
  if (!hidden || !daysInput || !hidden.value) return;

  const target = new Date(hidden.value);
  if (Number.isNaN(target.getTime())) return;

  const now = new Date();
  let diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) diffMs = 0;

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  daysInput.value = days;
}

export function updateMaterialSourceRow(source, material) {
  const days = parseInt(
    document.getElementById('days-remaining')?.value || '0',
    10
  );

  const totalSpan = document.querySelector(
    `.material-source-total[data-source="${source}"][data-material="${material}"]`
  );
  if (!totalSpan) return;

  let total = 0;

  if (source === 'shop') {
    const dailyBuy = getMaterialInput(source, material, 'dailyBuy');
    total = dailyBuy * days;
  } else {
    const daily = getMaterialInput(source, material, 'daily');
    const avg = getMaterialInput(source, material, 'avg');
    total = daily * avg * days;
  }

  totalSpan.textContent = total ? total.toLocaleString() : '0';
}


export function updateShopRolaCost() {
  const days =
    parseInt(document.getElementById('days-remaining')?.value || '0', 10) || 0;

  // 素材清單應與 view.js 中的 shopMats 一致，包含 freeze_dried
  const shopMats = ['stone', 'essence', 'sand', 'freeze_dried']; 
  let dailyCost = 0;

  shopMats.forEach((mat) => {
    // 從輸入欄位獲取羅拉單價
    const unit = getMaterialInput('shop', mat, 'rolaCost'); 
    // 從輸入欄位獲取每日購買量
    const dailyBuy = getMaterialInput('shop', mat, 'dailyBuy'); 
    
    dailyCost += dailyBuy * unit;
  });

  const dailyEl = document.getElementById('shop-rola-daily-cost');
  const totalEl = document.getElementById('shop-rola-total-cost');

  if (dailyEl) dailyEl.textContent = dailyCost ? dailyCost.toLocaleString() : '0';
  if (totalEl) totalEl.textContent = (dailyCost * days).toLocaleString();
}

/** 總結所有素材來源表格的更新 */
export function updateAllMaterialSources() {
  const dungeonMats = ['stone', 'essence', 'sand', 'rola'];
  const exploreMats = ['stone', 'essence', 'sand', 'rola'];
  const shopMats = ['stone', 'essence', 'sand', 'freeze_dried']; // 修正：應包含 freeze_dried

  dungeonMats.forEach((m) => updateMaterialSourceRow('dungeon', m));
  exploreMats.forEach((m) => updateMaterialSourceRow('explore', m));
  shopMats.forEach((m) => updateMaterialSourceRow('shop', m));

  updateShopRolaCost();
}