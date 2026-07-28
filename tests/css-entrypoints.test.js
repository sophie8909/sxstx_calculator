import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../', import.meta.url);

function findCssModuleScripts(html) {
  return [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => /\btype=["']module["']/i.test(tag))
    .filter((tag) => /\bsrc=["'][^"']*\.css(?:[?#][^"']*)?["']/i.test(tag));
}

async function readRepositoryFile(relativePath) {
  return readFile(new URL(relativePath, repositoryRoot), 'utf8');
}

test('source HTML uses one JavaScript entrypoint for the intentional stylesheet graph', async () => {
  const [indexHtml, redirectHtml, mainSource] = await Promise.all([
    readRepositoryFile('index.html'),
    readRepositoryFile('submit-target-time.html'),
    readRepositoryFile('src/main.js'),
  ]);

  for (const [fileName, html] of [
    ['index.html', indexHtml],
    ['submit-target-time.html', redirectHtml],
  ]) {
    assert.deepEqual(findCssModuleScripts(html), [], `${fileName} must not load CSS as a module script`);
  }

  assert.match(indexHtml, /<script\b[^>]*type=["']module["'][^>]*src=["'][^"']*src\/main\.js["'][^>]*>/i);
  assert.doesNotMatch(indexHtml, /href=["'][^"']*(?:css\/style|css\/world-rally|css\/tailwind)\.css["']/i);
  assert.match(mainSource, /import\s+["']\.\/styles\/index\.css["']/);
  assert.equal((mainSource.match(/import\s+["'][^"']*\.css["']/g) || []).length, 1);
});

test('built HTML never references CSS from a module script', async () => {
  const distDirectory = new URL('../dist/', import.meta.url);
  const entryNames = (await readdir(distDirectory)).filter((name) => name.endsWith('.html'));
  assert.ok(entryNames.includes('index.html'));
  assert.ok(entryNames.includes('submit-target-time.html'));

  for (const fileName of entryNames) {
    const html = await readFile(new URL(fileName, distDirectory), 'utf8');
    assert.deepEqual(findCssModuleScripts(html), [], `${fileName} must not load CSS as a module script`);
  }

  const indexHtml = await readFile(new URL('index.html', distDirectory), 'utf8');
  assert.match(indexHtml, /<script\b[^>]*type=["']module["'][^>]*src=["'][^"']*\.js["'][^>]*>/i);
  assert.match(indexHtml, /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*\.css["'][^>]*>/i);
});
