const THEME_STORAGE_KEY = 'sxstx_ui_theme';
const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';
const SYSTEM_THEME = 'system';

const THEME_LABELS = {
  'zh-Hant': {
    dark: '\u591c\u9593\u6a21\u5f0f',
    light: '\u65e5\u9593\u6a21\u5f0f',
  system: '<path d="M12.22 2h-.44a2 2 0 0 0-1.99 1.82l-.07.56a7 7 0 0 0-1.1.64l-.5-.3a2 2 0 0 0-2.5.45l-.22.3a2 2 0 0 0 .26 2.52l.43.39a7 7 0 0 0-.02 1.27l-.43.39a2 2 0 0 0-.26 2.52l.22.3a2 2 0 0 0 2.5.45l.5-.3c.34.25.71.46 1.1.64l.07.56A2 2 0 0 0 11.78 22h.44a2 2 0 0 0 1.99-1.82l.07-.56a7 7 0 0 0 1.1-.64l.5.3a2 2 0 0 0 2.5-.45l.22-.3a2 2 0 0 0-.26-2.52l-.43-.39a7 7 0 0 0 .02-1.27l.43-.39a2 2 0 0 0 .26-2.52l-.22-.3a2 2 0 0 0-2.5-.45l-.5.3a7 7 0 0 0-1.1-.64l-.07-.56A2 2 0 0 0 12.22 2Z"/><circle cx="12" cy="12" r="3"/>', 
  },
  'zh-Hans': {
    dark: '\u591c\u95f4\u6a21\u5f0f',
    light: '\u65e5\u95f4\u6a21\u5f0f',
  system: '<path d="M12.22 2h-.44a2 2 0 0 0-1.99 1.82l-.07.56a7 7 0 0 0-1.1.64l-.5-.3a2 2 0 0 0-2.5.45l-.22.3a2 2 0 0 0 .26 2.52l.43.39a7 7 0 0 0-.02 1.27l-.43.39a2 2 0 0 0-.26 2.52l.22.3a2 2 0 0 0 2.5.45l.5-.3c.34.25.71.46 1.1.64l.07.56A2 2 0 0 0 11.78 22h.44a2 2 0 0 0 1.99-1.82l.07-.56a7 7 0 0 0 1.1-.64l.5.3a2 2 0 0 0 2.5-.45l.22-.3a2 2 0 0 0-.26-2.52l-.43-.39a7 7 0 0 0 .02-1.27l.43-.39a2 2 0 0 0 .26-2.52l-.22-.3a2 2 0 0 0-2.5-.45l-.5.3a7 7 0 0 0-1.1-.64l-.07-.56A2 2 0 0 0 12.22 2Z"/><circle cx="12" cy="12" r="3"/>', 
  },
  en: { dark: 'Dark mode', light: 'Light mode', system: 'System settings' },
};

const ICONS = {
  dark: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
  system: '<path d="M12.22 2h-.44a2 2 0 0 0-1.99 1.82l-.07.56a7 7 0 0 0-1.1.64l-.5-.3a2 2 0 0 0-2.5.45l-.22.3a2 2 0 0 0 .26 2.52l.43.39a7 7 0 0 0-.02 1.27l-.43.39a2 2 0 0 0-.26 2.52l.22.3a2 2 0 0 0 2.5.45l.5-.3c.34.25.71.46 1.1.64l.07.56A2 2 0 0 0 11.78 22h.44a2 2 0 0 0 1.99-1.82l.07-.56a7 7 0 0 0 1.1-.64l.5.3a2 2 0 0 0 2.5-.45l.22-.3a2 2 0 0 0-.26-2.52l-.43-.39a7 7 0 0 0 .02-1.27l.43-.39a2 2 0 0 0 .26-2.52l-.22-.3a2 2 0 0 0-2.5-.45l-.5.3a7 7 0 0 0-1.1-.64l-.07-.56A2 2 0 0 0 12.22 2Z"/><circle cx="12" cy="12" r="3"/>', 
};

function getStoredPreference() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return [DARK_THEME, LIGHT_THEME, SYSTEM_THEME].includes(saved) ? saved : SYSTEM_THEME;
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME;
}

function getEffectiveTheme(preference) {
  return preference === SYSTEM_THEME ? getSystemTheme() : preference;
}

function updateThemeControl(preference) {
  const language = document.documentElement.lang || 'zh-Hant';
  const label = THEME_LABELS[language]?.[preference] ?? THEME_LABELS['zh-Hant'][preference];
  document.querySelectorAll('[data-theme-select]').forEach((select) => {
    select.value = preference;
    select.setAttribute('aria-label', label);
    const icon = select.parentElement?.querySelector('[data-theme-select-icon]');
    if (icon) {
      icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + ICONS[preference] + '</svg>';
      icon.setAttribute('title', label);
    }
  });
}

function applyEffectiveTheme(preference) {
  const theme = getEffectiveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  updateThemeControl(preference);
}

export function applyThemePreference(preference) {
  const normalized = [DARK_THEME, LIGHT_THEME, SYSTEM_THEME].includes(preference)
    ? preference
    : SYSTEM_THEME;
  localStorage.setItem(THEME_STORAGE_KEY, normalized);
  applyEffectiveTheme(normalized);
}

function initTheme() {
  const preference = getStoredPreference();
  applyEffectiveTheme(preference);

  document.querySelectorAll('[data-theme-select]').forEach((select) => {
    if (select.dataset.themeBound) return;
    select.dataset.themeBound = '1';
    select.addEventListener('change', () => applyThemePreference(select.value));
  });

  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  mediaQuery?.addEventListener?.('change', () => {
    if (getStoredPreference() === SYSTEM_THEME) applyEffectiveTheme(SYSTEM_THEME);
  });
}

window.addEventListener('languagechange', () => updateThemeControl(getStoredPreference()));

initTheme();
