import { loadSheet, SheetDataError } from './dataService.js';
import { getSheetDefinition } from './sheetRegistry.js';

export const seasonOptions = [];

export function buildSeasonOptions(rows) {
  const seasons = new Map();
  for (const row of rows) {
    const id = String(row.season ?? '').trim().toLowerCase();
    if (!/^s[1-9]\d*$/.test(id)) continue;
    const season = Number(id.slice(1));
    const name = String(row['國度名稱'] ?? '').trim();
    if (!seasons.has(id)) {
      seasons.set(id, { id, name: [id.toUpperCase(), name].filter(Boolean).join(' '), readonly: false, season });
    }
  }
  if (!seasons.size) {
    throw new SheetDataError('sheet_empty_seasons', 'Season data is unavailable.', getSheetDefinition('seasonScore'));
  }
  return [...seasons.values()].sort((left, right) => left.season - right.season);
}

export async function loadSeasonOptions() {
  const options = buildSeasonOptions(await loadSheet('seasonScore'));
  seasonOptions.splice(0, seasonOptions.length, ...options);
  return seasonOptions;
}

export function fillSeasonSelect(select, { uppercase = false, selected = select?.value } = {}) {
  if (!select) return;
  const options = seasonOptions.map((season) => {
    const option = select.ownerDocument.createElement('option');
    option.value = uppercase ? season.id.toUpperCase() : season.id;
    option.textContent = season.name;
    return option;
  });
  select.replaceChildren(...options);
  if (options.some((option) => option.value === selected)) select.value = selected;
}
