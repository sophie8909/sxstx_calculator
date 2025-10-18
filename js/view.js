// view.js
// ★ 視圖層：負責渲染 DOM 與小型 UI 更新，不含業務邏輯 ★

import { el, fmt } from './utils.js';
import { categories, targetLevelConfig, materials, productionSources } from './model.js';

/** 一次取得頁面需要用到的容器節點 */
export function getContainers() {
  return {
    // 左欄
    equipInputs: document.getElementById('equip-inputs'),
    skillInputs: document.getElementById('skill-inputs'),

    // 中欄
    charBedInputs: document.getElementById('char-bed-inputs'),
    petInputs: document.getElementById('pet-inputs'),
    productionInputs: document.getElementById('production-inputs'),

    // 右欄
    ownedMaterials: document.getElementById('owned-materials'),
    results: document.getElementById('results'),

    // 上方
    targetLevels: document.getElementById('target-levels'),
    relicDistributionInputs: document.getElementById('relic-distribution-inputs'),
    currentTimeDisplay: document.getElementById('current-time-display'),
  };
}

/** 共用：建立「標籤 + 數字輸入」區塊 */
export function createInputGroup(id, labelText, placeholder, isSub = false, extraHtml = '') {
  const wrap = el('div', isSub ? ['mb-4'] : []);
  const label = el('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
  label.htmlFor = id; label.textContent = labelText;

  const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
  input.type = 'number'; input.id = id; input.placeholder = placeholder;
  input.min = '0'; input.step = '1';

  wrap.append(label, input);
  if (extraHtml) { const extra = el('div'); extra.innerHTML = extraHtml; wrap.appendChild(extra); }
  return wrap;
}

/** 目標等級（一行六格） */
export function renderTargetLevels(container) {
  container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4';
  container.innerHTML = '';
  targetLevelConfig.forEach(t => {
    const badge = (t.id === 'character')
      ? `<div id="target-char-reachable-level" class="text-xs text-gray-500 mt-1">最低可達: --</div>` : '';
    const isReadOnly = t.readonly === true;

    const group = createInputGroup(`target-${t.id}`, t.name, isReadOnly ? '自動計算' : '目標', false, badge);
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

/** 右欄：素材（固定順序） */
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


/** 遺物分佈（10~20） */
export function renderRelicDistribution(container) {
  container.innerHTML = '';
  container.className = 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-3';
  for (let i = 10; i <= 20; i++) {
    const g = createInputGroup(`relic-level-${i}`, `等級 ${i}`, '數量');
    const label = g.querySelector('label');
    const input = g.querySelector('input');
    g.classList.add('min-w-0');
    label.classList.add('text-center', 'mb-1');
    input.classList.add('w-full', 'text-center', 'relic-dist-input');
    container.appendChild(g);
  }
}

/** 裝備輸入 */
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

/** 技能輸入 */
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

/** 幻獸輸入 */
export function renderPetInputs(container) {
  const frag = document.createDocumentFragment();
  const petRow = el('div', ['grid', 'grid-cols-2', 'sm:grid-cols-4', 'gap-4']);
  categories.filter(c => c.id.startsWith('pet')).forEach(cat => {
    petRow.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前'));
  });
  frag.appendChild(petRow);
  container.appendChild(frag);
}

/** 中欄：小推車（手動時產） */
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
    input.min = '0'; input.step = '1';

    row.append(label, input);
    container.appendChild(row);
  });
}

/** 中欄：角色與床（四行等寬對齊） */
export function renderCharBed(container) {
  container.innerHTML = '';

  const LABEL_PX = 170;
  const INPUT_PX = 200;
  const INPUT_H = 'h-9';

  const row = (opts) => {
    const { id, type='number', icon='⚙️', label='未命名', placeholder='', readOnly=false } = opts;
    const wrap = el('div', ['w-full']);
    const line = el('div', ['flex','items-center','justify-between','gap-2']);
    const left = el('div', ['flex','items-center','gap-2','whitespace-nowrap']);
    left.style.width = `${LABEL_PX}px`;
    left.innerHTML = `<span class="text-lg">${icon}</span><span class="text-sm font-semibold">${label}</span>`;
    const right = el('div', ['flex','items-center','justify-end']);
    const input = el('input', ['input-field','rounded','p-2', INPUT_H]);
    input.id = id; input.placeholder = placeholder; input.style.width = `${INPUT_PX}px`;
    if (readOnly) {
      input.type = 'text'; input.readOnly = true;
      input.classList.add('bg-slate-50','border','border-slate-200','text-gray-700','cursor-default');
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
  container.appendChild(row({ id: 'owned-exp-wan', icon: '🧮', label: '目前持有經驗（輸入）', placeholder: '以萬為單位輸入' }));
  container.appendChild(row({ id: 'owned-exp', icon: '📖', label: '對應實際經驗值', placeholder: '自動換算（唯讀）', readOnly: true }));
  container.appendChild(row({ id: 'bed-exp-hourly', icon: '🛏️', label: '每小時經驗產量', placeholder: '0' }));

  const infoBox = el('div', ['mt-2','space-y-1','text-xs','text-gray-500']);
  const needNext = el('div'); needNext.id = 'bed-levelup-exp'; needNext.textContent = '升至下一級所需經驗: --';
  const etaNext = el('div'); etaNext.id = 'bed-levelup-time'; etaNext.textContent = '預計升級時間: --';
  const needTarget = el('div'); needTarget.id = 'bed-target-exp'; needTarget.textContent = '升至目標等級所需經驗: --';
  const etaTarget = el('div'); etaTarget.id = 'bed-target-eta'; etaTarget.textContent = '預計到達目標等級時間: --';
  infoBox.append(needNext, etaNext, needTarget, etaTarget);
  container.appendChild(infoBox);
}

/** 主渲染（⚠️ 務必注意這個大括號，上一版少了它） */
export function renderAll(containers) {
  Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });
  if (containers.targetLevels) renderTargetLevels(containers.targetLevels);
  if (containers.relicDistributionInputs) renderRelicDistribution(containers.relicDistributionInputs);
  if (containers.equipInputs) renderEquipInputs(containers.equipInputs);
  if (containers.skillInputs) renderSkillInputs(containers.skillInputs);
  if (containers.charBedInputs) renderCharBed(containers.charBedInputs);
  if (containers.petInputs) renderPetInputs(containers.petInputs);
  if (containers.productionInputs) renderProduction(containers.productionInputs);
  if (containers.ownedMaterials) renderMaterials(containers.ownedMaterials);
} // ←←← 這個就是缺少的大括號

/** 現在時間 */
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

/** 結果輸出（五個橫條） */
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
        <span class="text-slate-700">還缺少: ${
          lack > 0 ? `<strong class="text-red-700">-${fmt(lack)}</strong>` : '<strong class="text-emerald-700">0（充足）</strong>'
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

/** 時間與經驗需求更新 */
export function renderLevelupTimeText(minutesNeeded, levelupTs) {
  const disp = document.getElementById('bed-levelup-time');
  if (!disp) return;
  if (!Number.isFinite(levelupTs)) { disp.textContent = '預計升級時間: --'; return; }
  if (minutesNeeded <= 0) { disp.textContent = '預計升級時間: 可立即升級'; return; }
  const timeStr = new Date(levelupTs).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  disp.textContent = `預計升級時間: ${fmt(minutesNeeded)} 分鐘（約 ${timeStr}）`;
}

export function renderTargetEtaText(minutesNeeded, etaTs) {
  const etaEl = document.getElementById('bed-target-eta');
  if (!etaEl) return;
  if (!Number.isFinite(etaTs)) { etaEl.textContent = '預計到達目標等級時間: --'; return; }
  if (minutesNeeded <= 0) { etaEl.textContent = '預計到達目標等級時間: 可立即達成'; return; }
  const timeStr = new Date(etaTs).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  etaEl.textContent = `預計到達目標等級時間: ${fmt(minutesNeeded)} 分鐘（約 ${timeStr}）`;
}

export function renderLevelupExpText(expNeeded) {
  const disp = document.getElementById('bed-levelup-exp');
  if (!disp) return;
  disp.textContent = Number.isFinite(expNeeded) ? `升至下一級所需經驗: ${fmt(expNeeded)}` : '升至下一級所需經驗: --';
}

export function renderTargetExpText(needExp) {
  const disp = document.getElementById('bed-target-exp');
  if (!disp) return;
  disp.textContent = Number.isFinite(needExp) ? `升至目標等級所需經驗: ${fmt(needExp)}` : '升至目標等級所需經驗: --';
}
