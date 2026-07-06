import { el, fmt } from '../utils/format.js';
import { getCurrentLanguage, t } from '../i18n-inline.js';
import {
  categories,
  seasonOptions,
  targetLevelConfig,
  materials,
  productionSources,
  getMaterialSourceConfig,
  getAvailableRelicLevels,
  STAMINA_BIG_MINE_RATE,
} from '../model.js';

function getLocale() {
  return getCurrentLanguage() === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
}

function getSeasonLabel(season) {
  return t(`season_name_${season.id}`);
}

function getCategoryLabel(id) {
  return t(`category_${id}`);
}

function getTargetLabel(id) {
  return t(`target_${id}`);
}

function getMaterialLabel(id) {
  return t(`material_${id}`);
}

function getSourceMaterialLabel(id) {
  return t(`source_material_${id}`);
}

function getTooltipText(id, labelText = '') {
  const directMap = {
    'season-select': 'season_tooltip',
    'server-select': 'server_tooltip',
    'target-time-preset': 'target_time_preset_tooltip',
    'target-time-custom': 'target_time_custom_tooltip',
    'notify-time-select': 'notify_tooltip',
    'days-remaining': 'tooltip_days_remaining',
    'next-season-exp-hoard-enabled': 'tooltip_next_season_exp_hoard',
    'free-speedup-used-today': 'tooltip_free_speedup_used',
    'speedup-stone-count': 'tooltip_speedup_stone_count',
  };

  const directKey = directMap[id];
  if (directKey) return t(directKey);
  if (id.startsWith('owned-')) return t('tooltip_owned_material', { label: labelText });
  if (id.startsWith('manual-hourly-')) return t('tooltip_manual_hourly', { label: labelText });
  if (id.startsWith('target-')) return t('tooltip_target_value', { label: labelText });
  if (id.endsWith('-current')) return t('tooltip_current_value', { label: labelText });
  if (id === 'character-current' || id === 'owned-exp-wan' || id === 'owned-exp' || id === 'bed-exp-hourly') {
    return t('tooltip_current_value', { label: labelText });
  }

  return '';
}

function createTooltip(helpText) {
  const tooltip = el('span', ['tooltip']);
  const icon = el('span', ['tooltip-icon']);
  const text = el('span', ['tooltip-text']);

  icon.tabIndex = 0;
  icon.setAttribute('role', 'button');
  icon.setAttribute('aria-label', helpText);
  icon.textContent = 'i';
  text.textContent = helpText;

  tooltip.append(icon, text);
  return tooltip;
}

function appendTooltip(target, helpText) {
  if (!target || !helpText) return;
  target.classList.add('label-with-help');
  target.appendChild(createTooltip(helpText));
}

function formatEstimateText(estimatedRanges = []) {
  if (!Array.isArray(estimatedRanges) || estimatedRanges.length === 0) return '';

  const ranges = Array.from(estimatedRanges)
    .map((range) => {
      if (typeof range === 'string') {
        const [rawFrom, rawTo] = range.split('-').map((value) => Number(value));
        if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) return '';
        return rawFrom === rawTo ? `${rawFrom}等級` : `${rawFrom}~${rawTo}等級`;
      }

      const from = Number(range?.from);
      const to = Number(range?.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
      return from === to ? `${from}等級` : `${from}~${to}等級`;
    })
    .filter(Boolean);

  if (!ranges.length) return '';
  return `（${ranges.join('、')}等級數據為推算）`;
}

function getReadonlyBadgeHtml() {
  return `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">${t('readonly_badge')}</span>`;
}

function getOwnedExpUnitPlaceholder() {
  const selectedSeasonId = document.getElementById('season-select')?.value;
  const selectedSeason = seasonOptions.find((season) => season.id === selectedSeasonId);
  const useLargeUnit = (selectedSeason?.season || 0) >= 4;
  return useLargeUnit ? t('owned_exp_unit_large') : t('owned_exp_unit_small');
}

