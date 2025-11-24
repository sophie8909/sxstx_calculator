// controller.js
// ★ 控制器層：初始化、事件繫結、調用 Model 與 View ★

import {
  state,
  STORAGE_KEY,
  seasonOptions,
  loadDataForSeason,
  preprocessCostData,
  saveAllInputs,
  loadAllInputs,
  computeAll,
  computeEtaToNextLevel,
  computeEtaToTargetLevel,
  getCumulative,
  loadMaterialAvgDefaults,
} from './model/model.js'; 

import {
  // 匯入新的經驗計算輔助函式
  calculateFinalOwnedExp,
} from './model/calculator.js'; // 確保路徑正確

import {
  getContainers,
  renderAll,
  updateCurrentTime,
  updateRelicTotal,
  renderResults,
  renderLevelupTimeText,
  renderTargetEtaText,
  renderMaterialSource,
} from './view.js';

// ★★★ 匯入 Controller 子模組的所有必要函式 ★★★
import { 
  initServerSelector, 
  initTargetTimeControls 
} from './controller/configLoader.js';

import { 
  updateExpRequirements, 
  setupAutoUpdate, 
  enableLevelUpNotifications, 
  disableLevelUpNotifications 
} from './controller/timeControls.js';

import { 
  getMaterialInput, 
  updateDaysRemainingFromTarget, 
  updateAllMaterialSources,
  // 必須匯入被 bindGlobalHandlers 呼叫的細節函式
  updateMaterialSourceRow, 
  updateShopRolaCost, 
} from './controller/materialSource.js';

/* ============================================================
 * Google 試算表（Published CSV）設定：時間選項 / 伺服器來源
 * 試算表欄位：server_name, description, time
 * ============================================================ */
const TIME_PRESETS_SHEET = {
  base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMlpHJpHMNQTCxhYgj2fmvazou_cQpAiVa-w5tg7WR2EJTn4EExoLwojYM3BoS8FSTpxvaKIQdmPQC/pub',
  gid: '717680438',
};

// 讀不到試算表時的備援資料（時間已改成 08:00）
const TIME_PRESETS_FALLBACK = [
  {
    key: 's1_end',
    server_name: '淨心護甲',
    label: 'S1 結束（淨心護甲）',
    iso: '2025-10-13T08:00:00+08:00'
  },
  {
    key: 's2_open',
    server_name: '淨心護甲',
    label: 'S2 開啟（淨心護甲）',
    iso: '2025-11-10T08:00:00+08:00'
  },
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
  if (ownedExpInput) {
    ownedExpInput.value = isNaN(ownedWan) ? '' : Math.floor(ownedWan * 10000);
  }
  const ownedExp = parseInt(ownedExpInput?.value) || 0;

  const speedUpStoneCount = parseInt(document.getElementById('speed-up-stone-count')?.value) || 0;
  const dailyFreeSpeedUpCount = parseInt(document.getElementById('daily-free-speed-up-count')?.value) || 0;
  
  // ★★★ 將加速經驗計算移至 calculator.js，並取得「加上加速經驗後的總經驗」 ★★★
  const finalOwnedExp = calculateFinalOwnedExp(ownedExp, bedHourly, speedUpStoneCount, dailyFreeSpeedUpCount);

  // 移除了：
  // const SPEED_UP_HOURS_PER_ITEM = 2;
  // const totalSpeedUpHours = (speedUpStoneCount + dailyFreeSpeedUpCount) * SPEED_UP_HOURS_PER_ITEM;
  // const speedUpExpGain = Math.floor(bedHourly * totalSpeedUpHours);
  // const finalOwnedExp = ownedExp + speedUpExpGain; // 將加速經驗計入「瞬時持有經驗」

  
  const { levelupTs, minutesNeeded } = computeEtaToNextLevel(curLv, finalOwnedExp, bedHourly);
  renderLevelupTimeText(minutesNeeded, levelupTs);

  const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;
  const { minutesNeeded: m2, etaTs } =
    computeEtaToTargetLevel(curLv, finalOwnedExp, bedHourly, targetChar);
  renderTargetEtaText(m2, etaTs);

  updateExpRequirements(curLv, ownedExp, targetChar);
  saveAllInputs();
}



/* -----------------------------
 * 從 Google 試算表讀取「伺服器選項」
 * 表頭：server_name, description, time
 * 顯示文字：server_name
 * ---------------------------*/
