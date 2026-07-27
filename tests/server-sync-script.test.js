import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scriptUrl = new URL('../scripts/sync-servers.gs', import.meta.url);

test('server sync targets only the canonical and form server sheets', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /canonicalSheetName: '伺服器'/);
  assert.match(script, /formSheetName: '伺服器時間'/);
  assert.match(script, /canonicalHeaders: \['伺服器編號', '伺服器名稱'\]/);
  assert.match(script, /getRange\(1, 1, canonicalSheet\.getMaxRows\(\), 2\)\.clearContent\(\)/);
});

test('server sync precedence is canonical sheet, repository, then submissions', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  const submitted = script.indexOf('submittedServers.forEach');
  const repository = script.indexOf('repositoryServers.forEach');
  const canonical = script.indexOf('currentCanonical.forEach');

  assert.ok(submitted >= 0 && submitted < repository);
  assert.ok(repository < canonical);
  assert.match(script, /onFormSubmit\(e\)/);
});
