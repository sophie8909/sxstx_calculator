import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeasonOptions, fillSeasonSelect, loadSeasonOptions, seasonOptions } from '../src/services/seasons.js';
import { clearDataServiceMemoryCache } from '../src/services/dataService.js';

test('season catalog accepts future seasons with blank scores, normalizes and sorts IDs', () => {
  const rows = [
    { season: ' S10 ', 國度名稱: 'Future' },
    { season: 's6', 國度名稱: '艾珀希', season_level: '' },
    { season: 's1', 國度名稱: '澤之國' },
    { season: 's6', 國度名稱: 'Duplicate' },
    { season: 'total' }, { season: '' }, { season: 's0' },
  ];
  const options = buildSeasonOptions(rows);
  assert.deepEqual(options.map(option => option.id), ['s1', 's6', 's10']);
  assert.equal(options[1].name, 'S6 艾珀希');
  assert.equal(options[1].season, 6);
  assert.throws(() => buildSeasonOptions([{ season: 'total' }]), /unavailable/);
});

test('shared catalog uses the season score sheet and preserves form submission IDs and selection', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response('season,國度名稱,season_level\ns1,澤之國,100\ns6,艾珀希,', { headers: { 'content-type': 'text/csv' } });
  };
  clearDataServiceMemoryCache();
  try {
    await loadSeasonOptions();
    await loadSeasonOptions();
    assert.equal(urls.length, 1);
    assert.match(urls[0], /gid=1012321192/);
    for (const uppercase of [false, true]) {
      const select = {
        value: uppercase ? 'S6' : 's6',
        ownerDocument: { createElement: () => ({}) },
        replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; },
      };
      fillSeasonSelect(select, { uppercase });
      assert.equal(select.value, uppercase ? 'S6' : 's6');
      assert.equal(select.options[1].textContent, 'S6 艾珀希');
    }
  } finally {
    globalThis.fetch = originalFetch;
    clearDataServiceMemoryCache();
    seasonOptions.splice(0);
  }
});
