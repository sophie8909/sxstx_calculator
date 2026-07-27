import test from 'node:test';
import assert from 'node:assert/strict';

import { buildToolUrl, normalizeTool, readToolFromLocation } from '../src/app/router.js';
import { createGlobalStore } from '../src/app/store.js';

test('query routing supports direct links and rejects invalid tools', () => {
  const location = { href: 'https://example.com/?tool=world-rally#details', search: '?tool=world-rally' };
  assert.equal(readToolFromLocation(location), 'world-rally');
  assert.equal(normalizeTool('invalid'), 'progression');
  assert.equal(buildToolUrl('gift', location), '/?tool=gift#details');
});

test('global context updates propagate without discarding unrelated feature-independent state', () => {
  globalThis.localStorage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, value); },
  };
  const store = createGlobalStore({ playerNumber: '600260112345', seasonId: 's4', theme: 'dark' });
  let observed;
  store.subscribe((state) => { observed = state; });
  store.update({ seasonId: 's5' });
  assert.equal(observed.playerNumber, '600260112345');
  assert.equal(observed.seasonId, 's5');
  assert.equal(observed.theme, 'dark');
  delete globalThis.localStorage;
});
