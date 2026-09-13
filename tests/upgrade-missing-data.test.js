import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCumulativeCostData, getCostDelta } from '../src/core/upgradeCost.js';
import { calculateUpgradeResults } from '../src/core/calculator.js';
const options = { expectedMaterials: ['freezeDried'] };
const petTable = rows => buildCumulativeCostData({ petUpgradeCosts: rows }).pet;

test('blank, zero, absent and invalid costs are missing even when EXP exists', () => {
  for (const value of ['', ' ', 0, '0', undefined, 'bad', -1]) {
    const result = getCostDelta(petTable([{level:100,cost_exp:26300,cost_freeze_dried:value}]),100,101,options);
    assert.deepEqual(result.materials,{});
    assert.deepEqual(result.missingMaterials,{freezeDried:[{from:100,to:100}]});
  }
});

test('missing rows and empty tables report only requested transitions', () => {
  for (const table of [[],undefined,petTable([{level:102,cost_freeze_dried:30}])]) {
    assert.deepEqual(getCostDelta(table,100,102,options).missingMaterials,{freezeDried:[{from:100,to:101}]});
    assert.deepEqual(getCostDelta(table,100,100,options),{materials:{},estimatedRanges:[]});
  }
});

test('known range after an earlier missing row is exact and independent of EXP', () => {
  const table = petTable([{level:100,cost_exp:999,cost_freeze_dried:10},{level:102,cost_exp:'',cost_freeze_dried:30},{level:103,cost_exp:0,cost_freeze_dried:40}]);
  assert.deepEqual(getCostDelta(table,102,104,options),{materials:{freezeDried:70},estimatedRanges:[]});
  assert.deepEqual(getCostDelta(table,100,104,options).missingMaterials,{freezeDried:[{from:101,to:101}]});
});

test('one missing material does not hide another known material', () => {
  const table=buildCumulativeCostData({equipmentUpgradeCosts:[{level:10,cost_stone_ore:100,cost_rola:0}]}).equipment;
  const result=getCostDelta(table,10,11,{expectedMaterials:['stoneOre','rola']});
  assert.deepEqual(result.materials,{stoneOre:100});
  assert.deepEqual(result.missingMaterials,{rola:[{from:10,to:10}]});
});

test('calculator suppresses partial totals and reports season-specific errors', () => {
  const result=calculateUpgradeResults({targets:{pets:{pet1:101,pet2:103}},categoryCurrentLevels:{pet1:100,pet2:102},relicDistribution:[],bedProgress:{currentLevel:1,ownedExp:0,bedExpHourly:0,targetTime:''},primordial:{},productionHourly:{},materialSourceGains:{},ownedMaterials:{freezeDried:99999},speedupState:{},now:0},{categories:[{id:'pet1'},{id:'pet2'}],cumulativeCostData:{pet:petTable([{level:100,cost_freeze_dried:10},{level:102,cost_exp:50,cost_freeze_dried:0}])},materials:{freezeDried:{}},productionSources:{},relicCountRequired:20,seasonId:'s4',seasonScore:{},speedupHoursPerUse:2,messages:{}});
  assert.equal(result.required.freezeDried,undefined);
  assert.equal(result.deficit.freezeDried,undefined);
  assert.deepEqual(result.materialErrors.freezeDried,{seasonId:'s4',ranges:[{from:102,to:102}]});
});