export function getContainers() {
  return {
    equipInputs: document.getElementById('equip-inputs'),
    skillInputs: document.getElementById('skill-inputs'),
    charBedInputs: document.getElementById('char-bed-inputs'),
    petInputs: document.getElementById('pet-inputs'),
    productionInputs: document.getElementById('production-inputs'),
    materialSource: document.getElementById('material-source-container'),
    ownedMaterials: document.getElementById('owned-materials'),
    results: document.getElementById('results'),
    primordialStarCumulative: document.getElementById('primordial-star-cumulative'),
    targetLevels: document.getElementById('target-levels'),
    relicDistributionInputs: document.getElementById('relic-distribution-inputs'),
    currentTimeDisplay: document.getElementById('current-time-display'),
  };
}

export function createInputGroup(id, labelText, placeholder, isSub = false, extraHtml = '') {
  const wrap = el('div', isSub ? ['mb-4'] : []);
  const label = el('label', ['block', 'text-sm', 'font-bold', 'mb-2']);
  label.htmlFor = id;
  label.textContent = labelText;
  appendTooltip(label, getTooltipText(id, labelText));

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

export function renderPrimordialStarCumulative(container) {
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
  container.innerHTML = '';

  [
    ['primordial-star-accumulated', '目前累計原初', t('quantity_placeholder'), false],
    ['primordial-star-current-season', '當前賽季目標原初', t('readonly_badge'), true],
    ['primordial-star-total', '加入當前賽季後總原初', t('readonly_badge'), true],
  ].forEach(([id, labelText, placeholder, isReadOnly]) => {
    const group = createInputGroup(id, labelText, placeholder, false);
    const label = group.querySelector('label');
    label.classList.add('whitespace-nowrap');
    label.querySelector('.tooltip')?.remove();
    label.classList.remove('label-with-help');

    if (isReadOnly) {
      const input = group.querySelector('input');
      input.disabled = true;
      input.setAttribute('aria-readonly', 'true');
      label.insertAdjacentHTML('beforeend', getReadonlyBadgeHtml());
    }

    container.appendChild(group);
  });
}

export function renderTargetLevels(container) {
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4';
  container.innerHTML = '';

  targetLevelConfig.forEach((target) => {
    const badge =
      target.id === 'character'
        ? `<div id="target-char-reachable-level" class="text-xs text-gray-500 mt-1">${t('reachable_label', { value: '--' })}</div>`
        : '';

    const isReadOnly = target.readonly === true;
    const group = createInputGroup(
      `target-${target.id}`,
      getTargetLabel(target.id),
      isReadOnly ? t('readonly_badge') : t('target_placeholder'),
      false,
      badge
    );
    const label = group.querySelector('label');
    label.classList.add('whitespace-nowrap');

    if (isReadOnly) {
      const input = group.querySelector('input');
      input.disabled = true;
      input.setAttribute('aria-readonly', 'true');
      label.insertAdjacentHTML('beforeend', getReadonlyBadgeHtml());
    }

    container.appendChild(group);
  });
}

export function renderMaterials(container) {
  const order = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];
  container.innerHTML = '';

  order.forEach((id) => {
    const mat = materials[id];
    if (!mat) return;

    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = `owned-${id}`;
    label.textContent = getMaterialLabel(id);
    appendTooltip(label, getTooltipText(`owned-${id}`, getMaterialLabel(id)));

    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.id = `owned-${id}`;
    input.placeholder = t('zero_placeholder');

    row.append(label, input);
    container.appendChild(row);
  });
}

