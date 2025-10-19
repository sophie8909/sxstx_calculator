// controller.js
// ★ 控制器層：初始化、事件繫結、調用 Model 與 View ★

import {
  state, STORAGE_KEY, loadDataForSeason, preprocessCostData,
  saveAllInputs, loadAllInputs, computeAll,
  scheduleLevelUpNotification, computeEtaToTargetLevel, getCumulative
} from './model.js';

import {
  getContainers, renderAll, updateCurrentTime, updateRelicTotal,
  renderResults, renderLevelupTimeText, renderTargetEtaText
} from './view.js';

/* ============================================================
 *  Google 試算表（Published CSV）設定：時間選項來源
 *  將 base 換成你的公開 CSV base，gid 換成時間選項的工作表 gid。
 *  表頭格式：key,label,iso,season(可省)
 * ============================================================ */
const TIME_PRESETS_SHEET = {
  // 你的 Published CSV base（不含 gid）
  // 例：'https://docs.google.com/spreadsheets/d/e/2PACX-XXXX/pub'   （注意：最後不要帶 ?output=csv）
  base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMlpHJpHMNQTCxhYgj2fmvazou_cQpAiVa-w5tg7WR2EJTn4EExoLwojYM3BoS8FSTpxvaKIQdmPQC/pub',
  // 這個 gid 指到「時間選項」那個工作表
  gid: '1719043006', // ← 換成你的 gid
};

// 從 Google 試算表撈「時間選項」的 fallback（讀取失敗用）
const TIME_PRESETS_FALLBACK = [
  { key: 's1_end',  label: 'S1 結束：2025/10/13 07:59:59', iso: '2025-10-13T07:59:59', season: 's1' },
  { key: 's2_open', label: 'S2 開啟：2025/11/10 07:59:59', iso: '2025-11-10T07:59:59', season: 's2' },
];

/* -----------------------------
 * 統一重算
 * ---------------------------*/
function triggerRecalculate(containers) {
  const payload = computeAll(containers);
  renderResults(containers, payload, state.missingFiles);

  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;

  const ownedExpInput = document.getElementById('owned-exp');
  if (ownedExpInput) ownedExpInput.value = isNaN(ownedWan) ? '' : Math.floor(ownedWan * 10000);
  const ownedExp = parseInt(ownedExpInput?.value) || 0;

  const { levelupTs, minutesNeeded } = scheduleLevelUpNotification(curLv, ownedExp, bedHourly);
  renderLevelupTimeText(minutesNeeded, levelupTs);

  const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;
  const { minutesNeeded: m2, etaTs } = computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
  renderTargetEtaText(m2, etaTs);

  updateExpRequirements(curLv, ownedExp, targetChar);
  saveAllInputs();
}

/* -----------------------------
 * 顯示升級所需經驗
 * ---------------------------*/
function updateExpRequirements(curLv, ownedExp, targetChar) {
  const table = state.cumulativeCostData['character'];
  if (!table || !table.length) return;

  const cur = getCumulative(table, curLv - 1);
  const nxt = getCumulative(table, curLv);
  const tgt = getCumulative(table, targetChar - 1);

  const needNextExp = Math.max(0, (nxt.cost_exp || 0) - (cur.cost_exp || 0) - ownedExp);
  const needTargetExp = Math.max(0, (tgt.cost_exp || 0) - (cur.cost_exp || 0) - ownedExp);

  const elNext = document.getElementById('bed-levelup-exp');
  const elTarget = document.getElementById('bed-target-exp');
  if (elNext) elNext.textContent = `升至下一級所需經驗: ${needNextExp.toLocaleString()}`;
  if (elTarget) elTarget.textContent = `升至目標等級所需經驗: ${needTargetExp.toLocaleString()}`;
}

/* -----------------------------
 * 每秒同步更新經驗
 * ---------------------------*/
function setupAutoUpdate(containers) {
  setInterval(() => {
    const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
    const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
    const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
    const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
    const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;

    const ownedExpInput = document.getElementById('owned-exp');
    if (!ownedExpInput || isNaN(ownedWan)) return;

    const base = parseFloat(ownedExpInput.value) || ownedWan * 10000;
    const newExp = base + (bedHourly / 3600);
    ownedExpInput.value = Math.floor(newExp);
    const ownedExp = parseInt(ownedExpInput.value) || 0;

    const { levelupTs, minutesNeeded } = scheduleLevelUpNotification(curLv, ownedExp, bedHourly);
    renderLevelupTimeText(minutesNeeded, levelupTs);

    const { minutesNeeded: m2, etaTs } = computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
    renderTargetEtaText(m2, etaTs);
    updateExpRequirements(curLv, ownedExp, targetChar);
  }, 1000);
}

/* -----------------------------
 * 從 Google 試算表讀取「時間選項」
 * 表頭：server_name, description, time
 * 顯示文字：{description} ({server_name})
 * ---------------------------*/
