// controller.js
// ★ 控制器層：初始化、事件繫結、調用 Model 與 View ★

import {
  state,
  STORAGE_KEY,
  seasonOptions,              // ← 新增：從 model.js 動態帶入賽季清單
  loadDataForSeason,
  preprocessCostData,
  saveAllInputs,
  loadAllInputs,
  computeAll,
  computeEtaToNextLevel,
  computeEtaToTargetLevel,
  getCumulative,

} from './model.js';

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

  const { levelupTs, minutesNeeded } = computeEtaToNextLevel(curLv, ownedExp, bedHourly);
  renderLevelupTimeText(minutesNeeded, levelupTs);

  const targetChar = parseInt(document.getElementById('target-character')?.value) || 0;
  const { minutesNeeded: m2, etaTs } =
    computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
  renderTargetEtaText(m2, etaTs);

  updateExpRequirements(curLv, ownedExp, targetChar);
  saveAllInputs();
}

// 讀取素材來源的 input（每日次數 / 平均值 / 商店每日購買）
// 檔案: controller.js (此函式無需變動，但它是獲取 rolaCost 的關鍵)

function getMaterialInput(source, material, role) {
  const el = document.querySelector(
    `.material-source-input[data-source="${source}"][data-material="${material}"][data-role="${role}"]`
  );

  if (!el) return 0;

  const v = parseFloat(el.value);
  return Number.isNaN(v) ? 0 : v;
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

    const { levelupTs, minutesNeeded } =
      computeEtaToNextLevel(curLv, ownedExp, bedHourly);
    renderLevelupTimeText(minutesNeeded, levelupTs);

    const { minutesNeeded: m2, etaTs } =
      computeEtaToTargetLevel(curLv, ownedExp, bedHourly, targetChar);
    renderTargetEtaText(m2, etaTs);

    updateExpRequirements(curLv, ownedExp, targetChar);
  }, 1000);
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
 * 初始化伺服器下拉選單 #server-select
 * 並把選取結果存到 state.serverName
 * ---------------------------*/
async function initServerSelector(containers) {
  const serverSel = document.getElementById('server-select');
  if (!serverSel) return;

  const servers = await fetchServerOptionsFromSheet();
  serverSel.innerHTML = '';
  servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    serverSel.appendChild(opt);
  });

  // 恢復之前選過的伺服器
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const savedServer = saved['server-select'];
  if (savedServer && [...serverSel.options].some(o => o.value === savedServer)) {
    serverSel.value = savedServer;
    state.serverName = savedServer;
  } else {
    serverSel.selectedIndex = 0;
    state.serverName = serverSel.value;
  }

  serverSel.addEventListener('change', () => {
    state.serverName = serverSel.value;
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['server-select'] = serverSel.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // 換伺服器時重新載入對應的目標時間選項
    initTargetTimeControls(containers);
    triggerRecalculate(containers);
  });
}

/* -----------------------------
 * 目標時間控制
 * ---------------------------*/
async function initTargetTimeControls(containers) {
  const presetSel = document.getElementById('target-time-preset');
  const displayBox = document.getElementById('target-time-display');
  const customInput = document.getElementById('target-time-custom');
  const hiddenField = document.getElementById('target-time');

  if (!presetSel || !displayBox || !customInput || !hiddenField) return;

  const allPresets = await fetchTimePresetsFromSheet();
  const selectedServer = state.serverName;

  // 填入 select：只放「目前伺服器」的選項
  presetSel.innerHTML = '';
  allPresets.forEach(p => {
    if (p.server_name && p.server_name !== selectedServer) return;
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

      // 自訂時間若為空 → 先帶入現在時間
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

      if (ts) {
        const d = new Date(ts);
        displayBox.textContent = d.toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else {
        displayBox.textContent = '--';
      }
    }

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data['target-time-preset'] = presetSel.value;
    data['target-time-custom'] = customInput.value || '';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    updateDaysRemainingFromTarget();
    updateAllMaterialSources();

    triggerRecalculate(containers);
  };

  presetSel.addEventListener('change', apply);
  customInput.addEventListener('input', apply);




  apply();
}

// 由 #target-time 推算剩餘天數（目標時間 - 現在時間）
function updateDaysRemainingFromTarget() {
  const hidden = document.getElementById('target-time');   // 隱藏目標時間
  const daysInput = document.getElementById('days-remaining');
  if (!hidden || !daysInput || !hidden.value) return;

  const target = new Date(hidden.value);
  if (Number.isNaN(target.getTime())) return;

  const now = new Date();
  let diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) diffMs = 0;

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));  // 有小數就往上取整
  daysInput.value = days;
}