export function renderRelicDistribution(container) {
  container.innerHTML = '';
  const mode = document.getElementById('relic-ui-mode')?.value || 'compact';

  if (mode === 'legacy') {
    container.className = 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 gap-3';
    const relicLevels = getAvailableRelicLevels();
    const levels = relicLevels.length > 0
      ? relicLevels
      : Array.from({ length: 21 }, (_, index) => index + 10);

    levels.forEach((level) => {
      const group = createInputGroup(`relic-level-${level}`, `${t('target_relic_resonance')} ${level}`, t('quantity_placeholder'));
      const label = group.querySelector('label');
      const input = group.querySelector('input');

      label.querySelector('.tooltip')?.remove();
      label.classList.remove('label-with-help');
      label.classList.add('text-center', 'mb-1');
      group.classList.add('min-w-0');
      input.classList.add('w-full', 'text-center', 'relic-dist-input');

      container.appendChild(group);
    });
    return;
  }

  container.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

  [
    ['relic-completed-level', '已完成遺物等級', '等級'],
    ['relic-next-progress', '下一等級進度數量', '0-20'],
  ].forEach(([id, labelText, placeholder]) => {
    const group = createInputGroup(id, labelText, placeholder);
    const label = group.querySelector('label');
    const input = group.querySelector('input');

    label.querySelector('.tooltip')?.remove();
    label.classList.remove('label-with-help');
    group.classList.add('min-w-0');
    input.classList.add('w-full', 'text-center', 'relic-dist-input');
    if (id === 'relic-next-progress') input.max = '20';

    container.appendChild(group);
  });
}

export function renderEquipInputs(container) {
  const frag = document.createDocumentFragment();
  const categoriesEquip = categories.filter((category) => category.id.startsWith('equipment_'));
  const col1 = el('div');
  const col2 = el('div');

  categoriesEquip.forEach((category, index) => {
    const group = createInputGroup(`${category.id}-current`, getCategoryLabel(category.id), t('current_placeholder'), true);
    (index < 2 ? col1 : col2).appendChild(group);
  });

  const wrap = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-x-6', 'gap-y-4']);
  wrap.append(col1, col2);
  frag.appendChild(wrap);
  container.appendChild(frag);
}

export function renderSkillInputs(container) {
  const frag = document.createDocumentFragment();
  const combatCol = el('div');
  const arcaneCol = el('div');

  categories
    .filter((category) => category.id.startsWith('skill_combat'))
    .forEach((category) => combatCol.appendChild(createInputGroup(`${category.id}-current`, getCategoryLabel(category.id), t('current_placeholder'), true)));

  categories
    .filter((category) => category.id.startsWith('skill_arcane'))
    .forEach((category) => arcaneCol.appendChild(createInputGroup(`${category.id}-current`, getCategoryLabel(category.id), t('current_placeholder'), true)));

  const wrap = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-x-6', 'gap-y-4']);
  wrap.append(combatCol, arcaneCol);
  frag.appendChild(wrap);
  container.appendChild(frag);
}

export function renderPetInputs(container) {
  const frag = document.createDocumentFragment();
  const petRow = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-4']);

  categories
    .filter((category) => category.id.startsWith('pet'))
    .forEach((category) => petRow.appendChild(createInputGroup(`${category.id}-current`, getCategoryLabel(category.id), t('current_placeholder'))));

  frag.appendChild(petRow);
  container.appendChild(frag);
}

export function renderProduction(container) {
  const order = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];
  container.innerHTML = '';

  order.forEach((key) => {
    const source = productionSources[key];
    if (!source) return;

    const matId = source.materialId;
    const labelText = getMaterialLabel(matId);
    const row = el('div', ['flex', 'items-center']);
    const label = el('label', ['w-full', 'block', 'text-sm', 'font-bold']);
    label.htmlFor = `manual-hourly-${key}`;
    label.textContent = labelText;
    appendTooltip(label, getTooltipText(`manual-hourly-${key}`, labelText));

    const input = el('input', ['input-field', 'rounded', 'w-full', 'p-2']);
    input.type = 'number';
    input.id = `manual-hourly-${key}`;
    input.placeholder = t('zero_placeholder');
    input.min = '0';
    input.step = '1';

    row.append(label, input);
    container.appendChild(row);
  });
}