async function fetchServerOptionsFromSheet() {
  const url = `${TIME_PRESETS_SHEET.base}?output=csv&gid=${encodeURIComponent(TIME_PRESETS_SHEET.gid)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());
    const serverIdx = headers.indexOf('server_name');

    const out = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      const server = cols[serverIdx] || '';
      if (server) out.add(server);
    }
    return Array.from(out);
  } catch (err) {
    console.warn('[server options] fetch failed, using fallback', err);
    return ['淨心護甲'];
  }
}

/* -----------------------------
 * 從 Google 試算表讀取「時間選項」
 * 表頭：server_name, description, time
 * 顯示文字：{description} ({server_name})
 * 時間一律轉成：該日期 08:00（+08:00）
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
    const descIdx   = headers.indexOf('description');
    const timeIdx   = headers.indexOf('time');

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols  = lines[i].split(',').map(s => s.trim());
      const server = cols[serverIdx] || '';
      const desc   = cols[descIdx]   || '';
      const time   = cols[timeIdx]   || '';
      if (!server && !desc && !time) continue;

      // 只取日期，然後補成 08:00:00+08:00
      let datePart = '';

      if (time.includes('T')) {
        // 已經有 ISO 形式 → 只取日期
        datePart = time.split('T')[0];
      } else {
        // 例如「2025/10/13」或「2025-10-13」
        const m = time.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (m) {
          const [, y, mo, d] = m;
          datePart = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          // 再不行就交給 Date 試著 parse，一樣只取日期
          const d2 = new Date(time);
          if (!Number.isNaN(d2.getTime())) {
            datePart = d2.toISOString().slice(0, 10);
          } else {
            // 完全看不懂就略過那一列
            continue;
          }
        }
      }

      const isoTime = `${datePart}T08:00:00+08:00`;

      out.push({
        key: `${server}_${i}`,
        server_name: server,
        label: `${desc}`,
        iso: isoTime,
      });
    }
    return out;
  } catch (err) {
    console.warn('[time presets] fetch failed, using fallback', err);
    return TIME_PRESETS_FALLBACK.slice();
  }
}

/* -----------------------------
 * 初始化賽季下拉選單 #season-select
 * 動態依據 model.js 的 seasonOptions 產生選項
 * ---------------------------*/
function initSeasonSelector(containers, saved = null) {
  const seasonSelector = document.getElementById('season-select');
  if (!seasonSelector) return;

  // 先清空，再依 seasonOptions 建立選項
  seasonSelector.innerHTML = '';
  seasonOptions.forEach((s) => {
    if (s.readonly) return; // 跳過唯讀賽季
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    seasonSelector.appendChild(opt);
  });

  // 套用儲存的賽季（若有）
  const data = saved ?? JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedSeason = data['season-select'];
  const defaultId = seasonOptions[0]?.id || 's2';

  if (savedSeason && seasonOptions.some((s) => s.id === savedSeason)) {
    seasonSelector.value = savedSeason;
    state.seasonId = savedSeason;
  } else {
    seasonSelector.value = defaultId;
    state.seasonId = defaultId;
  }

  // 監聽賽季變更：寫回 state + localStorage + 重新載入賽季資料
  seasonSelector.addEventListener('change', async () => {
    state.seasonId = seasonSelector.value;

    const latest = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    latest['season-select'] = state.seasonId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));

    await handleSeasonChange(containers);
  });
}


/* -----------------------------
 * 全域事件：任何輸入 / 選擇變更都重算
 * ---------------------------*/
function bindGlobalHandlers(containers) {

  document.addEventListener('input',
    (e) => {
      const t = e.target;
      if (t.tagName === 'INPUT') {
        // 素材來源估算欄位
        if (t.classList.contains('material-source-input')) {
          const src = t.dataset.source;
          const mat = t.dataset.material;
          if (src && mat) updateMaterialSourceRow(src, mat);
          if (src === 'shop') updateShopRolaCost();
        }

        if (t.classList.contains('relic-dist-input')) updateRelicTotal();
        triggerRecalculate(containers);
      }
    }, { passive: true });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT') {
      if (t.classList.contains('material-source-input')) {
        const src = t.dataset.source;
        const mat = t.dataset.material;
        if (src && mat) updateMaterialSourceRow(src, mat);
        if (src === 'shop') updateShopRolaCost();
      }

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
  // 若 selector 存在就以畫面為準，否則沿用 state 目前的值
  state.seasonId = seasonSelector?.value || state.seasonId || 's2';

  containers.results.innerHTML =
    '<p class="text-gray-500 text-center py-8">正在載入新賽季數據...</p>';

  await loadDataForSeason(state.seasonId);
  preprocessCostData();

  renderAll(containers);
  loadAllInputs(['season-select']); // 賽季用我們自己的邏輯處理

  // 先初始化伺服器選單，再依伺服器載入目標時間選項
  await initServerSelector(containers, triggerRecalculate);
  await initTargetTimeControls(containers, triggerRecalculate);

  updateRelicTotal();
  triggerRecalculate(containers);
}


/* -----------------------------
 * 初始化
 * ---------------------------*/
async function init() {
  const containers = getContainers();
  renderAll(containers);
  bindGlobalHandlers(containers);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  // 動態建立賽季選單 + 套用儲存值
  initSeasonSelector(containers, saved);

  // 升級通知按鈕
  const levelUpNotifyBtn = document.getElementById('enable-levelup-notify-btn');
  levelUpNotifyBtn?.addEventListener('click', () => enableLevelUpNotifications());

  const disableNotifyBtn = document.getElementById('disable-notify-btn');
  disableNotifyBtn?.addEventListener('click', () => disableLevelUpNotifications());

  const clearLocalDataBtn = document.getElementById('clear-local-data-btn');
  clearLocalDataBtn?.addEventListener('click', () => {
    if (confirm('確定要清除所有本地儲存的輸入資料嗎？')) {
      localStorage.removeItem(STORAGE_KEY);
      alert('本地儲存的輸入資料已清除，頁面將重新載入。');
      location.reload();
    }
  });

  // 根據當前賽季載入對應資料
  await handleSeasonChange(containers);

  // 先載入平均值、再畫素材來源 UI
  await loadMaterialAvgDefaults();       // ← from model.js
  renderMaterialSource(containers);
  updateDaysRemainingFromTarget();
  updateAllMaterialSources();

  const daysRemaining = parseInt(document.getElementById('days-remaining')?.value || '0', 10);
  const dailyFreeInput = document.getElementById('daily-free-speed-up-count');
  const savedDailyFree = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')['daily-free-speed-up-count'];

  if (dailyFreeInput && !savedDailyFree) {
    // 如果沒有儲存值，則使用剩餘天數作為預設值
    dailyFreeInput.value = daysRemaining;
  }

  // 自動更新經驗與現在時間
  setupAutoUpdate(containers);
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);
}

document.addEventListener('DOMContentLoaded', init);