import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scriptUrl = new URL('../scripts/sync-servers.gs', import.meta.url);

test('server sync targets the canonical and append-only form sheets with full metadata', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /canonicalSheetName: '伺服器'/);
  assert.match(script, /formSheetName: '伺服器時間'/);
  for (const header of ['server_short', 'realm_id', 'merge_2', 'merge_4', 'merge_8', 'merge_16', 'current_state']) {
    assert.match(script, new RegExp(header));
  }
});

test('server sync never reads repository CSV and fills only blank canonical fields', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.doesNotMatch(script, /raw\.githubusercontent|repositoryCsvUrl|UrlFetchApp/);
  assert.match(script, /!String\(existing\.row\[columnIndex\].*\.trim\(\)/);
  assert.match(script, /canonicalSheet\.appendRow\(record\)/);
  assert.doesNotMatch(script, /clearContent/);
  assert.match(script, /onFormSubmit\(e\)/);
});
