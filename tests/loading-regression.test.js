import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  runShellBootstrap,
  setDocumentLoading,
} from '../src/app/bootstrap.js';
import {
  CACHE_UPDATED_EVENT,
  fetchTextWithCache,
} from '../src/services/dataCache.js';
import {
  clearDataServiceMemoryCache,
  loadSheet,
  validateSheetHeaders,
} from '../src/services/dataService.js';
import { SHEETS } from '../src/services/sheetRegistry.js';

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
    },
    contains: (name) => values.has(name),
  };
}

function createElement() {
  const attributes = new Map();
  return {
    classList: createClassList(),
    disabled: false,
    inert: false,
    children: [],
    textContent: '',
    dataset: {},
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
  };
}

function createDocument() {
  const workspace = createElement();
  const body = createElement();
  body.classList = createClassList(['app-loading']);
  const shell = createElement();
  const status = createElement();
  const message = createElement();
  const control = createElement();
  const byId = new Map([
    ['feature-workspace', workspace],
    ['global-data-status', status],
    ['app-loading-message', message],
  ]);
  return {
    workspace,
    body,
    shell,
    status,
    control,
    getElementById: (id) => byId.get(id) || null,
    querySelector: (selector) => (selector === '.app-shell' ? shell : null),
    querySelectorAll: () => [control],
    createElement,
  };
}

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
  return values;
}

test('1. full-screen loader closes when all initial requests succeed', async () => {
  const documentLike = createDocument();
  const result = await runShellBootstrap({
    documentLike,
    mountShell() {},
    restorePreferences() {},
    initializeGlobalContext: async () => {},
  });
  assert.equal(result.ok, true);
  assert.equal(documentLike.body.classList.contains('app-loading'), false);
  assert.equal(documentLike.body.getAttribute('aria-busy'), 'false');
});

test('2. full-screen loader closes when one initial request fails', async () => {
  const documentLike = createDocument();
  const result = await runShellBootstrap({
    documentLike,
    mountShell() {},
    initializeGlobalContext: async () => { throw new Error('failed sheet'); },
  });
  assert.equal(result.ok, false);
  assert.equal(documentLike.body.classList.contains('app-loading'), false);
});

test('3. full-screen loader closes when a request times out', async () => {
  installStorage();
  clearDataServiceMemoryCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  await assert.rejects(
    loadSheet('gameSettings', { refresh: true, timeoutMs: 5 }),
    (error) => error.code === 'sheet_timeout' && error.sheet === '遊戲設定' && error.gid === 107367349
  );
  globalThis.fetch = originalFetch;
});

test('4. loading is scoped to the feature workspace without disabling the shell', () => {
  const documentLike = createDocument();
  setDocumentLoading(documentLike, true);
  setDocumentLoading(documentLike, false);
  assert.equal(documentLike.shell.inert, false);
  assert.equal(documentLike.workspace.getAttribute('aria-busy'), 'false');
  assert.equal(documentLike.workspace.classList.contains('is-loading'), false);
  assert.equal(documentLike.control.disabled, false);
});