export function renderCharBed(container) {
  container.innerHTML = '';
  const inputHeight = 'h-9';

  const row = ({ id, type = 'number', label, placeholder = '', readOnly = false, min, step }) => {
    const wrap = el('div', ['w-full']);
    const line = el('div', ['flex', 'flex-col', 'md:flex-row', 'md:items-center', 'md:justify-between', 'gap-2']);
    const left = el('div', ['flex', 'items-center', 'gap-2', 'min-w-0']);
    const text = el('span', ['text-sm', 'font-semibold']);
    text.textContent = label;
    left.appendChild(text);
    appendTooltip(text, getTooltipText(id, label));

    const right = el('div', ['flex', 'items-center', 'justify-end', 'w-full', 'md:w-1/2']);
    const input = el('input', ['input-field', 'rounded', 'p-2', inputHeight, 'w-full']);
    input.id = id;
    input.placeholder = placeholder;

    if (readOnly) {
      input.type = 'text';
      input.readOnly = true;
      input.classList.add('bg-slate-50', 'border', 'border-slate-200', 'text-gray-700', 'cursor-default');
      input.style.appearance = 'none';
    } else {
      input.type = type;
      if (min !== undefined) input.min = String(min);
      if (step !== undefined) input.step = String(step);
    }

    right.appendChild(input);
    line.append(left, right);
    wrap.appendChild(line);
    return wrap;
  };

  const levelRow = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-3']);
  levelRow.append(
    row({ id: 'character-current', label: t('role_level'), placeholder: t('current_placeholder'), min: 0, step: 1 }),
    row({ id: 'owned-exp-wan', label: t('owned_exp_wan'), placeholder: getOwnedExpUnitPlaceholder(), min: 0, step: 0.01 })
  );
  container.appendChild(levelRow);

  const expRow = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-3']);
  expRow.append(
    row({ id: 'owned-exp', label: t('actual_exp'), placeholder: t('auto_convert_readonly'), readOnly: true }),
    row({ id: 'bed-exp-hourly', label: t('exp_hourly'), placeholder: t('zero_placeholder'), min: 0, step: 1 })
  );
  container.appendChild(expRow);

  const hoardRow = el('label', ['flex', 'items-center', 'justify-between', 'gap-3', 'rounded-lg', 'border', 'border-red-200', 'bg-red-50', 'px-3', 'py-2', 'text-sm', 'text-red-800']);
  hoardRow.htmlFor = 'next-season-exp-hoard-enabled';
  const hoardText = el('span', ['font-semibold']);
  hoardText.textContent = t('next_season_exp_hoard');
  appendTooltip(hoardText, getTooltipText('next-season-exp-hoard-enabled', t('next_season_exp_hoard')));
  const hoardCheckbox = el('input');
  hoardCheckbox.type = 'checkbox';
  hoardCheckbox.id = 'next-season-exp-hoard-enabled';
  hoardCheckbox.classList.add('h-4', 'w-4');
  hoardRow.append(hoardText, hoardCheckbox);

  const speedupBox = el('div', ['rounded-lg', 'border', 'border-slate-200', 'bg-slate-50', 'p-3', 'space-y-3']);
  const speedupTitle = el('div', ['text-sm', 'font-semibold', 'text-slate-700']);
  speedupTitle.textContent = t('speedup_settings');
  appendTooltip(speedupTitle, t('speedup_settings_tooltip'));

  const freeRow = el('label', ['flex', 'items-center', 'justify-between', 'gap-3', 'text-sm', 'text-slate-700']);
  freeRow.htmlFor = 'free-speedup-used-today';
  const freeText = el('span');
  freeText.textContent = t('free_speedup_used');
  appendTooltip(freeText, getTooltipText('free-speedup-used-today', t('free_speedup_used')));
  const freeCheckbox = el('input');
  freeCheckbox.type = 'checkbox';
  freeCheckbox.id = 'free-speedup-used-today';
  freeCheckbox.classList.add('h-4', 'w-4');
  freeRow.append(freeText, freeCheckbox);

  const stoneRow = el('div', ['flex', 'items-center', 'justify-between', 'gap-3']);
  const stoneLabel = el('label', ['text-sm', 'font-semibold', 'text-slate-700']);
  stoneLabel.htmlFor = 'speedup-stone-count';
  stoneLabel.textContent = t('speedup_stone_count');
  appendTooltip(stoneLabel, getTooltipText('speedup-stone-count', t('speedup_stone_count')));
  const stoneInput = el('input', ['input-field', 'rounded', 'p-2', inputHeight, 'w-full', 'md:w-1/2', 'text-right']);
  stoneInput.type = 'number';
  stoneInput.id = 'speedup-stone-count';
  stoneInput.min = '0';
  stoneInput.step = '1';
  stoneInput.placeholder = t('zero_placeholder');
  stoneRow.append(stoneLabel, stoneInput);

  speedupBox.append(speedupTitle, freeRow, stoneRow);

  const checkboxRow = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-3']);
  checkboxRow.append(hoardRow, speedupBox);
  container.appendChild(checkboxRow);

  const infoBox = el('div', ['grid', 'grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3', 'gap-x-4', 'gap-y-1', 'text-xs', 'text-gray-500']);
  const needNext = el('div');
  needNext.id = 'bed-levelup-exp';
  needNext.textContent = t('next_level_exp_empty');
  const etaNext = el('div');
  etaNext.id = 'bed-levelup-time';
  etaNext.textContent = t('levelup_eta_empty');
  const boostNext = el('div');
  boostNext.id = 'bed-levelup-speedup';
  boostNext.textContent = t('speedup_next_level', { hours: 0 });
  const needTarget = el('div');
  needTarget.id = 'bed-target-exp';
  needTarget.textContent = t('target_level_exp_empty');
  const etaTarget = el('div');
  etaTarget.id = 'bed-target-eta';
  etaTarget.textContent = t('target_eta_empty');
  const boostTarget = el('div');
  boostTarget.id = 'bed-target-speedup';
  boostTarget.textContent = t('speedup_target_time', { hours: 0 });

  infoBox.append(needNext, etaNext, boostNext, needTarget, etaTarget, boostTarget);
  container.appendChild(infoBox);
}

