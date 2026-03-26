// view.js (refactored)
// ★ 視圖層：負責渲染 DOM 與小型 UI 更新，不含業務邏輯 ★

import { el, fmt } from './utils.js';
// 移除未使用的 STORAGE_KEY 匯入以精簡依賴
import {
  categories,
  seasonOptions,
  targetLevelConfig,
  materials,
  productionSources,
  getMaterialSourceConfig
} from './model.js';

/**
 * 一次取得頁面需要用到的容器節點。
 * 每個欄位對應 index.html 中的 id，用於後續渲染。
 */
export function getContainers() {
  return {
    // 左欄
    equipInputs: document.getElementById('equip-inputs'),
    skillInputs: document.getElementById('skill-inputs'),

    // 中欄
    charBedInputs: document.getElementById('char-bed-inputs'),
    petInputs: document.getElementById('pet-inputs'),
    productionInputs: document.getElementById('production-inputs'),
    materialSource: document.getElementById('material-source-container'),

    // 右欄
    ownedMaterials: document.getElementById('owned-materials'),
    results: document.getElementById('results'),

    // 上方
    primordialStarCumulative: document.getElementById('primordial-star-cumulative'),
    targetLevels: document.getElementById('target-levels'),
    relicDistributionInputs: document.getElementById('relic-distribution-inputs'),
    currentTimeDisplay: document.getElementById('current-time-display'),
  };
}

/**
 * 共用：建立「標籤 + 數字輸入」區塊。
 *
 * @param {string} id         input 元素的 id
 * @param {string} labelText  標籤文字
 * @param {string} placeholder 輸入框預設提示文字
 * @param {boolean} isSub     是否為子項（影響外層樣式）
 * @param {string} extraHtml  可選的附加 HTML（放在輸入框下方）
 */
export function createInputGroup(id, labelText, placeholder, isSub = false, extraHtml = '') {
  const wrap = el('div', isSub ? ['mb-4'] : []);
  const label = el('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
  label.htmlFor = id;
  label.textContent = labelText;

  const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
  input.type = 'number';
  input.id = id;
  input.placeholder = placeholder;
  input.min = '0';
  input.step = '1';

  wrap.append(label, input);
  if (extraHtml) {
    const extra = el('div');
    extra.innerHTML = extraHtml;
    wrap.appendChild(extra);
  }
  return wrap;
}

/*
 * 注意：這個檔案原本定義了一個 initTargetTimeControls 函式來處理目標時間選擇。
 * 控制器層已經提供了更完整的版本並包含 Google 試算表資料讀取，為了避免邏輯分散
 * 和重複，此 refactor 移除該函式，並改由 controller 負責。其他渲染函式保持不變。
 */

/**
 * 原初之星（累計）
 * 根據 seasonOptions 定義動態渲染輸入框。部分賽季為唯讀，展示從 model 計算的值。
 */
export function renderPrimordialStarCumulative(container) {
  container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4';
  container.innerHTML = '';
  const seasonSelect = document.getElementById('season-select');
  let currentSeason = 0;
  seasonOptions.forEach((s) => {
    if (s.id === seasonSelect.value) {
      currentSeason = s.season;
    }
  });


  // 只顯示當前賽季及以前賽季
  seasonOptions.forEach((season) => {
    if (season.season > currentSeason) return; // 跳過未來賽季
    const isReadOnly = season.readonly === true;
    const group = createInputGroup(
      `primordial-star-${season.id}`,
      `${season.name} 原初之星`,
      isReadOnly ? '自動計算' : '數量',
      false
    );
    const label = group.querySelector('label');
    label.classList.add('whitespace-nowrap');
    if (isReadOnly) {
      const input = group.querySelector('input');
      input.setAttribute('disabled', 'disabled');
      input.setAttribute('aria-readonly', 'true');
      label.insertAdjacentHTML(
        'beforeend',
        `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">自動</span>`
      );
    }
    container.appendChild(group);
  });
}

/**
 * 目標等級（一行六格）。
 * 根據 targetLevelConfig 定義渲染輸入框。部分欄位為唯讀，可顯示最低可達等級。
 */
export function renderTargetLevels(container) {
  container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4';
  container.innerHTML = '';
  targetLevelConfig.forEach((t) => {
    const badge =
      t.id === 'character'
        ? `<div id="target-char-reachable-level" class="text-xs text-gray-500 mt-1">最低可達: --</div>`
        : '';
    const isReadOnly = t.readonly === true;

    const group = createInputGroup(
      `target-${t.id}`,
      t.name,
      isReadOnly ? '自動計算' : '目標',
      false,
      badge
    );
    const label = group.querySelector('label');
    label.classList.add('whitespace-nowrap');

    if (isReadOnly) {
      const input = group.querySelector('input');
      input.setAttribute('disabled', 'disabled');
      input.setAttribute('aria-readonly', 'true');
      label.insertAdjacentHTML(
        'beforeend',
        `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">自動</span>`
      );
    }
    container.appendChild(group);
  });
}

/**
 * 右欄：素材（固定順序）。
 * 按指定順序渲染素材輸入列。
 */
export function renderMaterials(container) {
  const order = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];
  container.innerHTML = '';

  order.forEach((id) => {
    const mat = materials[id];
    if (!mat) return;
    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = `owned-${id}`;
    label.textContent = `${mat.icon} ${mat.name}`;

    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.id = `owned-${id}`;
    input.placeholder = '0';

    row.append(label, input);
    container.appendChild(row);
  });
}

