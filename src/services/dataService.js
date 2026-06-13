let generatedDataPromise = null;

const GENERATED_DATA_PATH = 'data/generated/upgrade-costs.json';

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
  const allCosts = await loadAllUpgradeCosts();
  const normalizedCategory = String(category || '').trim();
  const normalizedSeason = String(season || '').trim().toLowerCase();
  return allCosts[normalizedCategory]?.[normalizedSeason] || [];
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