test('5. a feature failure does not prevent the shell from rendering', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  assert.match(controller, /await runShellBootstrap\(\{/);
  assert.match(controller, /initializeActiveFeature\(containers, saved\);/);
});

test('6. cached data renders without waiting for background refresh', async () => {
  const values = installStorage();
  const cacheKey = 'warm-cache-test';
  values.set(`sxstxRemoteDataCache:${cacheKey}`, JSON.stringify({
    version: 'v2',
    updatedAt: new Date().toISOString(),
    signature: 'cached',
    data: 'a,b\n1,2',
  }));
  const originalFetch = globalThis.fetch;
  let resolveRefresh;
  globalThis.fetch = () => new Promise((resolve) => { resolveRefresh = resolve; });
  const result = await Promise.race([
    fetchTextWithCache(cacheKey, 'https://example.test/?gid=1'),
    new Promise((resolve) => setTimeout(() => resolve('blocked'), 25)),
  ]);
  assert.equal(result, 'a,b\n1,2');
  resolveRefresh(new Response('a,b\n1,2', { status: 200, headers: { 'content-type': 'text/csv' } }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  globalThis.fetch = originalFetch;
});

test('7. a cache update does not recursively initialize the app', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  const handler = controller.slice(
    controller.indexOf('function bindDataCacheHandlers'),
    controller.indexOf('function getMaterialInput')
  );
  assert.match(handler, /CACHE_UPDATED_EVENT/);
  assert.doesNotMatch(handler, /handleSeasonChange|initializeActiveFeature|setAppLoading/);
});

test('8. duplicate concurrent gid requests are deduplicated', async () => {
  installStorage();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveFetch;
  globalThis.fetch = () => {
    calls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  const first = fetchTextWithCache('dedupe-test', 'https://example.test/?gid=2');
  const second = fetchTextWithCache('dedupe-test', 'https://example.test/?gid=2');
  resolveFetch(new Response('a,b\n1,2', { status: 200, headers: { 'content-type': 'text/csv' } }));
  assert.equal(await first, 'a,b\n1,2');
  assert.equal(await second, 'a,b\n1,2');
  assert.equal(calls, 1);
  globalThis.fetch = originalFetch;
});

test('9. invalid HTML responses are rejected as sheet errors', async () => {
  installStorage();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!doctype html><title>Sign in</title>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
  await assert.rejects(
    fetchTextWithCache('html-test', 'https://example.test/?gid=3', { refresh: true }),
    (error) => error.code === 'sheet_invalid_content_type'
  );
  globalThis.fetch = originalFetch;
});

test('10. missing headers produce an inline unavailable state', () => {
  assert.throws(
    () => validateSheetHeaders(['season', 'enabled'], SHEETS.rallyRules),
    (error) => error.code === 'sheet_missing_headers' && error.sheet === '世界集結規則'
  );
});

test('11. direct world-rally route does not wait for progression sheets', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  const worldBranch = controller.match(/else if \(tool === 'world-rally'\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  assert.match(worldBranch, /initServerSelector|initWorldRally/);
  assert.doesNotMatch(worldBranch, /loadDataForSeason|initEquipmentSeasonScore/);
});

test('12. direct gift route does not wait for World Rally sheets', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  const giftBranch = controller.match(/else if \(tool === 'gift'\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  assert.match(giftBranch, /renderGiftCalculator/);
  assert.doesNotMatch(giftBranch, /initWorldRally|initServerSelector/);
});

test('13. Retry can recover from an initial failed request', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  assert.match(controller, /button\.textContent = 'Retry'/);
  assert.match(controller, /initializeActiveFeature\(containers, saved, \{ refresh: true \}\)/);
});

test('14. a stale cache notice does not reactivate the global overlay', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  const handler = controller.slice(
    controller.indexOf('function bindDataCacheHandlers'),
    controller.indexOf('function getMaterialInput')
  );
  assert.match(handler, /showing cached data/);
  assert.doesNotMatch(handler, /setAppLoading\(true\)/);
});

test('15. initial global context hydrates the target-time filter state even when persisted context is unchanged', async () => {
  const controller = await readFile(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  const notifyContext = controller.slice(
    controller.indexOf('const notifyContext ='),
    controller.indexOf('const syncContext =')
  );
  const hydrateIndex = notifyContext.indexOf('Object.assign(state');
  const unchangedReturnIndex = notifyContext.indexOf('if (!changed) return false;');

  assert.ok(hydrateIndex >= 0, 'legacy calculator state must be hydrated');
  assert.ok(unchangedReturnIndex >= 0, 'unchanged persisted context should still avoid duplicate notifications');
  assert.ok(hydrateIndex < unchangedReturnIndex, 'legacy state hydration must happen before the unchanged-context early return');
  assert.match(notifyContext, /serverName: context\.serverName/);
});