/**
 * 遺物分佈（10~20）。
 * 動態產生 10~20 級數量輸入框，並添加必要的樣式類別。
 */
export function renderRelicDistribution(container) {
  container.innerHTML = '';
  container.className = 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-3';
  for (let i = 10; i <= 30; i++) {
    const g = createInputGroup(`relic-level-${i}`, `等級 ${i}`, '數量');
    const label = g.querySelector('label');
    const input = g.querySelector('input');
    g.classList.add('min-w-0');
    label.classList.add('text-center', 'mb-1');
    input.classList.add('w-full', 'text-center', 'relic-dist-input');
    container.appendChild(g);
  }
}

/**
 * 裝備輸入。
 * 依序顯示裝備等級相關的輸入組，可分兩欄呈現以節省空間。
 */
export function renderEquipInputs(container) {
  const frag = document.createDocumentFragment();
  const categoriesEquip = categories.filter((c) => c.group === '裝備等級');
  const col1 = el('div');
  const col2 = el('div');
  categoriesEquip.forEach((cat, i) => {
    (i < 2 ? col1 : col2).appendChild(
      createInputGroup(`${cat.id}-current`, cat.name, '目前', true)
    );
  });
  const wrap = el('div', ['grid', 'grid-cols-2', 'gap-x-6']);
  wrap.append(col1, col2);
  frag.appendChild(wrap);
  container.appendChild(frag);
}

/**
 * 技能輸入。
 * 分別渲染戰鬥技能與秘法技能兩欄的輸入框。
 */
