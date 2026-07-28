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

test('source HTML uses JavaScript as the module entrypoint and Tailwind as a stylesheet', async () => {
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
  assert.match(indexHtml, /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*css\/tailwind\.css["'][^>]*>/i);
  assert.doesNotMatch(mainSource, /import\s+["'][^"']*\.css["']/);
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
