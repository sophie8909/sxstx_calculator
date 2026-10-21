const THEME_STORAGE_KEY = 'sxstx_ui_theme';
const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';
const SYSTEM_THEME = 'system';
const VISUAL_THEME_STORAGE_KEY = 'sxstx_visual_theme';
const DEFAULT_VISUAL_THEME = 'moon-rabbit';
const VISUAL_THEMES = ['moon-rabbit', 'dream-carnival', 'twilight-castle'];

const THEME_LABELS = {
  'zh-Hant': { dark: '夜間模式', light: '日間模式', system: '系統設定' },
  'zh-Hans': { dark: '夜间模式', light: '日间模式', system: '系统设置' },
  en: { dark: 'Dark mode', light: 'Light mode', system: 'System settings' },
};

const THEME_EMOJIS = { dark: '🌙', light: '☀️', system: '⚙️' };

const VISUAL_THEME_LABELS = {
  'zh-Hant': { 'moon-rabbit': '桂月生輝', 'dream-carnival': '夢幻嘉年華', 'twilight-castle': '暮夜古堡' },
  'zh-Hans': { 'moon-rabbit': '桂月生辉', 'dream-carnival': '梦幻嘉年华', 'twilight-castle': '暮夜古堡' },
  en: { 'moon-rabbit': 'Moonlit Radiance', 'dream-carnival': 'Dream Carnival', 'twilight-castle': 'Twilight Castle' },
};

const VISUAL_THEME_TITLES = {
  'zh-Hant': '選擇視覺主題',
  'zh-Hans': '选择视觉主题',
  en: 'Select visual theme',
};

function getStoredPreference() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return [DARK_THEME, LIGHT_THEME, SYSTEM_THEME].includes(saved) ? saved : SYSTEM_THEME;
}

function getStoredVisualTheme() {
  const saved = localStorage.getItem(VISUAL_THEME_STORAGE_KEY);
  return VISUAL_THEMES.includes(saved) ? saved : DEFAULT_VISUAL_THEME;
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME;
}

function getEffectiveTheme(preference) {
  return preference === SYSTEM_THEME ? getSystemTheme() : preference;
}

function updateThemeControl(preference) {
  const language = document.documentElement.lang || 'zh-Hant';
  const labels = THEME_LABELS[language] ?? THEME_LABELS['zh-Hant'];
  document.querySelectorAll('[data-theme-select]').forEach((select) => {
    select.value = preference;
    select.setAttribute('aria-label', labels[preference]);
    Array.from(select.options).forEach((option) => {
      option.textContent = THEME_EMOJIS[option.value] + ' ' + labels[option.value];
    });
  });
}

function updateVisualThemeControl(visualTheme) {
  const language = document.documentElement.lang || 'zh-Hant';
  const labels = VISUAL_THEME_LABELS[language] ?? VISUAL_THEME_LABELS['zh-Hant'];
  const title = VISUAL_THEME_TITLES[language] ?? VISUAL_THEME_TITLES['zh-Hant'];
  document.querySelectorAll('[data-visual-theme-select]').forEach((select) => {
    select.value = visualTheme;
    select.setAttribute('aria-label', title);
    select.setAttribute('title', title);
    Array.from(select.options).forEach((option) => { option.textContent = labels[option.value]; });
  });
}

function applyEffectiveTheme(preference) {
  const theme = getEffectiveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  updateThemeControl(preference);
}

export function applyThemePreference(preference) {
  const normalized = [DARK_THEME, LIGHT_THEME, SYSTEM_THEME].includes(preference) ? preference : SYSTEM_THEME;
  localStorage.setItem(THEME_STORAGE_KEY, normalized);
  applyEffectiveTheme(normalized);
}

export function applyVisualThemePreference(visualTheme) {
  const normalized = VISUAL_THEMES.includes(visualTheme) ? visualTheme : DEFAULT_VISUAL_THEME;
  localStorage.setItem(VISUAL_THEME_STORAGE_KEY, normalized);
  document.documentElement.dataset.visualTheme = normalized;
  updateVisualThemeControl(normalized);
}

function initTheme() {
  const preference = getStoredPreference();
  applyEffectiveTheme(preference);
  applyVisualThemePreference(getStoredVisualTheme());

  document.querySelectorAll('[data-theme-select]').forEach((select) => {
    if (select.dataset.themeBound) return;
    select.dataset.themeBound = '1';
    select.addEventListener('change', () => applyThemePreference(select.value));
  });

  document.querySelectorAll('[data-visual-theme-select]').forEach((select) => {
    if (select.dataset.visualThemeBound) return;
    select.dataset.visualThemeBound = '1';
    select.addEventListener('change', () => applyVisualThemePreference(select.value));
  });

  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  mediaQuery?.addEventListener?.('change', () => {
    if (getStoredPreference() === SYSTEM_THEME) applyEffectiveTheme(SYSTEM_THEME);
  });
}

window.addEventListener('languagechange', () => {
  updateThemeControl(getStoredPreference());
  updateVisualThemeControl(getStoredVisualTheme());
});

initTheme();
