import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const adapter = await readFile(new URL('../src/features/progression/legacyAdapter.js', import.meta.url), 'utf8');
const persistence = adapter.slice(adapter.indexOf('export function saveAllInputs()')).replaceAll('export function', 'function');
const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
const initializer = controller.slice(controller.indexOf('let activeFeatureGeneration ='), controller.indexOf('async function handleSeasonChange'));
const recalculate = controller.slice(controller.indexOf('function triggerRecalculate('), controller.indexOf('function clearControllerRemoteRowsCaches'));

function fixture(saved, tool = 'primordial') {
  let storage = JSON.stringify(saved);
  const fields = new Map();
  const field = (id, value = '', type = 'number') => {
    const input = { id, value, type, checked: false, tagName: 'INPUT' };
    fields.set(id, input);
    return input;
  };
  const context = vm.createContext({
    STORAGE_KEY: 'calculator',
    localStorage: { getItem: () => storage, setItem: (_, value) => { storage = value; } },
    document: { getElementById: (id) => fields.get(id), querySelectorAll: () => [...fields.values()] },
    globalStore: { getState: () => ({ activeTool: tool }) },
    state: { seasonId: 's2', missingFiles: [] },
    isAppLoading: false,
    hasCompletedInitialLoad: false,
    setFeatureLoading() {}, setGlobalDataStatus() {}, t: (key) => key,
    loadDataForSeason: async () => {}, preprocessCostData() {}, bindTooltipLayers() {},
    renderAll: () => field('character-level'),
    initEquipmentSeasonScore: async () => {}, renderPrimordialRecommendations: async () => {},
    loadMaterialAvgDefaults: async () => {},
    renderMaterialSource: () => field('material-source-store-stone-daily', '0'),
    syncSavedCompactCurrentLevels() {}, restoreDungeonAutoTargetLevel() {}, updateRelicTotal() {},
    updateDaysRemainingFromTarget() {}, updateAllMaterialSources() {},
    initFragmentCalculator: async () => {}, initDungeonFragmentYield: async () => {},
    updateFragmentFeeRates() {}, updateFragmentCalculator() {},
    refreshBedProgressSummary() {}, computeAll: () => ({}), renderResults() {},
    renderFeatureUnavailable: (_tool, error) => { throw error; }, console,
  });
  vm.runInContext(persistence + '\n' + recalculate + '\n' + initializer, context);
  return { context, fields, field, saved: () => JSON.parse(storage) };
}

test('bootstrap calculations cannot overwrite saved inputs before restoration', () => {
  const f = fixture({ 'character-level': '120' });
  f.field('character-level');
  f.context.isAppLoading = true;
  f.context.triggerRecalculate({});
  assert.equal(f.saved()['character-level'], '120');
});

test('saving preserves unmounted fields and uninitialized selects without retaining snapshot language', () => {
  const f = fixture({ 'gift-owned-0': '27', 'equipment-season-weapon': 'sword', 'language-select': 'en' });
  f.fields.set('equipment-season-weapon', { id: 'equipment-season-weapon', tagName: 'SELECT', options: [], value: '' });
  const quantity = f.field('fragment-quantity', '8');
  f.context.saveAllInputs();
  assert.equal(f.saved()['gift-owned-0'], '27');
  assert.equal(f.saved()['equipment-season-weapon'], 'sword');
  assert.equal(Object.hasOwn(f.saved(), 'language-select'), false);
  quantity.value = '';
  f.context.saveAllInputs();
  assert.equal(f.saved()['fragment-quantity'], '', 'explicitly clearing a mounted field must still persist');
});

test('refresh restores dynamic materials and inactive tool inputs before the next save', async () => {
  const original = {
    'character-level': '120', 'material-source-store-stone-daily': '7',
    'gift-current-level': '35', 'gift-owned-0': '27', 'fragment-quantity': '8',
  };
  const f = fixture(original);
  f.field('gift-current-level');
  f.field('fragment-quantity', '0');
  await f.context.initializeActiveFeature({}, original);
  assert.equal(f.fields.get('character-level').value, '120');
  assert.equal(f.fields.get('material-source-store-stone-daily').value, '7');
  assert.deepEqual(f.saved(), original);
  // Simulate a second page load using only the persisted snapshot.
  f.context.renderAll();
  await f.context.initializeActiveFeature({}, f.saved());
  assert.deepEqual(f.saved(), original);
});

test('direct equipment route restores quantity and fee settings for calculation', async () => {
  const saved = { 'fragment-quantity': '8', 'fragment-discount-fee': true, 'equipment-season-weapon': 'sword' };
  const f = fixture(saved, 'equipment');
  f.field('fragment-quantity', '0');
  f.field('fragment-discount-fee', '', 'checkbox');
  const weapon = f.field('equipment-season-weapon');
  f.context.initEquipmentSeasonScore = async (snapshot) => { weapon.value = snapshot[weapon.id]; };
  f.context.updateFragmentCalculator = () => {
    assert.equal(f.fields.get('fragment-quantity').value, '8');
    assert.equal(f.fields.get('fragment-discount-fee').checked, true);
  };
  await f.context.initializeActiveFeature({}, saved);
  assert.equal(weapon.value, 'sword');
});
