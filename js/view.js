// view.js
// ★ 視圖層：負責渲染 DOM 與小型 UI 更新，不含業務邏輯 ★

import { el, fmt } from './utils.js';
import { categories, targetLevelConfig, materials, productionSources } from './model.js';

/** 一次取得頁面需要用到的容器節點 */
export function getContainers() {
  return {
    levelInputs: document.getElementById('level-inputs'),
    ownedMaterials: document.getElementById('owned-materials'),
    productionInputs: document.getElementById('production-inputs'),
    results: document.getElementById('results'),
    targetLevels: document.getElementById('target-levels'),
    relicDistributionInputs: document.getElementById('relic-distribution-inputs'),
    currentTimeDisplay: document.getElementById('current-time-display'),
    charBedInputs: document.getElementById('char-bed-inputs'),
    equipInputs: document.getElementById('equip-inputs'),
    skillInputs: document.getElementById('skill-inputs'),
    petInputs: document.getElementById('pet-inputs'),

  };
}

/** 共用：建立「標籤 + 數字輸入」區塊 */
export function createInputGroup(id, labelText, placeholder, isSub = false, extraHtml = '') {
  const wrap = el('div', isSub ? ['mb-4'] : []);
  const label = el('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
  label.htmlFor = id; label.textContent = labelText;

  const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
  input.type = 'number'; input.id = id; input.placeholder = placeholder;

  wrap.append(label, input);
  if (extraHtml) { const extra = el('div'); extra.innerHTML = extraHtml; wrap.appendChild(extra); }
  return wrap;
}

/** 目標等級（桌面固定一行六格，原初之星不換行） */
export function renderTargetLevels(container) {
  // 設定容器為 6 欄栅格
  container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4';

  container.innerHTML = '';
  targetLevelConfig.forEach(t => {
    const badge = (t.id === 'character')
      ? `<div id="target-char-reachable-level" class="text-xs text-gray-500 mt-1">最低可達: --</div>` : '';
    const isReadOnly = t.readonly === true;

    const group = createInputGroup(`target-${t.id}`, t.name, isReadOnly ? '自動計算' : '目標', false, badge);

    // 讓 label 不換行（原初之星特別重要）
    const label = group.querySelector('label');
    label.classList.add('whitespace-nowrap');

    if (isReadOnly) {
      const input = group.querySelector('input');
      input.setAttribute('disabled', 'disabled');
      input.setAttribute('aria-readonly', 'true');
      label.insertAdjacentHTML('beforeend',
        `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">自動</span>`
      );
    }

    container.appendChild(group);
  });
}


/** 遺物分佈 */
/** 遺物分佈（滿版：桌面 11 欄，與目標等級一致寬度） */
export function renderRelicDistribution(container) {
  container.innerHTML = '';
  // 手機 2、平板 4、md 6、桌面一次 11 個（10~20）
  container.className = 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-3';

  for (let i = 10; i <= 20; i++) {
    // 用共用 input group，讓每格自己撐滿欄寬
    const g = createInputGroup(`relic-level-${i}`, `等級 ${i}`, '數量');
    const label = g.querySelector('label');
    const input = g.querySelector('input');

    // 置中 & 滿版
    g.classList.add('min-w-0');                // 防止擠壓時跑版
    label.classList.add('text-center', 'mb-1');
    input.classList.add('w-full', 'text-center');

    // 標記 class 給其它程式用
    input.classList.add('relic-dist-input');

    container.appendChild(g);
  }
}


export function renderEquipInputs(container) {
  const frag = document.createDocumentFragment();
  const categoriesEquip = categories.filter(c => c.group === '裝備等級');
  const col1 = el('div'), col2 = el('div');
  categoriesEquip.forEach((cat, i) => {
    (i < 2 ? col1 : col2).appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true));
  });
  const wrap = el('div', ['grid', 'grid-cols-2', 'gap-x-6']);
  wrap.append(col1, col2);
  frag.appendChild(wrap);
  container.appendChild(frag);
}
export function renderSkillInputs(container) {
  const frag = document.createDocumentFragment();
  const s1 = el('div'), s2 = el('div');
  categories.filter(c => c.id.startsWith('skill_combat'))
    .forEach(cat => s1.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
  categories.filter(c => c.id.startsWith('skill_arcane'))
    .forEach(cat => s2.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
  const wrap = el('div', ['grid', 'grid-cols-2', 'gap-x-6']);
  wrap.append(s1, s2);
  frag.appendChild(wrap);
  container.appendChild(frag);
}
export function renderPetInputs(container) {
  const frag = document.createDocumentFragment();
  const petRow = el('div', ['grid', 'grid-cols-2', 'sm:grid-cols-4', 'gap-4']);
  categories.filter(c => c.id.startsWith('pet')).forEach(cat => {
    petRow.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前'));
  });
  frag.appendChild(petRow);
  container.appendChild(frag);
}



/** 中欄：小推車（固定順序、樣式與右欄一致） */
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

    row.append(label, input);
    container.appendChild(row);
  });
}

/** 中欄：角色與床（新）— 風格同上，一列一項 */
export function renderCharBed(container) {
  container.innerHTML = '';

  // 角色等級（搬到這張卡來）
  {
    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = 'character-current';
    label.textContent = '📘 角色等級（目前）';

    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.id = 'character-current';
    input.placeholder = '目前等級';

    row.append(label, input);
    container.appendChild(row);
  }

  // 床：時產量 + 升級時間顯示
  {
    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = 'bed-exp-hourly';
    label.textContent = '🛏️ 每小時經驗產量';

    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.id = 'bed-exp-hourly';
    input.placeholder = '0';

    row.append(label, input);
    container.appendChild(row);

    // 升級時間提示（放在輸入列下）
    const info = el('div', ['text-xs', 'text-gray-500', 'mt-2']);
    info.id = 'bed-levelup-time';
    info.textContent = '預計升級時間: --';
    container.appendChild(info);

  }
}

