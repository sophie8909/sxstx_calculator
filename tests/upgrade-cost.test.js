import test from 'node:test';
import assert from 'node:assert/strict';

import { getCostDelta, getCumulative } from '../src/core/upgradeCost.js';

const sparseCosts = [
  { level: 1, cost_ore: 10, cost_wood: 5 },
  { level: 3, cost_ore: 30, cost_wood: 15 },
];

test('interpolates cumulative costs between known levels', () => {
  assert.deepEqual(getCumulative(sparseCosts, 2), {
    cost_ore: 20,
    cost_wood: 10,
  });
});

test('extrapolates cost deltas beyond the last known level', () => {
  assert.deepEqual(getCostDelta(sparseCosts, 1, 5), {
    materials: { ore: 40, wood: 20 },
    estimatedRanges: [{ from: 3, to: 4 }],
  });
});

test('reports the interpolated range used by a cost delta', () => {
  assert.deepEqual(getCostDelta(sparseCosts, 2, 3), {
    materials: { ore: 10, wood: 5 },
    estimatedRanges: [{ from: 1, to: 3 }],
  });
});
