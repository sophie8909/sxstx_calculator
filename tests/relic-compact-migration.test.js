import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/features/progression/legacyAdapter.js', import.meta.url), 'utf8');
const persistence = source.slice(source.indexOf('export function saveAllInputs()')).replaceAll('export function', 'function');
function fixture(saved) {
  let storage = JSON.stringify(saved);
  const fields = Object.fromEntries(['relic-completed-level', 'relic-next-progress'].map(id => [id, {id, type:'number', value:''}]));
  const notices = [];
  const card = { querySelector: () => notices[0], appendChild: node => notices.push(node) };
  const context = vm.createContext({
    STORAGE_KEY: 'test', t: key => key,
    localStorage: { getItem: () => storage, setItem: (_, value) => { storage = value; } },
    document: {
      getElementById: id => id === 'relic-card' ? card : fields[id],
      querySelectorAll: () => Object.values(fields),
      createElement: () => ({dataset:{}}),
    },
  });
  vm.runInContext(persistence, context);
  return { context, fields, notices, saved: () => JSON.parse(storage) };
}

test('adjacent legacy relic counts migrate exactly into editable compact values', () => {
  const f = fixture({'relic-ui-mode':'legacy', 'relic-level-8':'13', 'relic-level-9':'7'});
  f.context.loadAllInputs();
  assert.equal(f.fields['relic-completed-level'].value, '8');
  assert.equal(f.fields['relic-next-progress'].value, '7');
  assert.equal(f.saved()['relic-ui-mode'], 'compact');
  assert.equal(f.notices.length, 0);
  f.fields['relic-next-progress'].value = '10';
  f.context.saveAllInputs(); f.context.loadAllInputs();
  assert.equal(f.fields['relic-next-progress'].value, '10');
});

test('nonrepresentable relic distributions remain backed up after ordinary saves', () => {
  const f = fixture({'relic-ui-mode':'legacy', 'relic-level-2':'10', 'relic-level-8':'10', 'relic-completed-level':'99'});
  f.context.loadAllInputs();
  assert.equal(f.fields['relic-completed-level'].value, '');
  assert.equal(f.fields['relic-next-progress'].value, '');
  assert.equal(f.notices.length, 1);
  f.context.saveAllInputs(); f.context.loadAllInputs();
  assert.deepEqual(f.saved()['relic-legacy-backup'], {'2':10,'8':10});
  assert.equal(f.saved()['relic-migration-needs-reentry'], 'true');
  assert.equal(f.notices.length, 1);
});

test('uniform legacy relics migrate without introducing next-level progress', () => {
  const f = fixture({'relic-ui-mode':'legacy', 'relic-level-12':'20'});
  f.context.loadAllInputs();
  assert.equal(f.fields['relic-completed-level'].value, '12');
  assert.equal(f.fields['relic-next-progress'].value, '0');
});