/** 右欄：素材（固定順序） */
export function renderMaterials(container) {
  const order = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried', 'exp'];

  order.forEach((id) => {
    const mat = materials[id];
    if (!mat) return;

    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = `owned-${id}`;
    label.textContent = `${mat.icon} ${mat.name}`;

    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.id = `owned-${id}`;
    input.placeholder = '0';

    row.append(label, input);
    container.appendChild(row);
  });
}

/** 一次性渲染所有靜態區塊 */
export function renderAll(containers) {
  // 清空容器
  Object.values(containers).forEach(c => c && (c.innerHTML = ''));
  renderSkillInputs(containers.skillInputs);
  renderEquipInputs(containers.equipInputs);
  renderPetInputs(containers.petInputs);
  renderTargetLevels(containers.targetLevels);
  renderRelicDistribution(containers.relicDistributionInputs);
  renderMaterials(containers.ownedMaterials);
  renderProduction(containers.productionInputs);
  // ★ 新增：渲染中欄「角色與床」
  renderCharBed(containers.charBedInputs);
}

/** 現在時間（每秒呼叫一次） */
export function updateCurrentTime(container) {
  if (!container) return;
  const now = new Date();
  container.textContent = now.toLocaleString('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

/** 遺物分佈總數 */
export function updateRelicTotal() {
  let total = 0;
  document.querySelectorAll('.relic-dist-input').forEach(i => total += (parseInt(i.value) || 0));
  const disp = document.getElementById('relic-total-display');
  disp.textContent = `(${total}/20)`;
  if (total !== 20 && total > 0) {
    disp.classList.add('text-warning'); disp.classList.remove('text-gray-400');
  } else {
    disp.classList.remove('text-warning'); disp.classList.add('text-gray-400');
  }
}

/** 結果輸出（五個橫條 + 狀態底色） */
export function renderResults(containers, payload, missingFiles = []) {
  const root = containers.results;
  root.innerHTML = '';

  if (missingFiles.length > 0) {
    root.insertAdjacentHTML('afterbegin',
      `<div class="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-300 p-3 rounded-lg mb-3 text-sm">
        <h4 class="font-bold">注意</h4>
        <p>無法載入以下數據檔案，已使用模擬數據：<br>${missingFiles.join(', ')}</p>
       </div>`);
  }
  if (payload?.error) {
    root.innerHTML += `<p class="text-warning text-center py-3">${payload.error}</p>`;
    return;
  }

  const { required = {}, gains = {}, deficit = {}, materialErrors = {} } = payload;
  const displayOrder = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];

  // ★ 改成「直向排列的五個橫條」
  const list = el('div', ['flex', 'flex-col', 'gap-3', 'w-full']);

  displayOrder.forEach((matId) => {
    const mat = materials[matId];

    const need = required[matId] || 0;
    const lack = deficit[matId] || 0;
    const gain = gains[matId] || 0;
    const hasError = !!materialErrors[matId];

    // 狀態顏色：
    // 紅：缺數據
    // 綠：目前已充足（缺口為 0 且沒有靠掛機補；或 need=0）
    // 藍：在目標時間前可達（缺口為 0 且有掛機產量貢獻）
    // 橘：尚不足（仍有缺口）
    let classes = 'border rounded-lg w-full px-4 py-3';
    if (hasError) {
      classes += ' bg-red-100 border-red-300';
    } else if (lack === 0 && (need === 0 || gain === 0)) {
      classes += ' bg-green-100 border-green-300';
    } else if (lack === 0 && gain > 0) {
      classes += ' bg-blue-100 border-blue-300';
    } else {
      classes += ' bg-orange-100 border-orange-300';
    }

    const row = el('div', classes.split(' '));

    // 左：名稱
    const left = el('div', ['flex', 'items-center', 'gap-2', 'min-w-0']);
    left.innerHTML = `<span class="text-xl">${mat.icon}</span><span class="font-bold text-slate-700">${mat.name}</span>`;

    // 右：數值（橫向對齊）
    const right = el('div', ['ml-auto', 'flex', 'items-center', 'gap-6', 'text-sm']);
    if (hasError) {
      right.innerHTML = `<span class="text-red-700 font-semibold">${materialErrors[matId]}</span>`;
    } else {
      right.innerHTML = `
        <span class="text-slate-700">總共需要: <strong>${fmt(need)}</strong></span>
        <span class="text-slate-700">還缺少: ${
          lack > 0 ? `<strong class="text-red-700">-${fmt(lack)}</strong>` : '<strong class="text-emerald-700">0（充足）</strong>'
        }</span>
      `;
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


/** 更新「預計升級時間」顯示 */
export function renderLevelupTimeText(minutesNeeded, levelupTs) {
  const disp = document.getElementById('bed-levelup-time');
  if (!disp) return;
  if (!Number.isFinite(levelupTs)) { disp.textContent = '預計升級時間: --'; return; }
  if (minutesNeeded <= 0) { disp.textContent = '預計升級時間: 可立即升級'; return; }

  const timeStr = new Date(levelupTs).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  disp.textContent = `預計升級時間: ${timeStr}（約 ${fmt(minutesNeeded)} 分鐘）`;


}
