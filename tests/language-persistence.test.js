import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/features/progression/legacyAdapter.js', import.meta.url), 'utf8');
const persistence = source.slice(source.indexOf('export function saveAllInputs()')).replaceAll('export function', 'function');

test('calculator snapshots cannot overwrite or persist the selected interface language', () => {
  let storage = JSON.stringify({'language-select':'zh-Hant','role-current':'12'});
  const fields = {
    'language-select': {id:'language-select',type:'select-one',value:'en'},
    'role-current': {id:'role-current',type:'number',value:''},
  };
  const context = vm.createContext({
    STORAGE_KEY:'calculator',
    localStorage:{getItem:()=>storage,setItem:(_,value)=>{storage=value;}},
    document:{getElementById:id=>fields[id],querySelectorAll:()=>Object.values(fields)},
  });
  vm.runInContext(persistence,context);
  for (const language of ['en','zh-Hans','zh-Hant']) {
    fields['language-select'].value=language;
    context.loadAllInputs();
    assert.equal(fields['language-select'].value,language);
    assert.equal(fields['role-current'].value,'12');
  }
  context.saveAllInputs();
  assert.equal(Object.hasOwn(JSON.parse(storage),'language-select'),false);
  assert.equal(JSON.parse(storage)['role-current'],'12');
});
