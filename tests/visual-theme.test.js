import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('visual theme persists separately from the light and dark preference', async () => {
  const [html, theme, shell, fantasy] = await Promise.all([
    read('index.html'), read('src/theme.js'), read('src/app/shell.js'), read('src/styles/fantasy.css'),
  ]);
  assert.match(html, /data-visual-theme-select/);
  assert.match(theme, /sxstx_visual_theme/);
  assert.match(theme, /DEFAULT_VISUAL_THEME = 'moon-rabbit'/);
  assert.match(theme, /document\.documentElement\.dataset\.visualTheme/);
  assert.match(shell, /applyVisualThemePreference/);
  assert.match(shell, /faviconUrl = new URL/);
  assert.match(fantasy, /sidebar-illustration/);
});