export function renderMaterialSource(containers) {
  const cfg = getMaterialSourceConfig();
  const { dailyDefaults, avgDefaults, rolaCostDefaults, sourceMaterials } = cfg;
  const wrapper = containers.materialSource;
  if (!wrapper) return;

  const dungeonHtml = renderMaterialSourceTable('dungeon', t('dungeon_source_title'), sourceMaterials.dungeon, dailyDefaults, avgDefaults, rolaCostDefaults, { showAvg: true });
  const exploreHtml = renderMaterialSourceTable('explore', t('explore_source_title'), sourceMaterials.explore, dailyDefaults, avgDefaults, rolaCostDefaults, { showAvg: true });
  const storeHtml = renderMaterialSourceTable('store', t('store_source_title'), sourceMaterials.store, dailyDefaults, avgDefaults, rolaCostDefaults, { showAvg: false });

  wrapper.innerHTML = `
    <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
      <h3 class="text-lg font-bold text-emerald-700">${t('material_source_title')}</h3>
      <div class="flex flex-col md:flex-row md:items-center gap-2 text-sm w-full md:w-auto">
        <span class="font-semibold">${t('days_remaining_label')}</span>
        <input
          id="days-remaining"
          type="number"
          class="input-field rounded px-2 py-1 text-right bg-gray-50 w-full md:w-auto"
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

  const daysLabel = wrapper.querySelector('span.font-semibold');
  appendTooltip(daysLabel, getTooltipText('days-remaining'));

}

function renderMaterialSourceTable(source, title, materialList, dailyDefaults, avgDefaults, rolaCostDefaults, options) {
  const showAvg = options.showAvg;
  const isStore = source === 'store';
  const dailyBySource = dailyDefaults[source] || {};
  const avgBySource = avgDefaults[source] || {};
  const rolaCostBySource = rolaCostDefaults[source] || {};

  const headerCols = showAvg
    ? `<th>${t('material_header')}</th><th>${t('daily_runs_header')}</th><th>${t('avg_gain_header')}</th><th>${t('total_gain_header')}</th>`
    : isStore
      ? `<th>${t('material_header')}</th><th>${t('daily_purchase_header')}</th><th>${t('store_resource_price_header')}</th><th>${t('avg_gain_header')}</th><th>${t('total_gain_header')}</th>`
      : `<th>${t('material_header')}</th><th>${t('daily_purchase_header')}</th><th>${t('rola_cost_header')}</th><th>${t('total_gain_header')}</th>`;

  const storeSummary =
    isStore
      ? `
        <div class="mt-3 p-2 bg-gray-50 rounded border text-sm space-y-1">
          <div class="text-right">${t('daily_store_price_total')} <span id="store-price-daily-total">0</span></div>
          <div class="text-right">${t('total_store_price')} <span id="store-price-period-total">0</span></div>
        </div>
      `
      : '';
  const exploreSummary =
    source === 'explore'
      ? `
        <label class="material-source-toggle mt-3 p-2 bg-gray-50 rounded border text-sm">
          <input
            id="explore-big-mine-enabled"
            type="checkbox"
            class="material-source-input"
            data-source="explore"
            data-material="bigMine"
            data-role="enabled"
          />
          <span>${t('include_big_mine_gain')}</span>
        </label>
        <div class="mt-2 text-xs text-slate-600">${t('explore_big_mine_rule', {
          bonus: (STAMINA_BIG_MINE_RATE * 100).toFixed(2),
        })}</div>
      `
      : '';

  const rows = materialList
    .map((mat) => {
      const label = getSourceMaterialLabel(mat);
      const daily = dailyBySource[mat] ?? 0;
      const avg = avgBySource[mat] ?? 0;
      const rolaCost = rolaCostBySource[mat] ?? 0;

      if (showAvg) {
        const inputIdPrefix = `material-source-${source}-${mat}`;
        return `
          <tr class="border-b">
            <td class="py-1 text-center">${label}</td>
            <td class="py-1 text-center">
              <input type="number"
                id="${inputIdPrefix}-daily"
                class="input-field rounded px-1 py-0.5 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="daily"
                value="${daily}" />
            </td>
            <td class="py-1 text-center">
              <input type="number"
                id="${inputIdPrefix}-avg"
                class="input-field rounded px-1 py-0.5 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="avg"
                value="${avg}" />
            </td>
            <td class="py-1 text-right">
              <span class="material-source-total" data-source="${source}" data-material="${mat}">0</span>
            </td>
          </tr>
        `;
      }

      if (isStore) {
        const inputIdPrefix = `material-source-${source}-${mat}`;
        return `
          <tr class="border-b">
            <td class="py-1 text-center">${label}</td>
            <td class="py-1 text-center">
              <input type="number"
                id="${inputIdPrefix}-slots"
                class="input-field rounded px-1 py-0.5 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="daily"
                value="${daily}" />
            </td>
            <td class="py-1 text-center">
              <input type="number"
                id="${inputIdPrefix}-shop-price"
                class="input-field rounded px-1 py-0.5 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="shop-price"
                value="${rolaCost}" />
            </td>
            <td class="py-1 text-center">
              <input type="number"
                id="${inputIdPrefix}-avg"
                class="input-field rounded px-1 py-0.5 text-right material-source-input"
                data-source="${source}" data-material="${mat}" data-role="avg"
                value="${avg}" />
            </td>
            <td class="py-1 text-right">
              <span class="material-source-total" data-source="${source}" data-material="${mat}">0</span>
            </td>
          </tr>
        `;
      }

      return `
        <tr class="border-b">
          <td class="py-1 text-center">${label}</td>
          <td class="py-1 text-center">
            <input type="number"
              class="input-field rounded px-1 py-0.5 text-right material-source-input"
              data-source="${source}" data-material="${mat}" data-role="avg"
              value="${avg}" />
          </td>
          <td class="py-1 text-center">
            <input type="number"
              class="input-field rounded px-1 py-0.5 text-right material-source-input"
              data-source="${source}" data-material="${mat}" data-role="rola-cost"
              value="${rolaCost}" />
          </td>
          <td class="py-1 text-right">
            <span class="material-source-total" data-source="${source}" data-material="${mat}">0</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="material-source-section">
      <h4 class="font-semibold mb-2 text-center">${title}</h4>
      <div class="overflow-x-auto responsive-table">
        <table class="material-source-table w-full ${isStore ? 'material-source-table-wide' : ''} text-sm border-collapse">
          <thead>
            <tr class="border-b">
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      ${exploreSummary}
      ${storeSummary}
    </section>
  `;
}

export function renderAll(containers) {
  Object.values(containers).forEach((container) => {
    if (container) container.innerHTML = '';
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

export function updateCurrentTime(container) {
  if (!container) return;

  const text = new Date().toLocaleString(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  if ('value' in container) container.value = text;
  if ('textContent' in container) container.textContent = text;
}

export function updateRelicTotal() {
  if (document.getElementById('relic-ui-mode')?.value === 'legacy') {
    let legacyTotal = 0;
    document.querySelectorAll('[id^="relic-level-"]').forEach((input) => {
      legacyTotal += parseInt(input.value, 10) || 0;
    });

    const display = document.getElementById('relic-total-display');
    if (!display) return;

    display.textContent = `(${legacyTotal}/20)`;
    if (legacyTotal !== 20 && legacyTotal > 0) {
      display.classList.add('text-warning');
      display.classList.remove('text-gray-400');
    } else {
      display.classList.remove('text-warning');
      display.classList.add('text-gray-400');
    }
    return;
  }

  const progressInput = document.getElementById('relic-next-progress');
  const progress = Math.max(0, Math.min(20, parseInt(progressInput?.value, 10) || 0));
  if (progressInput && progressInput.value !== '') progressInput.value = String(progress);
  const completed = parseInt(document.getElementById('relic-completed-level')?.value, 10) || 0;
  const total = completed > 0 || progress > 0 ? 20 : 0;

  const display = document.getElementById('relic-total-display');
  if (!display) return;

  display.textContent = `(${total}/20)`;
  if (total !== 20 && total > 0) {
    display.classList.add('text-warning');
    display.classList.remove('text-gray-400');
  } else {
    display.classList.remove('text-warning');
    display.classList.add('text-gray-400');
  }
}

export function renderResults(containers, payload, missingFiles = [], options = {}) {
  const root = containers.results;
  root.innerHTML = '';

  if (options.cacheFallback) {
    root.insertAdjacentHTML(
      'afterbegin',
      `<div class="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-300 p-3 rounded-lg mb-3 text-sm">
        <p>目前使用上次暫存資料</p>
       </div>`
    );
  }

  if (missingFiles.length > 0) {
    root.insertAdjacentHTML(
      'afterbegin',
      `<div class="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-300 p-3 rounded-lg mb-3 text-sm">
        <h4 class="font-bold">${t('results_missing_files_title')}</h4>
        <p>${t('summary_missing_data', { files: missingFiles.join(', ') })}</p>
       </div>`
    );
  }

  if (payload?.error) {
    root.innerHTML += `<p class="text-warning text-center py-3">${payload.error}</p>`;
    return;
  }

  const { required = {}, gains = {}, deficit = {}, materialErrors = {}, estimated = {} } = payload;
  const displayOrder = ['rola', 'stoneOre', 'essence', 'sand', 'freezeDried'];
  const list = el('div', ['flex', 'flex-col', 'gap-3', 'w-full']);

  displayOrder.forEach((matId) => {
    const need = required[matId] || 0;
    const lack = deficit[matId] || 0;
    const gain = gains[matId] || 0;
    const hasError = !!materialErrors[matId];
    const estimateHint = formatEstimateText(Array.from(estimated[matId] || []));

    let classes = 'border rounded-lg w-full px-4 py-3';
    if (hasError) classes += ' bg-red-100 border-red-300';
    else if (need === 0) classes += ' bg-green-100 border-green-300';
    else if (lack === 0 && gain > 0) classes += ' bg-blue-100 border-blue-300';
    else if (lack === 0) classes += ' bg-green-100 border-green-300';
    else classes += ' bg-orange-100 border-orange-300';

    const row = el('div', classes.split(' '));
    row.classList.add('result-summary-row');
    const left = el('div', ['flex', 'items-center', 'gap-2', 'min-w-0']);
    left.innerHTML = `<span class="font-bold text-slate-700">${getMaterialLabel(matId)}</span>`;

    const right = el('div', ['ml-auto', 'flex', 'items-center', 'gap-x-6', 'gap-y-1', 'text-sm', 'result-summary-values']);
    if (hasError) {
      right.innerHTML = `<span class="text-red-700 font-semibold">${materialErrors[matId]}</span>`;
    } else {
      right.innerHTML = `
        <span class="text-slate-700">${t('summary_need')} <strong>${fmt(need)}</strong></span>
        <span class="text-slate-700">${t('summary_gain')} <strong>${fmt(gain)}</strong></span>
        <span class="text-slate-700">${t('summary_deficit')} ${
          lack > 0
            ? `<strong class="text-red-700">-${fmt(lack)}</strong>`
            : `<strong class="text-emerald-700">${t('summary_done')}</strong>`
        }</span>
        ${estimateHint ? `<span class="text-amber-700 text-xs">${estimateHint}</span>` : ''}`;
    }

    row.append(left, right);
    list.appendChild(row);
  });

  if (!Object.keys(required).length && !Object.keys(deficit).length && !Object.keys(materialErrors).length) {
    root.innerHTML += `<p class="text-gray-500 text-center py-6">${t('summary_no_input')}</p>`;
  } else {
    root.appendChild(list);
  }
}

export function renderLevelupTimeText(minutesNeeded, levelupTs) {
  const display = document.getElementById('bed-levelup-time');
  if (!display) return;

  if (!Number.isFinite(levelupTs)) {
    display.textContent = t('levelup_eta_empty');
    return;
  }

  if (minutesNeeded <= 0) {
    display.textContent = t('levelup_eta_ready');
    return;
  }

  const timeText = new Date(levelupTs).toLocaleString(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  display.textContent = t('levelup_eta_value', { minutes: fmt(minutesNeeded), time: timeText });
}

export function renderTargetEtaText(minutesNeeded, etaTs) {
  const display = document.getElementById('bed-target-eta');
  if (!display) return;

  if (!Number.isFinite(etaTs)) {
    display.textContent = t('target_eta_empty');
    return;
  }

  if (minutesNeeded <= 0) {
    display.textContent = t('target_eta_ready');
    return;
  }

  const timeText = new Date(etaTs).toLocaleString(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  display.textContent = t('target_eta_value', { minutes: fmt(minutesNeeded), time: timeText });
}

export function renderLevelupExpText(expNeeded) {
  const display = document.getElementById('bed-levelup-exp');
  if (!display) return;
  display.textContent = Number.isFinite(expNeeded) ? t('next_level_exp', { value: fmt(expNeeded) }) : t('next_level_exp_empty');
}

export function renderTargetExpText(needExp) {
  const display = document.getElementById('bed-target-exp');
  if (!display) return;
  display.textContent = Number.isFinite(needExp) ? t('target_level_exp', { value: fmt(needExp) }) : t('target_level_exp_empty');
}