function updateMaterialSourceRow(source, material) {
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
function updateAllMaterialSources() {
  const dungeonMats = ['stone', 'essence', 'sand', 'rola'];
  const exploreMats = ['stone', 'essence', 'sand', 'rola'];
  const shopMats = ['stone', 'essence', 'sand'];

  dungeonMats.forEach((m) => updateMaterialSourceRow('dungeon', m));
  exploreMats.forEach((m) => updateMaterialSourceRow('explore', m));
  shopMats.forEach((m) => updateMaterialSourceRow('shop', m));

  updateShopRolaCost();
}


function updateShopRolaCost() {
  const days =
    parseInt(document.getElementById('days-remaining')?.value || '0', 10) || 0;

  // 素材清單應與 view.js 中的 shopMats 一致，包含 freeze_dried
  const shopMats = ['stone', 'essence', 'sand', 'freeze_dried']; 
  let dailyCost = 0;

  shopMats.forEach((mat) => {
    // 從新的輸入欄位獲取使用者輸入的羅拉單價
    const unit = getMaterialInput('shop', mat, 'rolaCost'); 
    
    // 從舊的輸入欄位獲取每日購買量
    const dailyBuy = getMaterialInput('shop', mat, 'dailyBuy'); 
    
    dailyCost += dailyBuy * unit;
  });

  const dailyEl = document.getElementById('shop-rola-daily-cost');
  const totalEl = document.getElementById('shop-rola-total-cost');

  if (dailyEl) dailyEl.textContent = dailyCost ? dailyCost.toLocaleString() : '0';
  if (totalEl) totalEl.textContent = (dailyCost * days).toLocaleString();
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
  await initServerSelector(containers);
  await initTargetTimeControls(containers);

  updateRelicTotal();
  triggerRecalculate(containers);
}

/* -----------------------------
 * 通知相關（保留原本行為）
 * ---------------------------*/
async function enableLevelUpNotifications() {
  const curLv = parseInt(document.getElementById('character-current')?.value) || 0;
  const ownedWanStr = document.getElementById('owned-exp-wan')?.value?.trim();
  const ownedWan = ownedWanStr === '' ? NaN : parseFloat(ownedWanStr);
  const bedHourly = parseFloat(document.getElementById('bed-exp-hourly')?.value) || 0;
  const ownedExpInput = document.getElementById('owned-exp');

  const notifyTimeSelect = document.getElementById('notify-time-select');
  let notifyTime = 0;
  if (notifyTimeSelect.value === 'min1') notifyTime = 1;
  else if (notifyTimeSelect.value === 'min2') notifyTime = 2;
  else if (notifyTimeSelect.value === 'min3') notifyTime = 3;
  else if (notifyTimeSelect.value === 'min5') notifyTime = 5;

  if (ownedExpInput && isNaN(ownedWan)) return;
  const ownedExp = parseInt(ownedExpInput?.value) || 0;

  import('./model.js').then(({ scheduleLevelUpNotification }) => {
    scheduleLevelUpNotification(curLv, ownedExp, bedHourly, curLv + 1, notifyTime);
    alert('已啟用升級（下一級）通知');
  });
}

async function disableLevelUpNotifications() {
  import('./model.js').then(({ clearLevelUpNotification }) => {
    clearLevelUpNotification();
    alert('已清除升級通知');
  });
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
  // await loadMaterialAvgDefaults();       // ← from model.js
  renderMaterialSource(containers);
  updateDaysRemainingFromTarget();
  updateAllMaterialSources();

  // 自動更新經驗與現在時間
  setupAutoUpdate(containers);
  setInterval(() => updateCurrentTime(containers.currentTimeDisplay), 1000);
  updateCurrentTime(containers.currentTimeDisplay);
}

document.addEventListener('DOMContentLoaded', init);