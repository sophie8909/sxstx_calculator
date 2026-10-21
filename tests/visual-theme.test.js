import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

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

test('twilight castle switches both controls, localizes, and survives reload independently of dark mode', async () => {
  const source = (await read('src/theme.js')).replaceAll('export function', 'function');
  const storage = new Map([['sxstx_ui_theme', 'dark']]);
  function load() {
    const controls = Array.from({ length: 2 }, () => ({
      dataset: {}, value: '', options: ['moon-rabbit', 'dream-carnival', 'twilight-castle'].map(value => ({ value })),
      setAttribute() {}, addEventListener(event, handler) { this[event] = handler; },
    }));
    const document = {
      documentElement: { lang: 'zh-Hant', dataset: {}, style: {} },
      querySelectorAll: selector => selector === '[data-visual-theme-select]' ? controls : [],
    };
    const events = {};
    const context = vm.createContext({
      document,
      localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
      window: { addEventListener: (event, handler) => { events[event] = handler; } },
    });
    vm.runInContext(source, context);
    return { controls, document, events, context };
  }
  let page = load();
  assert.equal(page.document.documentElement.dataset.visualTheme, 'moon-rabbit');
  page.controls[1].value = 'twilight-castle';
  page.controls[1].change();
  assert.equal(storage.get('sxstx_visual_theme'), 'twilight-castle');
  assert.equal(storage.get('sxstx_ui_theme'), 'dark');
  page = load();
  assert.equal(page.document.documentElement.dataset.visualTheme, 'twilight-castle');
  assert.equal(page.document.documentElement.dataset.theme, 'dark');
  for (const [lang, label] of [['zh-Hant', '暮夜古堡'], ['zh-Hans', '暮夜古堡'], ['en', 'Twilight Castle']]) {
    page.document.documentElement.lang = lang;
    page.events.languagechange();
    for (const control of page.controls) {
      assert.equal(control.value, 'twilight-castle');
      assert.equal(control.options[2].textContent, label);
    }
  }
  page.context.applyVisualThemePreference('dream-carnival');
  assert.equal(page.document.documentElement.dataset.visualTheme, 'dream-carnival');
  page.context.applyVisualThemePreference('invalid');
  assert.equal(page.document.documentElement.dataset.visualTheme, 'moon-rabbit');
});

test('twilight castle provides a selectable theme, light and dark palettes, and sidebar artwork', async () => {
  const [html, tokens, themes, fantasy, artwork] = await Promise.all([
    read('index.html'), read('src/styles/tokens.css'), read('src/styles/themes.css'), read('src/styles/fantasy.css'),
    readFile(new URL('images/theme-twilight-castle.webp', root)),
  ]);
  assert.match(html, /<option value="twilight-castle">暮夜古堡<\/option>/);
  assert.match(tokens, /:root\[data-visual-theme="twilight-castle"\]/);
  assert.match(themes, /:root\[data-theme="dark"\]\[data-visual-theme="twilight-castle"\]/);
  assert.match(fantasy, /html\[data-visual-theme='twilight-castle'\] \.sidebar-illustration \{ background-image: url\('\.\.\/\.\.\/images\/theme-twilight-castle.webp'\)/);
  assert.equal(artwork.toString('ascii', 8, 12), 'WEBP');
});
