const ICONS = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'calendar-clock': '<path d="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18"/><circle cx="16" cy="16" r="4"/><path d="M16 14v2l1.5 1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  swords: '<path d="m14.5 17.5 3 3M3 3l7.5 7.5M14 6l4-4 2 2-4 4M3 21l4-4M14.5 6.5l3 3M3 3l4 4M14 18l-4 4-2-2 4-4"/>',
  sparkles: '<path d="m12 3-1.2 4.3L7 8.5l3.8 1.2L12 14l1.2-4.3L17 8.5l-3.8-1.2L12 3ZM19 14l-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7L19 14ZM5 14l-.7 2.3L2 17l2.3.7L5 20l.7-2.3L8 17l-2.3-.7L5 14Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  'user-round-plus': '<path d="M18 20a6 6 0 0 0-12 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6"/>',
  'file-pen': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18l5-5 2 2-5 5-3 1z"/>',
  gem: '<path d="M6 3h12l4 5-10 13L2 8zM2 8h20M12 21 8 8l4-5 4 5-4 13"/>',
  comet: '<path d="M15.5 15.5 4 4M13 5l6-2-2 6M5 13l-2 6 6-2M17 7l-4 4M11 13l-4 4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  'paw-print': '<path d="M8 14s-2 0-3 2 0 4 2 4h10c2 0 3-2 2-4s-3-2-3-2M7 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM14 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM22 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>',
  'shopping-cart': '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.5 11h11L21 8H6"/>',
  package: '<path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  'clipboard-check': '<path d="M9 5h6M9 3h6v4H9zM5 5H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1"/><path d="m8 14 2 2 5-5"/>',
  hammer: '<path d="m15 12 4.5-4.5M13 4l7 7M3 21l9-9M5 3l6 6M3 7l4-4 8 8-4 4z"/>',
  medal: '<circle cx="12" cy="8" r="6"/><path d="m8.5 13.5-1 8.5 4.5-3 4.5 3-1-8.5"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.5-2.5V8ZM12 8h4.5A2.5 2.5 0 1 0 14 5.5V8Z"/>',
  coins: '<circle cx="8" cy="8" r="5"/><path d="M8 3v10M3 8h10M16 11a5 5 0 1 1-3 8M16 14v6M13 17h6"/>',
  boxes: '<path d="m7 3 5 3 5-3M12 6v6M3 8l5 3 5-3 5 3 5-3M3 8v8l5 3 5-3 5 3 5-3V8M8 11v8M17 11v8"/>',
  lightbulb: '<path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z"/>',
  'book-open': '<path d="M2 4h6a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H2zM22 4h-6a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h6z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
};

function addTitleIcons() {
  document.querySelectorAll('[data-title-icon]').forEach((title) => {
    const name = title.dataset.titleIcon;
    if (title.querySelector('.title-icon') || !ICONS[name]) return;
    const icon = document.createElement('span');
    icon.className = 'title-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${ICONS[name]}</svg>`;
    title.prepend(icon);
  });
}

const iconObserver = new MutationObserver(() => addTitleIcons());

document.addEventListener('DOMContentLoaded', () => {
  addTitleIcons();
  iconObserver.observe(document.body, { childList: true, subtree: true });
});

window.addEventListener('languagechange', addTitleIcons);
