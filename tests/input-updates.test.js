import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { runShellBootstrap } from '../src/app/bootstrap.js';

const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
const inputHandlers = controller.slice(controller.indexOf('const pendingInputUpdates'), controller.indexOf('function getFeatureStatusTarget'));

function createInputContext() {
  const document = new EventTarget();
  const window = new EventTarget();
  const timers = new Map();
  let timerId = 0;
  const calls = [];
  document.querySelector = () => null;
  const context = vm.createContext({
    document, window, controllerEvents: new AbortController(), isAppLoading: false,
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    mirrorCompactCurrentLevelInput() {}, markTargetRecommendationCustom() {},
    updateMaterialSourceRow() {}, updateStoreSummaries() {}, updateRelicTotal() {},
    updateEquipmentSeasonScore: () => calls.push('equipment'),
    updateFragmentCalculator: () => calls.push('fragment'),
    updateGiftCalculatorResult: () => calls.push('gift'),
    updateFragmentFeeRates: () => calls.push('fees'),
    updateDungeonFragmentYield: () => calls.push('dungeon'),
    triggerRecalculate: () => calls.push('primordial'),
    saveAllInputs: () => calls.push('save'),
  });
  vm.runInContext(inputHandlers + '\nbindGlobalHandlers({});', context);
  const field = (id, type = 'number', inCalculator = true) => ({
    id, type, tagName: 'INPUT', value: '1', checked: false,
    closest: (selector) => selector.includes('#calculator-page-content') && inCalculator ? {} : null,
    classList: { contains: () => false }, dataset: {},
  });
  const emit = (type, target) => {
    const event = new Event(type);
    Object.defineProperty(event, 'target', { value: target });
    document.dispatchEvent(event);
  };
  const tick = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); };
  return { context, document, window, timers, calls, field, emit, tick };
}

test('input bursts coalesce and the matching change does not recalculate or save twice', () => {
  const { calls, timers, field, emit, tick } = createInputContext();
  const input = field('gift-current');
  emit('input', input);
  input.value = '12';
  emit('input', input);
  input.value = '123';
  emit('input', input);
  assert.equal(timers.size, 1);
  assert.deepEqual(calls, []);
  tick();
  emit('change', input);
  assert.deepEqual(calls, ['gift', 'save']);
});

test('change and pagehide flush the latest pending calculation before data can be lost', () => {
  const { calls, timers, field, emit, window } = createInputContext();
  const input = field('gift-current');
  emit('input', input);
  emit('change', input);
  assert.deepEqual(calls, ['gift', 'save']);
  assert.equal(timers.size, 0);
  input.value = '9';
  emit('input', input);
  window.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(calls, ['gift', 'save', 'gift', 'save']);
  assert.equal(timers.size, 0);
});

test('unrelated form input is ignored and checkbox changes retain fee updates', () => {
  const { calls, field, emit } = createInputContext();
  emit('input', field('relay-server-name-manual', 'text', false));
  emit('change', field('player-code-input', 'text', false));
  assert.deepEqual(calls, []);
  const checkbox = field('fragment-discount-fee', 'checkbox');
  checkbox.checked = true;
  emit('input', checkbox);
  emit('change', checkbox);
  assert.deepEqual(calls, ['fees', 'fragment', 'save']);
});

test('aborting old bindings prevents duplicate delegated updates after Retry', () => {
  const { context, calls, field, emit } = createInputContext();
  context.controllerEvents.abort();
  context.controllerEvents = new AbortController();
  context.bindGlobalHandlers({});
  emit('change', field('gift-current'));
  assert.deepEqual(calls, ['gift', 'save']);
});

test('timeout cannot become success or start later bootstrap stages after its request settles', async () => {
  let watchdog;
  let finish;
  let restores = 0;
  let timeouts = 0;
  const result = runShellBootstrap({
    documentLike: {},
    mountShell: () => new Promise((resolve) => { finish = resolve; }),
    restorePreferences: () => { restores += 1; },
    onTimeout: () => { timeouts += 1; },
    timers: { setTimeout: (callback) => { watchdog = callback; return 1; }, clearTimeout() {} },
  });
  watchdog();
  finish();
  assert.equal((await result).error.code, 'bootstrap_timeout');
  assert.equal((await result).ok, false);
  assert.equal(restores, 0);
  assert.equal(timeouts, 1);
});

test('Retry waits for the in-flight bootstrap and concurrent init calls share it', async () => {
  const source = controller.slice(controller.indexOf('let initialization = null;'), controller.indexOf('async function initializeApplication()'));
  const releases = [];
  let calls = 0;
  const context = vm.createContext({ AbortController, initializeApplication: () => {
    calls += 1;
    return new Promise((resolve) => releases.push(resolve));
  } });
  vm.runInContext(source, context);
  const first = context.init();
  assert.equal(context.init(), first);
  const retry = context.retryInitialization();
  assert.equal(calls, 1);
  releases.shift()();
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  releases.shift()();
  await retry;
});