async function fetchTimePresetsFromSheet() {
  const url = `${TIME_PRESETS_SHEET.base}?output=csv&gid=${encodeURIComponent(TIME_PRESETS_SHEET.gid)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());

    const serverIdx = headers.indexOf('server_name');
    const descIdx = headers.indexOf('description');
    const timeIdx = headers.indexOf('time');

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      const server = cols[serverIdx] || '';
      const desc = cols[descIdx] || '';
      const time = cols[timeIdx] || '';
      if (!server && !desc) continue;

      out.push({
        key: `${server}_${i}`,
        label: `${desc}${server ? ` (${server})` : ''}`,
        iso: time,
      });
    }
    return out;
  } catch (err) {
    console.warn('[time presets] fetch failed, using fallback', err);
    return TIME_PRESETS_FALLBACK.slice();
  }
}

/* -----------------------------
 * 目標時間控制（動態選單 from Google）
 * 使用節點：
 *  - #target-time-preset  (select)
 *  - #target-time-custom  (input[type=datetime-local])：自訂模式顯示
 *  - #target-time-display (div)：預設模式顯示
 *  - #target-time         (input[type=hidden])：進計算
 * 行為：
 *  - 讀 Google → 填入選項（顯示 {description} ({server_name})）
 *  - 選「自訂時間」：若空白先帶入「現在時間」
 *  - 任何變動 → 存檔 + 重算
 * ---------------------------*/
async function initTargetTimeControls(containers) {
  const presetSel = document.getElementById('target-time-preset');
  const displayBox = document.getElementById('target-time-display');
  const customInput = document.getElementById('target-time-custom');
  const hiddenField = document.getElementById('target-time');

  if (!presetSel || !displayBox || !customInput || !hiddenField) return;

  // 讀 Google 時間選項
  const allPresets = await fetchTimePresetsFromSheet();

  // 填入 select
  presetSel.innerHTML = '';
  allPresets.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    presetSel.appendChild(opt);
  });

  // 追加「自訂時間」
  const optCustom = document.createElement('option');
  optCustom.value = '__custom__';
  optCustom.textContent = '自訂時間';
  presetSel.appendChild(optCustom);

  // 恢復選取
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedKey = saved['target-time-preset'];
  if (savedKey && [...presetSel.options].some(o => o.value === savedKey)) {
    presetSel.value = savedKey;
  } else {
    presetSel.selectedIndex = 0;
  }
  customInput.value = saved['target-time-custom'] || '';

  const apply = () => {
    const v = presetSel.value;
    if (v === '__custom__') {
      customInput.classList.remove('hidden');
      displayBox.classList.add('hidden');

      // 自訂時間若為空 → 自動填入目前時間
      if (!customInput.value) {
        const now = new Date();
        const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        customInput.value = localISO;
      }
      hiddenField.value = customInput.value || '';
    } else {
      customInput.classList.add('hidden');
      displayBox.classList.remove('hidden');

      const found = allPresets.find(p => p.key === v);
      const ts = found?.iso || '';
      hiddenField.value = ts;
      displayBox.textContent = ts ? ts.replace('T', ' ') : '--';
    }

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['target-time-preset'] = presetSel.value;
    data['target-time-custom'] = customInput.value || '';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    triggerRecalculate(containers);
  };

  presetSel.addEventListener('change', apply);
  customInput.addEventListener('input', apply);

  apply();
}

/* -----------------------------
 * 全域事件：任何輸入或選擇變更都觸發重算
 * ---------------------------*/
function bindGlobalHandlers(containers) {
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.tagName === 'INPUT') {
      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      triggerRecalculate(containers);
    }
  }, { passive: true });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT') {
      if (t.classList.contains('relic-dist-input')) updateRelicTotal();
      triggerRecalculate(containers);
    }
  }, { passive: true });
}

/* -----------------------------
 * 賽季切換
 * ---------------------------*/
async function handleSeasonChange(containers) {
  const seasonSelector = document.getElementById('season-select');
  state.seasonId = seasonSelector?.value || 's1';

  containers.results.innerHTML =
    '<p class="text-gray-500 text-center py-8">正在載入新賽季數據...</p>';
  await loadDataForSeason(state.seasonId);
  preprocessCostData();

  renderAll(containers);
  loadAllInputs(['season-select']);

  // ※ 時間選項來自 Google（依賽季過濾）
  await initTargetTimeControls(containers);

  updateRelicTotal();
  triggerRecalculate(containers);

  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data['season-select'] = state.seasonId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* -----------------------------
 * 初始化
 * ---------------------------*/
async function init() {
  const containers = getContainers();
  renderAll(containers);
  bindGlobalHandlers(containers);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const seasonSelector = document.getElementById('season-select');
  if (seasonSelector) seasonSelector.value = saved['season-select'] || 's1';

  await handleSeasonChange(containers);
  seasonSelector?.addEventListener('change', () => handleSeasonChange(containers));

  setupAutoUpdate(containers);
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);
}

document.addEventListener('DOMContentLoaded', init);
