import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGiftSheet } from '../src/features/gift/sheet.js';
import { buildSeasonOptions } from '../src/services/seasons.js';

const seasons = buildSeasonOptions([
  { season: 's1', 國度名稱: '澤之國' }, { season: 's2', 國度名稱: '龍之國' },
  { season: 's3', 國度名稱: '羽之國' }, { season: 's4', 國度名稱: '哈帕迪' },
  { season: 's5', 國度名稱: '伊格尼斯' }, { season: 's6', 國度名稱: '艾珀希' },
]);
const headers = ['level', '夥伴所需好感', '星間之神所需好感', '禮物品質', '好感', '價格', '山之國', '澤之國', '龍之國', '羽之國', '哈帕迪', '伊格尼斯'];

test('transposes live country columns and preserves favor and price values', () => {
  const { rows, kingdoms } = parseGiftSheet([
    headers,
    ['1', '300', '900', '藍', '200', '300', '貴重品', '日用品', '書', '貴重品', '', '貴重品'],
    ['2', '350', '1050', '紫', '1000', '1500', '貴重品、貴重品', '日用品', '書、貴重品', '日用品', '花', '貴重品'],
    ['3', '400', '1200', '橙', '3000', '4500', '貴重品', '日用品、書', '書', '貴重品', '', '書'],
    ['4', '450', '1350'],
  ], seasons);
  assert.deepEqual(rows[0], { level: '1', partner_required_favor: '300', star_god_required_favor: '900', quality: '藍', favor: '200', price: '300',
    categories: { daily: '澤之國', flower: '', book: '龍之國', valuables: '山之國、羽之國、伊格尼斯' } });
  assert.deepEqual(rows[1].categories, { daily: '澤之國、羽之國', flower: '哈帕迪', book: '龍之國', valuables: '山之國、龍之國、伊格尼斯' });
  assert.equal(rows[2].categories.book, '澤之國、龍之國、伊格尼斯');
  assert.deepEqual(rows[3].categories, { daily: '', flower: '', book: '', valuables: '' });
  assert.ok(kingdoms.some((kingdom) => kingdom.id === 's6' && kingdom.name === '艾珀希'));
  assert.equal(kingdoms.filter((kingdom) => kingdom.name === '山之國').length, 1);
});

test('new season names and reordered gift columns require no country constants', () => {
  const futureSeasons = buildSeasonOptions([{ season: 's10', 國度名稱: '新國度' }, { season: 's11', 國度名稱: '未販售' }]);
  const { rows, kingdoms } = parseGiftSheet([
    ['新國度', '價格', '禮物品質', '好感'],
    ['書、日用品，贵重品;书', '100', '紫', '50'],
  ], futureSeasons);
  assert.deepEqual(rows[0].categories, { daily: '新國度', flower: '', book: '新國度', valuables: '新國度' });
  assert.deepEqual(kingdoms.map((kingdom) => kingdom.name), ['新國度', '未販售']);
  assert.equal(rows[0].price, '100');
});

test('ignores blank names and unknown categories and deduplicates countries', () => {
  const input = [['禮物品質', '好感', '價格', ' 新國度 ', '新國度', ''], ['藍', '200', '300', '花', '花、未分類', '書']];
  const original = structuredClone(input);
  const { rows, kingdoms } = parseGiftSheet(input, [{ id: 's7', kingdomName: '新國度' }, { id: 's8', kingdomName: '新國度' }, { id: 's9', kingdomName: '' }]);
  assert.equal(kingdoms.length, 1);
  assert.deepEqual(rows[0].categories, { daily: '', flower: '新國度', book: '', valuables: '' });
  assert.deepEqual(input, original);
  assert.deepEqual(parseGiftSheet([], []).rows, []);
});
