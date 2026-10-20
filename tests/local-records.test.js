import assert from 'node:assert/strict';
import test from 'node:test';

const CATALOG_KEY = 'sxstxLocalRecords';
let page = 0;
const reload = () => import(`../src/services/localRecords.js?page=${++page}`);

function installStorage(t, entries = []) {
  const original = globalThis.localStorage;
  const values = new Map(entries);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  t.after(() => { globalThis.localStorage = original; });
  return values;
}

test('first record adopts existing inputs and context without moving or clearing them', async (t) => {
  const entries = [
    ['sxstxCalculatorData', '{"character-level":"120"}'],
    ['sxstxGlobalContext', '{"playerNumber":"600150900582","seasonId":"s4"}'],
    ['sxstx_ui_language', 'en'], ['sxstx_ui_theme', 'dark'],
    ['sxstxRemoteDataCache:sheet', 'cached CSV'],
  ];
  const values = installStorage(t, entries);
  const records = await reload();
  const state = records.initializeLocalRecords('紀錄 1');
  assert.equal(state.activeId, 'default');
  assert.deepEqual(state.records, [{ id: 'default', name: '紀錄 1' }]);
  assert.equal(records.getLocalRecordStorageKey('sxstxCalculatorData'), 'sxstxCalculatorData');
  assert.equal(records.getLocalRecordStorageKey('sxstxGlobalContext'), 'sxstxGlobalContext');
  for (const [key, value] of entries) assert.equal(values.get(key), value);
});

test('new records start empty and switch back with names, inputs, and player context intact', async (t) => {
  const values = installStorage(t, [['sxstxCalculatorData', '{"role-current":"120"}'], ['sxstxGlobalContext', '{"seasonId":"s4"}']]);
  const first = await reload();
  first.initializeLocalRecords('紀錄 1');
  first.renameLocalRecord('  主帳號  ');
  const next = first.createLocalRecord('紀錄 2');
  const secondId = next.activeId;
  assert.notEqual(secondId, 'default');
  assert.equal(first.getLocalRecordStorageKey('sxstxCalculatorData'), 'sxstxCalculatorData', 'old tabs remain bound to their own record');

  const second = await reload();
  const inputKey = second.getLocalRecordStorageKey('sxstxCalculatorData');
  const contextKey = second.getLocalRecordStorageKey('sxstxGlobalContext');
  assert.equal(values.has(inputKey), false);
  assert.equal(values.has(contextKey), false);
  localStorage.setItem(inputKey, '{"role-current":"35","gift-coins-kingdom":"80"}');
  localStorage.setItem(contextKey, '{"seasonId":"s5","playerNumber":"600260300582"}');
  second.renameLocalRecord('分身');
  second.switchLocalRecord('default');
  const back = await reload();
  assert.equal(values.get(back.getLocalRecordStorageKey('sxstxCalculatorData')), '{"role-current":"120"}');
  assert.equal(values.get(back.getLocalRecordStorageKey('sxstxGlobalContext')), '{"seasonId":"s4"}');
  assert.deepEqual(back.initializeLocalRecords('unused').records.map(({ name }) => name), ['主帳號', '分身']);
  back.switchLocalRecord(secondId);
  const again = await reload();
  assert.equal(values.get(again.getLocalRecordStorageKey('sxstxCalculatorData')), '{"role-current":"35","gift-coins-kingdom":"80"}');
  assert.equal(values.get(again.getLocalRecordStorageKey('sxstxGlobalContext')), '{"seasonId":"s5","playerNumber":"600260300582"}');
});

test('clearing current inputs leaves other records and their context untouched', async (t) => {
  const values = installStorage(t, [['sxstxCalculatorData', '{"role-current":"120"}']]);
  const first = await reload();
  first.initializeLocalRecords('First');
  first.createLocalRecord('Second');
  const second = await reload();
  const key = second.getLocalRecordStorageKey('sxstxCalculatorData');
  localStorage.setItem(key, '{"role-current":"35"}');
  localStorage.removeItem(key);
  assert.equal(values.get('sxstxCalculatorData'), '{"role-current":"120"}');
  assert.equal(values.has(key), false);
});

test('another tab switching records does not relabel or rename this tab as the other record', async (t) => {
  const values = installStorage(t);
  const first = await reload();
  first.initializeLocalRecords('First');
  const secondId = first.createLocalRecord('Second').activeId;
  const second = await reload();
  assert.equal(second.initializeLocalRecords('unused').activeId, secondId);
  assert.equal(first.initializeLocalRecords('unused').activeId, 'default');
  const renamed = first.renameLocalRecord('First renamed');
  assert.equal(renamed.activeId, 'default');
  assert.deepEqual(renamed.records.map(({ name }) => name), ['First renamed', 'Second']);
  assert.equal(JSON.parse(values.get(CATALOG_KEY)).activeId, secondId);
});

test('invalid names, unknown records, and failed writes leave the catalog and inputs intact', async (t) => {
  const values = installStorage(t, [['sxstxCalculatorData', '{"role-current":"120"}']]);
  const records = await reload();
  records.initializeLocalRecords('First');
  const secondId = records.createLocalRecord('Second').activeId;
  records.switchLocalRecord('default');
  const before = [...values];
  assert.throws(() => records.renameLocalRecord('  '));
  assert.throws(() => records.createLocalRecord('x'.repeat(61)));
  assert.throws(() => records.switchLocalRecord('missing'));
  assert.deepEqual([...values], before);
  localStorage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
  assert.throws(() => records.switchLocalRecord(secondId), { name: 'QuotaExceededError' });
  assert.throws(() => records.renameLocalRecord('New name'), { name: 'QuotaExceededError' });
  assert.deepEqual([...values], before);
});

test('corrupt catalogs are reported without overwriting existing records', async (t) => {
  const values = installStorage(t, [[CATALOG_KEY, '{broken'], ['sxstxCalculatorData', 'saved inputs']]);
  const records = await reload();
  assert.throws(() => records.initializeLocalRecords('First'));
  assert.equal(values.get(CATALOG_KEY), '{broken');
  assert.equal(values.get('sxstxCalculatorData'), 'saved inputs');
});
