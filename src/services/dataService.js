let generatedDataPromise = null;

const GENERATED_DATA_PATH = 'data/generated/upgrade-costs.json';
const GOOGLE_SHEET_ID = '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E';
const UPGRADE_COST_SHEETS = {
  character: 314585849,
  equipment: 1205841685,
  skill: 682954597,
  relic: 1548103854,
  pet: 1910677696,
};
const sheetRowsCache = new Map();

export function getGoogleSheetCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${gid}`;
}

function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
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

function parseNumberCell(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return 0;

  const normalized = raw.replace(/,/g, '');
  if (!/^[+-]?(?:\d+|\d*\.\d+)$/.test(normalized)) return raw;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : raw;
}

function rowsToObjects(rows) {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('level') && headers.includes('season') && headers.some((header) => header.startsWith('cost_'));
  });
  const headers = (rows[headerIndex >= 0 ? headerIndex : 0] || []).map(normalizeHeader);
  const dataRows = rows.filter((_, index) => index !== (headerIndex >= 0 ? headerIndex : 0));

  return dataRows.map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = parseNumberCell(row[index]);
    });
    return object;
  });
}

async function fetchSheetRows(gid) {
  if (!sheetRowsCache.has(gid)) {
    const response = await fetch(getGoogleSheetCsvUrl(gid), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load Google Sheet CSV: ${response.status}`);
    }
    sheetRowsCache.set(gid, rowsToObjects(parseCsvRows(await response.text())));
  }
  return sheetRowsCache.get(gid);
}

function getGeneratedDataUrl() {
  const viteBase = import.meta.env?.BASE_URL;
  if (viteBase) {
    return `${viteBase.replace(/\/$/, '')}/${GENERATED_DATA_PATH}`;
  }
  const moduleUrl = import.meta.url.split(/[?#]/)[0];
  const sourcePath = '/src/services/dataService.js';
  if (moduleUrl.endsWith(sourcePath)) {
    return `${moduleUrl.slice(0, -sourcePath.length)}/${GENERATED_DATA_PATH}`;
  }
  return GENERATED_DATA_PATH;
}

async function loadGeneratedData() {
  if (!generatedDataPromise) {
    generatedDataPromise = fetch(getGeneratedDataUrl()).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load generated data: ${response.status}`);
      }
      return response.json();
    });
  }
  return generatedDataPromise;
}

export async function loadAllUpgradeCosts() {
  const data = await loadGeneratedData();
  return data.upgradeCosts || {};
}

export async function loadUpgradeCosts(category, season) {
  const normalizedCategory = String(category || '').trim();
  const normalizedSeason = String(season || '').trim().toLowerCase();
  const gid = UPGRADE_COST_SHEETS[normalizedCategory];

  if (!gid) {
    const allCosts = await loadAllUpgradeCosts();
    return allCosts[normalizedCategory]?.[normalizedSeason] || [];
  }

  const rows = await fetchSheetRows(gid);
  return rows
    .filter((row) => String(row.season || '').trim().toLowerCase() === normalizedSeason)
    .map((row) => ({
      ...row,
      category: normalizedCategory,
    }));
}

export async function loadUpgradeCostTablesForSeason(season) {
  const [character, equipment, skill, relic, pet] = await Promise.all([
    loadUpgradeCosts('character', season),
    loadUpgradeCosts('equipment', season),
    loadUpgradeCosts('skill', season),
    loadUpgradeCosts('relic', season),
    loadUpgradeCosts('pet', season),
  ]);

  return {
    characterUpgradeCosts: character,
    equipmentUpgradeCosts: equipment,
    skillUpgradeCosts: skill,
    relicUpgradeCosts: relic,
    petUpgradeCosts: pet,
  };
}

export async function loadServers() {
  const data = await loadGeneratedData();
  return data.tables?.servers?.rows || [];
}
