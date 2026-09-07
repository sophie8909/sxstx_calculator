import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseGiftSheet } from '../src/features/gift/sheet.js';

const controller = readFileSync(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
const functions = [
  'getGiftKingdomRowsByCategory', 'getAvailableGiftKingdoms',
  'getGiftKingdomLabel', 'getGiftSourceRank', 'buildGiftPurchaseOptions', 'addGiftPurchase',
].map((name) => {
  const start = controller.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = controller.indexOf('\n}', start) + 2;
  return controller.slice(start, end);
}).join('\n');

test('dynamic sheet kingdoms reach purchase options and labels without substring matches', () => {
  const { rows, kingdoms } = parseGiftSheet([
    ['禮物品質', '好感', '價格', '新國度', '新國度東境'],
    ['藍', '200', '300', '日用品', '書'],
  ], [
    { id: 's7', kingdomName: '新國度' },
    { id: 's8', kingdomName: '新國度東境' },
    { id: 's9', kingdomName: '尚未販售國度' },
  ]);
  const context = { giftKingdoms: kingdoms, parseNumberValue: Number, rows,
    coins: new Map([['s7', 600], ['s8', 900], ['s9', 10000]]) };
  runInNewContext(functions + '\noptions = buildGiftPurchaseOptions(rows, "book", coins);' +
    '\npurchases = addGiftPurchase([], options[0], 2);', context);
  assert.equal(context.options.length, 1);
  assert.equal(context.options[0].kingdom.id, 's8');
  assert.equal(context.options[0].maxCount, 3);
  assert.equal(context.purchases[0].kingdomLabel, '新國度東境');
  assert.equal(context.purchases[0].spent, 600);
  assert.equal(context.purchases[0].obtainedFavor, 400);
});
