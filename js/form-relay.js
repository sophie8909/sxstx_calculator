import { initLanguage, applyStaticTranslations, t } from './i18n-inline.js';

const SEASON_START_CATEGORY = '【賽季開始】';
const SEASON_START_DESCRIPTION =
  '此日期將作為計算機自動推算當前賽季副本時間點的基準';

const TIME_PRESETS_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '859085671',
};

const DUNGEON_POWER_SHEET = {
  id: '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E',
  gid: '2044399102',
};
const DUNGEON_CATEGORY = '【副本開啟】';

const FALLBACK_SERVERS = ['台港澳'];
let dungeonNameRowsCache = null;

function getInitialContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    server: normalizeServerName(params.get('server') || ''),
    season: String(params.get('season') || '').toUpperCase(),
  };
}

function normalizeServerName(name) {
  return String(name || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSeasonId(value) {
  const match = String(value || '').match(/\bs\s*(\d+)\b/i);
  return match ? `S${match[1]}` : '';
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function getCsvValue(row, headers, names) {
  for (const name of names) {
    const index = headers.indexOf(normalizeHeader(name));
    if (index >= 0) return String(row[index] || '').trim();
  }
  return '';
}

function getServerGroupMembers(name) {
  return normalizeServerName(name)
    .replace(/[－—–]/g, '-')
    .replace(/\s+-\s+/g, '、')
    .split(/[、,，/／]+/)
    .map((part) => normalizeServerName(part))
    .filter(Boolean);
}

function isSubsetMembers(sourceMembers, targetMembers) {
  if (!sourceMembers.length || !targetMembers.length) return false;
  const targetSet = new Set(targetMembers);
  return sourceMembers.every((member) => targetSet.has(member));
}

function mergeServerOptions(serverNames) {
  const normalized = serverNames
    .map((name) => normalizeServerName(name))
    .filter(Boolean);

  const uniqueNames = Array.from(new Set(normalized));
  return uniqueNames.filter((name, index, list) => {
    const members = getServerGroupMembers(name);
    return !list.some((otherName, otherIndex) => {
      if (index === otherIndex) return false;
      const otherMembers = getServerGroupMembers(otherName);
      return otherMembers.length > members.length && isSubsetMembers(members, otherMembers);
    });
  });
}

async function fetchServerOptionsFromSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${TIME_PRESETS_SHEET.id}/export?format=csv&gid=${TIME_PRESETS_SHEET.gid}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    const text = await response.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((value) => value.trim().toLowerCase());
    const serverIndex = headers.indexOf('server_name');
    if (serverIndex < 0) return FALLBACK_SERVERS.slice();

    const servers = [];
    for (let index = 1; index < lines.length; index += 1) {
      const columns = lines[index].split(',').map((value) => value.trim());
      const server = normalizeServerName(columns[serverIndex] || '');
      if (server) servers.push(server);
    }
    return mergeServerOptions(servers);
  } catch (error) {
    console.warn('[form relay] failed to fetch servers, using fallback', error);
    return FALLBACK_SERVERS.slice();
  }
}

async function fetchDungeonNameRows() {
  if (dungeonNameRowsCache) return dungeonNameRowsCache;

  const url = `https://docs.google.com/spreadsheets/d/${DUNGEON_POWER_SHEET.id}/export?format=csv&gid=${DUNGEON_POWER_SHEET.gid}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    const rows = parseCsvRows(await response.text());
    const headers = (rows.shift() || []).map(normalizeHeader);

    dungeonNameRowsCache = rows
      .map((row) => ({
        season: normalizeSeasonId(getCsvValue(row, headers, ['賽季', 'season'])),
        name: getCsvValue(row, headers, ['副本', 'dungeon']),
      }))
      .filter((row) => row.name);
  } catch (error) {
    console.warn('[form relay] failed to fetch dungeon names', error);
    dungeonNameRowsCache = [];
  }

  return dungeonNameRowsCache;
}

async function fillDungeonOptions() {
  const seasonSelect = document.getElementById('relay-season');
  const dungeonSelect = document.getElementById('relay-dungeon-name');
  if (!seasonSelect || !dungeonSelect) return;

  const selectedSeason = normalizeSeasonId(seasonSelect.value);
  const rows = await fetchDungeonNameRows();
  const names = Array.from(new Set(
    rows
      .filter((row) => !row.season || row.season === selectedSeason)
      .map((row) => row.name)
  ));

  dungeonSelect.innerHTML = '';
  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    dungeonSelect.appendChild(option);
  });
}

function showFeedback(message, type = 'info') {
  const feedback = document.getElementById('relay-feedback');
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = 'mt-4 rounded-lg border px-4 py-3 text-sm';

  if (type === 'success') {
    feedback.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-700');
  } else if (type === 'error') {
    feedback.classList.add('border-red-200', 'bg-red-50', 'text-red-700');
  } else {
    feedback.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700');
  }
}

function getRelayFormState() {
  const serverSelect = document.getElementById('relay-server-name');
  const serverManualInput = document.getElementById('relay-server-name-manual');
  const serverManualWrap = document.getElementById('relay-server-manual-wrap');
  const seasonSelect = document.getElementById('relay-season');
  const categorySelect = document.getElementById('relay-description-category');
  const descriptionInput = document.getElementById('relay-description');
  const dungeonSelect = document.getElementById('relay-dungeon-name');

  return {
    selectedServer: serverSelect?.value || '',
    manualServer: serverManualInput?.value || '',
    isManual: serverManualWrap ? !serverManualWrap.classList.contains('hidden') : false,
    season: seasonSelect?.value || '',
    category: categorySelect?.value || '',
    description: descriptionInput?.value || '',
    dungeonName: dungeonSelect?.value || '',
  };
}

function fillServerOptions(servers) {
  const select = document.getElementById('relay-server-name');
  if (!select) return;

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('relay_server_placeholder');
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  servers.forEach((server) => {
    const option = document.createElement('option');
    option.value = server;
    option.textContent = server;
    select.appendChild(option);
  });
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function applyInitialContext() {
  const { server, season } = getInitialContext();
  const serverSelect = document.getElementById('relay-server-name');
  const serverManualInput = document.getElementById('relay-server-name-manual');
  const serverManualWrap = document.getElementById('relay-server-manual-wrap');
  const serverManualToggle = document.getElementById('relay-server-manual-toggle');
  const seasonSelect = document.getElementById('relay-season');

  if (server && serverSelect) {
    const hasOption = Array.from(serverSelect.options).some((option) => option.value === server);
    if (hasOption) {
      serverSelect.value = server;
      serverSelect.disabled = false;
      if (serverManualInput) serverManualInput.value = '';
      if (serverManualWrap) serverManualWrap.classList.add('hidden');
      if (serverManualToggle) serverManualToggle.textContent = '手動輸入';
    } else {
      serverSelect.value = '';
      serverSelect.disabled = true;
      if (serverManualInput) serverManualInput.value = server;
      if (serverManualWrap) serverManualWrap.classList.remove('hidden');
      if (serverManualToggle) serverManualToggle.textContent = '使用清單';
    }
  }

  if (season && seasonSelect && Array.from(seasonSelect.options).some((option) => option.value === season)) {
    seasonSelect.value = season;
  }
}

function restoreRelayFormState(savedState) {
  if (!savedState) return;

  const serverSelect = document.getElementById('relay-server-name');
  const serverManualInput = document.getElementById('relay-server-name-manual');
  const serverManualWrap = document.getElementById('relay-server-manual-wrap');
  const seasonSelect = document.getElementById('relay-season');
  const categorySelect = document.getElementById('relay-description-category');
  const descriptionInput = document.getElementById('relay-description');
  const dungeonSelect = document.getElementById('relay-dungeon-name');

  if (savedState.isManual) {
    if (serverSelect) serverSelect.value = '';
    if (serverSelect) serverSelect.disabled = true;
    if (serverManualInput) serverManualInput.value = savedState.manualServer;
    if (serverManualWrap) serverManualWrap.classList.remove('hidden');
  } else if (serverSelect && savedState.selectedServer) {
    const hasOption = Array.from(serverSelect.options).some((option) => option.value === savedState.selectedServer);
    if (hasOption) {
      serverSelect.value = savedState.selectedServer;
      serverSelect.disabled = false;
      if (serverManualWrap) serverManualWrap.classList.add('hidden');
    }
  }

  if (seasonSelect && savedState.season) seasonSelect.value = savedState.season;
  if (categorySelect) categorySelect.value = savedState.category || '';
  if (descriptionInput) descriptionInput.value = savedState.description || '';
  fillDungeonOptions().then(() => {
    if (dungeonSelect && savedState.dungeonName) dungeonSelect.value = savedState.dungeonName;
  });
  applyCategoryDescriptionLock();
}

function applyCategoryDescriptionLock() {
  const categorySelect = document.getElementById('relay-description-category');
  const descriptionInput = document.getElementById('relay-description');
  const dungeonSelect = document.getElementById('relay-dungeon-name');
  if (!categorySelect || !descriptionInput) return;

  if (categorySelect.value === SEASON_START_CATEGORY) {
    if (dungeonSelect) dungeonSelect.classList.add('hidden');
    descriptionInput.classList.remove('hidden');
    descriptionInput.value = SEASON_START_DESCRIPTION;
    descriptionInput.disabled = true;
    descriptionInput.setAttribute('aria-readonly', 'true');
    return;
  }

  if (categorySelect.value === DUNGEON_CATEGORY) {
    descriptionInput.classList.add('hidden');
    descriptionInput.disabled = true;
    descriptionInput.required = false;
    if (dungeonSelect) {
      dungeonSelect.classList.remove('hidden');
      dungeonSelect.required = true;
    }
    fillDungeonOptions();
    return;
  }

  if (dungeonSelect) {
    dungeonSelect.classList.add('hidden');
    dungeonSelect.required = false;
  }
  descriptionInput.classList.remove('hidden');
  if (descriptionInput.disabled && descriptionInput.value === SEASON_START_DESCRIPTION) {
    descriptionInput.value = '';
  }
  descriptionInput.disabled = false;
  descriptionInput.required = true;
  descriptionInput.removeAttribute('aria-readonly');
}

function buildSubmittedDescription(category, body) {
  if (category === SEASON_START_CATEGORY) return SEASON_START_CATEGORY;
  if (category === DUNGEON_CATEGORY) {
    const dungeonName = document.getElementById('relay-dungeon-name')?.value || '';
    return dungeonName ? `${DUNGEON_CATEGORY}${dungeonName}` : '';
  }
  return category ? `${category}${body}` : body;
}

function syncManualServerVisibility() {
  const serverSelect = document.getElementById('relay-server-name');
  const serverManualWrap = document.getElementById('relay-server-manual-wrap');
  const serverManualInput = document.getElementById('relay-server-name-manual');
  const serverManualToggle = document.getElementById('relay-server-manual-toggle');
  if (!serverSelect || !serverManualWrap || !serverManualInput || !serverManualToggle) return;

  const isManual = !serverManualWrap.classList.contains('hidden');
  if (isManual) {
    serverManualWrap.classList.add('hidden');
    serverSelect.disabled = false;
    serverManualInput.required = false;
    serverManualInput.value = '';
    serverManualToggle.textContent = t('relay_server_manual_toggle');
    return;
  }

  serverSelect.value = '';
  serverSelect.disabled = true;
  serverManualWrap.classList.remove('hidden');
  serverManualInput.required = true;
  serverManualToggle.textContent = t('relay_server_use_list');
}

function updateManualToggleLabel() {
  const serverManualWrap = document.getElementById('relay-server-manual-wrap');
  const serverManualToggle = document.getElementById('relay-server-manual-toggle');
  if (!serverManualWrap || !serverManualToggle) return;

  serverManualToggle.textContent = serverManualWrap.classList.contains('hidden')
    ? t('relay_server_manual_toggle')
    : t('relay_server_use_list');
}

function applyRelayTranslations() {
  applyStaticTranslations();
  document.title = t('relay_page_title');
  updateManualToggleLabel();
}

function submitRelayForm() {
  const serverSelect = document.getElementById('relay-server-name');
  const serverManualInput = document.getElementById('relay-server-name-manual');
  const selectedServer = serverSelect?.value || '';
  const serverName = normalizeServerName(
    !selectedServer ? serverManualInput?.value : selectedServer
  );
  const season = document.getElementById('relay-season')?.value || '';
  const date = document.getElementById('relay-date')?.value || '';
  const descriptionCategory = document.getElementById('relay-description-category')?.value || '';
  const descriptionBody = document.getElementById('relay-description')?.value.trim() || '';
  const description = buildSubmittedDescription(descriptionCategory, descriptionBody);

  if (!serverName || !season || !date || !description) {
    showFeedback(t('relay_validation_required'), 'error');
    return;
  }

  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    showFeedback(t('relay_validation_date'), 'error');
    return;
  }

  document.getElementById('field-server-name').value = serverName;
  document.getElementById('field-server-name-other').value = '';
  document.getElementById('field-season').value = season;
  document.getElementById('field-description').value = description;
  document.getElementById('field-time-year').value = year;
  document.getElementById('field-time-month').value = String(Number(month));
  document.getElementById('field-time-day').value = String(Number(day));

  if (!selectedServer) {
    document.getElementById('field-server-name').value = '__other_option__';
    document.getElementById('field-server-name-other').value = serverName;
  }

  window.__relaySubmitted = true;
  document.getElementById('google-form-relay').submit();
  showFeedback(t('relay_submit_pending'), 'info');
}

async function init() {
  await initLanguage();
  applyRelayTranslations();

  const dateInput = document.getElementById('relay-date');
  const submitButton = document.getElementById('relay-submit-btn');
  const iframe = document.querySelector('iframe[name="google-form-relay-target"]');

  if (dateInput) {
    dateInput.value = getTodayDateString();
  }

  const servers = await fetchServerOptionsFromSheet();
  fillServerOptions(servers);
  applyInitialContext();
  await fillDungeonOptions();
  applyCategoryDescriptionLock();

  submitButton?.addEventListener('click', submitRelayForm);
  document.getElementById('relay-server-manual-toggle')?.addEventListener('click', syncManualServerVisibility);
  document.getElementById('relay-description-category')?.addEventListener('change', applyCategoryDescriptionLock);
  document.getElementById('relay-season')?.addEventListener('change', () => {
    fillDungeonOptions().then(applyCategoryDescriptionLock);
  });
  document.getElementById('relay-description')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitRelayForm();
    }
  });

  iframe?.addEventListener('load', () => {
    if (!window.__relaySubmitted) return;

    showFeedback(t('relay_submit_success'), 'success');
    document.getElementById('relay-description').value = '';
    applyCategoryDescriptionLock();
    window.__relaySubmitted = false;
  });

  window.addEventListener('languagechange', () => {
    const savedState = getRelayFormState();
    applyRelayTranslations();
    fillServerOptions(window.__relayServers || FALLBACK_SERVERS);
    restoreRelayFormState(savedState);
    if (!savedState.selectedServer && !savedState.manualServer) applyInitialContext();
    updateManualToggleLabel();
    applyCategoryDescriptionLock();
  });

  window.__relayServers = servers;
}

document.addEventListener('DOMContentLoaded', init);