export function renderSkillInputs(container) {
  const frag = document.createDocumentFragment();
  const s1 = el('div');
  const s2 = el('div');
  categories
    .filter((c) => c.id.startsWith('skill_combat'))
    .forEach((cat) => s1.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
  categories
    .filter((c) => c.id.startsWith('skill_arcane'))
    .forEach((cat) => s2.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
  const wrap = el('div', ['grid', 'grid-cols-2', 'gap-x-6']);
  wrap.append(s1, s2);
  frag.appendChild(wrap);
  container.appendChild(frag);
}

/**
 * 幻獸輸入。
 * 依序列出所有 pet 開頭的分類並產生輸入框。
 */
export function renderPetInputs(container) {
  const frag = document.createDocumentFragment();
  const petRow = el('div', ['grid', 'grid-cols-2', 'sm:grid-cols-4', 'gap-4']);
  categories.filter((c) => c.id.startsWith('pet')).forEach((cat) => {
    petRow.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前'));
  });
  frag.appendChild(petRow);
  container.appendChild(frag);
}

/**
 * 中欄：小推車（手動時產）。
 * 根據 productionSources 與 materials 定義渲染輸入框。
 */
export function renderProduction(container) {
  const order = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];
  order.forEach((key) => {
    const src = productionSources[key];
    if (!src) return;
    const matId = src.materialId;
    const mat = materials[matId];
    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = `manual-hourly-${key}`;
    label.textContent = `${mat.icon} ${mat.name}`;
    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.id = `manual-hourly-${key}`;
    input.placeholder = '時產量（手動輸入）';
    input.min = '0';
    input.step = '1';
    row.append(label, input);
    container.appendChild(row);
  });
}

/**
 * 中欄：角色與床（四行等寬對齊）。
 * 提供角色等級、經驗與床等輸入，並附帶提示資訊。
 */
export function renderCharBed(container) {
  container.innerHTML = '';
  const LABEL_PX = 170;
  const INPUT_PX = 200;
  const INPUT_H = 'h-9';
  const row = (opts) => {
    const { id, type = 'number', icon = '⚙️', label = '未命名', placeholder = '', readOnly = false } = opts;
    const wrap = el('div', ['w-full']);
    const line = el('div', ['flex', 'items-center', 'justify-between', 'gap-2']);
    const left = el('div', ['flex', 'items-center', 'gap-2', 'whitespace-nowrap']);
    left.style.width = `${LABEL_PX}px`;
    left.innerHTML = `<span class="text-lg">${icon}</span><span class="text-sm font-semibold">${label}</span>`;
    const right = el('div', ['flex', 'items-center', 'justify-end']);
    const input = el('input', ['input-field', 'rounded', 'p-2', INPUT_H]);
    input.id = id;
    input.placeholder = placeholder;
    input.style.width = `${INPUT_PX}px`;
    if (readOnly) {
      input.type = 'text';
      input.readOnly = true;
      input.classList.add('bg-slate-50', 'border', 'border-slate-200', 'text-gray-700', 'cursor-default');
      input.style.appearance = 'none';
    } else {
      input.type = type;
    }
    right.appendChild(input);
    line.append(left, right);
    wrap.appendChild(line);
    return wrap;
  };
  container.appendChild(row({ id: 'character-current', icon: '📘', label: '角色等級（目前）', placeholder: '目前等級' }));
  if (seasonOptions.some((s) => s.season >= 4)) {
    container.appendChild(row({ id: 'owned-exp-wan', icon: '🧮', label: '目前持有經驗（輸入）', placeholder: '以億為單位輸入' }));
  }
  else {  
    container.appendChild(row({ id: 'owned-exp-wan', icon: '🧮', label: '目前持有經驗（輸入）', placeholder: '以萬為單位輸入' }));
  }
  container.appendChild(row({ id: 'owned-exp', icon: '📖', label: '對應實際經驗值', placeholder: '自動換算（唯讀）', readOnly: true }));
  container.appendChild(row({ id: 'bed-exp-hourly', icon: '🛏️', label: '每小時經驗產量', placeholder: '0' }));
  const infoBox = el('div', ['mt-2', 'space-y-1', 'text-xs', 'text-gray-500']);
  const needNext = el('div');
  needNext.id = 'bed-levelup-exp';
  needNext.textContent = '升至下一級所需經驗: --';
  const etaNext = el('div');
  etaNext.id = 'bed-levelup-time';
  etaNext.textContent = '預計升級時間: --';
  const needTarget = el('div');
  needTarget.id = 'bed-target-exp';
  needTarget.textContent = '升至目標等級所需經驗: --';
  const etaTarget = el('div');
  etaTarget.id = 'bed-target-eta';
  etaTarget.textContent = '預計到達目標等級時間: --';
  infoBox.append(needNext, etaNext, needTarget, etaTarget);
  container.appendChild(infoBox);
}

/* ============================================================
 * 素材來源估算：畫面渲染
 * ============================================================ */

export function renderMaterialSource(containers) {
  const cfg = getMaterialSourceConfig();
  const { displayNames, dailyDefaults, avgDefaults, sourceMaterials } = cfg;

  const wrapper = containers.materialSource;
  if (!wrapper) return;

  const dungeonHtml = renderMaterialSourceTable(
    'dungeon',
    '素材秘境估算',
    sourceMaterials.dungeon,
    displayNames,
    dailyDefaults,
    avgDefaults,
    { showAvg: true }
  );

  const exploreHtml = renderMaterialSourceTable(
    'explore',
    '地圖探索估算',
    sourceMaterials.explore,
    displayNames,
    dailyDefaults,
    avgDefaults,
    { showAvg: true }
  );

  const storeHtml = renderMaterialSourceTable(
    'store',
    '商店估算',
    sourceMaterials.store,
    displayNames,
    dailyDefaults,
    avgDefaults,
    { showAvg: false } // 商店只有每日購買，不需要 average 欄
  );

  wrapper.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold text-emerald-700">素材來源估算（總覽）</h3>
      <div class="flex items-center gap-2 text-sm">
        <span class="font-semibold">剩餘天數：</span>
        <input
          id="days-remaining"
          type="number"
          class="border rounded px-2 py-1 w-20 text-right bg-gray-50"
          readonly
        />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      ${dungeonHtml}
      ${exploreHtml}
      ${storeHtml}
    </div>
  `;
}

function renderMaterialSourceTable(
  source,
  title,
  materialList,
  displayNames,
  dailyDefaults,
  avgDefaults,
  options
) {
  const showAvg = options.showAvg;
  const dd = dailyDefaults[source] || {};
  const ad = avgDefaults[source] || {};

  const headerCols = showAvg
    ? '<th>素材</th><th>每日次數</th><th>平均每次</th><th>約可獲得</th>'
    : '<th>素材</th><th>每日購買</th><th>羅拉花費</th><th>約可獲得</th>';
  const storeSummary =
  source === 'store'
    ? `
      <div class="mt-3 p-2 bg-gray-50 rounded border text-right text-sm">
        <div>每日花費羅拉：<span id="store-rola-daily-cost">0</span></div>
        <div>每日花費羅拉（手動）：<input id="store-rola-daily-cost-manual" type="number" class="input-field rounded px-1 py-0.5 w-24 text-right material-source-input" data-source="${source}" data-material="rolaCost" data-role="manual" value="0" /></div>
        <div>總花費羅拉（依剩餘天數）：<span id="store-rola-total-cost">0</span></div>
      </div>
    `
    : '';

  const rows = materialList
    .map((mat) => {
      const name = displayNames[mat] || mat;
      const daily = dd[mat] ?? 0;
      const avg = ad[mat] ?? 0;

      if (showAvg) {
        return `
          <tr class="border-b">
            <td class="py-1 text-center">${name}</td>
            <td class="py-1 text-center">
              <input type="number"
                class="input-field rounded px-1 py-0.5 w-20 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="daily"
                value="${daily}" />
            </td>
            <td class="py-1 text-center">
              <input type="number"
                class="input-field rounded px-1 py-0.5 w-24 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="avg"
                value="${avg}" />
            </td>
            <td class="py-1 text-right">
              <span class="material-source-total"
                data-source="${source}" data-material="${mat}">0</span>
            </td>
          </tr>
        `;
      } else {
        // store
        return `
          <tr class="border-b">
            <td class="py-1 text-center">${name}</td>
            <td class="py-1 text-center">
              <input type="number"
                class="input-field rounded px-1 py-0.5 w-24 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="avg"
                value="${avg}" />
            </td>
            
            <td class="py-1 text-center">
              <input type="number"
                class="input-field rounded px-1 py-0.5 w-24 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="rola-cost"
                value="0" />
            </td>
            
            <td class="py-1 text-right">
              <span class="material-source-total"
                data-source="${source}" data-material="${mat}">0</span>
            </td>
          </tr>
        `;
      }
    })
    .join('');

  return `
    <section>
      <h4 class="font-semibold mb-2 text-center">${title}</h4>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b">
            ${headerCols}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${storeSummary}
    </section>
  `;
}


/**
 * 主渲染：依序調用各子渲染函式。
 */
export function renderAll(containers) {
  Object.values(containers).forEach((c) => {
    if (c) c.innerHTML = '';
  });
  if (containers.primordialStarCumulative) renderPrimordialStarCumulative(containers.primordialStarCumulative);
  if (containers.targetLevels) renderTargetLevels(containers.targetLevels);
  if (containers.relicDistributionInputs) renderRelicDistribution(containers.relicDistributionInputs);
  if (containers.equipInputs) renderEquipInputs(containers.equipInputs);
  if (containers.skillInputs) renderSkillInputs(containers.skillInputs);
  if (containers.charBedInputs) renderCharBed(containers.charBedInputs);
  if (containers.petInputs) renderPetInputs(containers.petInputs);
  if (containers.productionInputs) renderProduction(containers.productionInputs);
  if (containers.ownedMaterials) renderMaterials(containers.ownedMaterials);
}

/**
 * 現在時間：以「zh-TW」格式更新顯示當前時間。
 */
export function updateCurrentTime(container) {
  if (!container) return;

  const now = new Date();

  // 顯示文字（用台灣在地格式，看起來比較直覺）
  const text = now.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // 如果是 input/textarea → 填在 value
  if ('value' in container) {
    container.value = text;
  }

  // 同時也更新 textContent，支援 div / span 之類的
  if ('textContent' in container) {
    container.textContent = text;
  }
}


/**
 * 遺物分佈總數：統計總數並更新顏色樣式。
 */
export function updateRelicTotal() {
  let total = 0;
  document.querySelectorAll('.relic-dist-input').forEach((i) => (total += parseInt(i.value) || 0));
  const disp = document.getElementById('relic-total-display');
  disp.textContent = `(${total}/20)`;
  if (total !== 20 && total > 0) {
    disp.classList.add('text-warning');
    disp.classList.remove('text-gray-400');
  } else {
    disp.classList.remove('text-warning');
    disp.classList.add('text-gray-400');
  }
}

/**
 * 結果輸出（五個橫條）。
 * 根據 computeAll 的輸出顯示需要、缺少或充足情況。
 */
export function renderResults(containers, payload, missingFiles = []) {
  const root = containers.results;
  root.innerHTML = '';
  if (missingFiles.length > 0) {
    root.insertAdjacentHTML(
      'afterbegin',
      `<div class="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-300 p-3 rounded-lg mb-3 text-sm">
        <h4 class="font-bold">注意</h4>
        <p>無法載入以下數據檔案，已使用模擬數據：<br>${missingFiles.join(', ')}</p>
       </div>`
    );
  }
  if (payload?.error) {
    root.innerHTML += `<p class="text-warning text-center py-3">${payload.error}</p>`;
    return;
  }
  const { required = {}, gains = {}, deficit = {}, materialErrors = {} } = payload;
  const displayOrder = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];
  const list = el('div', ['flex', 'flex-col', 'gap-3', 'w-full']);
  displayOrder.forEach((matId) => {
    const mat = materials[matId];
    const need = required[matId] || 0;
    const lack = deficit[matId] || 0;
    const gain = gains[matId] || 0;
    const hasError = !!materialErrors[matId];
    let classes = 'border rounded-lg w-full px-4 py-3';
    if (hasError) classes += ' bg-red-100 border-red-300';
    else if (need === 0) classes += ' bg-green-100 border-green-300';
    else if (lack === 0 && gain > 0) classes += ' bg-blue-100 border-blue-300';
    else if (lack === 0) classes += ' bg-green-100 border-green-300';
    else classes += ' bg-orange-100 border-orange-300';
    const row = el('div', classes.split(' '));
    const left = el('div', ['flex', 'items-center', 'gap-2', 'min-w-0']);
    left.innerHTML = `<span class="text-xl">${mat.icon}</span><span class="font-bold text-slate-700">${mat.name}</span>`;
    const right = el('div', ['ml-auto', 'flex', 'items-center', 'gap-6', 'text-sm']);
    if (hasError) {
      right.innerHTML = `<span class="text-red-700 font-semibold">${materialErrors[matId]}</span>`;
    } else {
      right.innerHTML = `
        <span class="text-slate-700">總共需要: <strong>${fmt(need)}</strong></span>
        <span class="text-slate-700">預計產出: <strong>${fmt(gain)}</strong></span>
        <span class="text-slate-700">還缺少: ${
          lack > 0
            ? `<strong class="text-red-700">-${fmt(lack)}</strong>`
            : '<strong class="text-emerald-700">0（充足）</strong>'
        }</span>`;
    }
    row.append(left, right);
    list.appendChild(row);
  });
  if (!Object.keys(required).length && !Object.keys(deficit).length && !Object.keys(materialErrors).length) {
    root.innerHTML += '<p class="text-gray-500 text-center py-6">請輸入資料以自動計算。</p>';
  } else {
    root.appendChild(list);
  }
}

/**
 * 時間與經驗需求更新。
 * 將分鐘需求與 ETA 轉成人類可讀字串並渲染到對應位置。
 */
export function renderLevelupTimeText(minutesNeeded, levelupTs) {
  const disp = document.getElementById('bed-levelup-time');
  if (!disp) return;
  if (!Number.isFinite(levelupTs)) {
    disp.textContent = '預計升級時間: --';
    return;
  }
  if (minutesNeeded <= 0) {
    disp.textContent = '預計升級時間: 可立即升級';
    return;
  }
  const timeStr = new Date(levelupTs).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  disp.textContent = `預計升級時間: ${fmt(minutesNeeded)} 分鐘（約 ${timeStr}）`;
}

export function renderTargetEtaText(minutesNeeded, etaTs) {
  const etaEl = document.getElementById('bed-target-eta');
  if (!etaEl) return;
  if (!Number.isFinite(etaTs)) {
    etaEl.textContent = '預計到達目標等級時間: --';
    return;
  }
  if (minutesNeeded <= 0) {
    etaEl.textContent = '預計到達目標等級時間: 可立即達成';
    return;
  }
  const timeStr = new Date(etaTs).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  etaEl.textContent = `預計到達目標等級時間: ${fmt(minutesNeeded)} 分鐘（約 ${timeStr}）`;
}

export function renderLevelupExpText(expNeeded) {
  const disp = document.getElementById('bed-levelup-exp');
  if (!disp) return;
  disp.textContent = Number.isFinite(expNeeded)
    ? `升至下一級所需經驗: ${fmt(expNeeded)}`
    : '升至下一級所需經驗: --';
}

export function renderTargetExpText(needExp) {
  const disp = document.getElementById('bed-target-exp');
  if (!disp) return;
  disp.textContent = Number.isFinite(needExp)
    ? `升至目標等級所需經驗: ${fmt(needExp)}`
    : '升至目標等級所需經驗: --';
}