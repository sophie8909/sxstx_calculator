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

/** 左欄：目前等級 */
export function renderLevelInputs(container) {
  const frag = document.createDocumentFragment();

  // 角色
  const roleTitle = el('h3', ['text-lg', 'font-semibold', 'text-accent', 'pb-2', 'mb-3']);
  roleTitle.textContent = '角色等級';
  frag.appendChild(roleTitle);
  const roleRow = el('div', ['grid', 'grid-cols-1', 'gap-4', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
  const charCat = categories.find(c => c.id === 'character');
  if (charCat) roleRow.appendChild(createInputGroup(`${charCat.id}-current`, charCat.name, '目前'));
  frag.appendChild(roleRow);

  // 幻獸
  const petTitle = el('h3', ['text-lg', 'font-semibold', 'text-accent', 'pb-2', 'mb-3']);
  petTitle.textContent = '幻獸等級';
  frag.appendChild(petTitle);
  const petRow = el('div', ['grid', 'grid-cols-2', 'sm:grid-cols-4', 'gap-4', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
  categories.filter(c => c.id.startsWith('pet')).forEach(cat => {
    petRow.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前'));
  });
  frag.appendChild(petRow);

  // 裝備
  const equipTitle = el('h3', ['text-lg', 'font-semibold', 'text-accent', 'pb-2', 'mb-3']);
  equipTitle.textContent = '裝備等級';
  frag.appendChild(equipTitle);
  const equipWrap = el('div', ['grid', 'grid-cols-2', 'gap-x-6', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
  const col1 = el('div'), col2 = el('div');
  categories.filter(c => c.group === '裝備等級').forEach((cat, i) => {
    (i < 2 ? col1 : col2).appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true));
  });
  equipWrap.append(col1, col2);
  frag.appendChild(equipWrap);

  // 技能
  const skillTitle = el('h3', ['text-lg', 'font-semibold', 'text-accent', 'pb-2', 'mb-3']);
  skillTitle.textContent = '技能等級';
  frag.appendChild(skillTitle);
  const skillWrap = el('div', ['grid', 'grid-cols-2', 'gap-x-6', 'mb-4', 'border-b', 'border-[#e5eff1]', 'pb-6']);
  const s1 = el('div'), s2 = el('div');
  categories.filter(c => c.id.startsWith('skill_combat'))
    .forEach(cat => s1.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
  categories.filter(c => c.id.startsWith('skill_arcane'))
    .forEach(cat => s2.appendChild(createInputGroup(`${cat.id}-current`, cat.name, '目前', true)));
  skillWrap.append(s1, s2);
  frag.appendChild(skillWrap);

  container.appendChild(frag);
}

/** 目標等級（六欄） */
export function renderTargetLevels(container) {
  container.innerHTML = '';
  targetLevelConfig.forEach(t => {
    const badge = (t.id === 'character')
      ? `<div id="target-char-reachable-level" class="text-xs text-gray-500 mt-1">最低可達: --</div>` : '';
    const isReadOnly = t.readonly === true;
    const group = createInputGroup(`target-${t.id}`, t.name, isReadOnly ? '自動計算' : '目標', false, badge);

    if (isReadOnly) {
      const input = group.querySelector('input');
      input.setAttribute('disabled', 'disabled');
      input.setAttribute('aria-readonly', 'true');
      const label = group.querySelector('label');
      label.insertAdjacentHTML('beforeend',
        `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">自動</span>`
      );
    }
    container.appendChild(group);
  });
}

/** 遺物分佈 */
export function renderRelicDistribution(container) {
  for (let i = 10; i <= 20; i++) {
    const g = createInputGroup(`relic-level-${i}`, `等級 ${i}`, '數量');
    g.querySelector('input').classList.add('relic-dist-input');
    container.appendChild(g);
  }
}

/** 右欄：素材 */
export function renderMaterials(container) {
  Object.entries(materials).forEach(([id, mat]) => {
    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = `owned-${id}`;
    label.textContent = `${mat.icon} ${mat.name}`;
    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number'; input.id = `owned-${id}`; input.placeholder = '0';
    row.append(label, input);
    container.appendChild(row);
  });
}

/** 中欄：小推車 */
export function renderProduction(container) {
  Object.entries(productionSources).forEach(([srcId, src]) => {
    const wrap = el('div');
    const title = el('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
    const matName = src.materialId;
    title.textContent = `${materials[matName].icon} ${materials[matName].name}`;
    wrap.appendChild(title);

    const hourlyDiv = el('div');
    const small = el('label', ['text-xs', 'text-gray-500']); small.textContent = '時產量';
    const group = createInputGroup(`manual-hourly-${srcId}`, '', '手動輸入');
    group.querySelector('input').classList.add('text-sm');
    hourlyDiv.append(small, group);
    wrap.appendChild(hourlyDiv);
    container.appendChild(wrap);
  });
}

/** 一次性渲染所有靜態區塊 */
export function renderAll(containers) {
  // 清空容器
  Object.values(containers).forEach(c => c && (c.innerHTML = ''));
  renderLevelInputs(containers.levelInputs);
  renderTargetLevels(containers.targetLevels);
  renderRelicDistribution(containers.relicDistributionInputs);
  renderMaterials(containers.ownedMaterials);
  renderProduction(containers.productionInputs);
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

/** 結果輸出卡片 */
export function renderResults(containers, payload, missingFiles = []) {
  const root = containers.results;
  root.innerHTML = '';

  // 缺檔提示
  if (missingFiles.length > 0) {
    root.insertAdjacentHTML('afterbegin',
      `<div class="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-300 p-3 rounded-lg mb-4 text-sm">
        <h4 class="font-bold">注意</h4>
        <p>無法載入以下數據檔案，已使用模擬數據：<br>${missingFiles.join(', ')}</p>
       </div>`);
  }

  if (payload?.error) {
    root.innerHTML += `<p class="text-warning text-center py-4">${payload.error}</p>`;
    return;
  }

  const { required = {}, gains = {}, deficit = {}, materialErrors = {} } = payload;
  const displayOrder = ['rola', 'essence', 'sand', 'stoneOre', 'freezeDried'];

  const grid = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4']);
  displayOrder.forEach(matId => {
    const mat = materials[matId];
    const card = el('div', ['p-4', 'rounded-lg', 'result-item']);
    let inner = `
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-gold flex items-center">
          <span class="text-2xl mr-2">${mat.icon}</span><span>${mat.name}</span>
        </h4>
      </div>`;

    if (materialErrors[matId]) {
      inner += `<div class="text-warning text-sm font-semibold">${materialErrors[matId]}</div>`;
    } else {
      const need = required[matId] || 0;
      const lack = deficit[matId] || 0;
      const lackNode = lack > 0 ? `<strong class="text-warning">-${fmt(lack)}</strong>` : '<span class="text-green-400">充足</span>';
      inner += `
        <div class="space-y-1 text-sm">
          <div class="flex justify-between"><span>總共需要:</span> <strong>${fmt(need)}</strong></div>
          <div class="flex justify-between"><span>還缺少:</span> ${lackNode}</div>
        </div>`;
    }
    card.innerHTML = inner;
    grid.appendChild(card);
  });

  if (!Object.keys(required).length && !Object.keys(deficit).length && !Object.keys(materialErrors).length) {
    root.innerHTML += '<p class="text-gray-500 text-center py-8">請輸入資料以自動計算。</p>';
  } else {
    root.appendChild(grid);
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
