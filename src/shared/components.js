export function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('data-')) node.setAttribute(key, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
  node.append(...children.filter(Boolean));
  return node;
}

export function icon(name) {
  const icons = {
    primordial: '<path d="M12 3 10.7 7.7 6 9l4.7 1.3L12 15l1.3-4.7L18 9l-4.7-1.3L12 3Z"/><path d="m5 15-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7L5 15Z"/>',
    equipment: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5A2.5 2.5 0 1 1 10 5.5V8ZM12 8h4.5A2.5 2.5 0 1 0 14 5.5V8Z"/>',
    rally: '<path d="M5 21V4m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0"/><path d="M2 21h7"/>',
    contribution: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    status: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  };
  const node = element('span', { className: 'app-icon', ariaHidden: 'true' });
  node.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${icons[name] || icons.primordial}</svg>`;
  return node;
}

export function navButton({ label, shortLabel, iconName, page }) {
  const button = element('button', {
    type: 'button', className: 'calculator-nav-btn app-nav-item', 'data-page': page, ariaLabel: label,
  }, [icon(iconName)]);
  button.append(
    element('span', { className: 'app-nav-label', text: label }),
    element('span', { className: 'app-nav-short-label', text: shortLabel || label })
  );
  return button;
}

export function featureTabs({ id, labels, onChange }) {
  const tabList = element('div', {
    className: 'feature-tabs', role: 'tablist', ariaLabel: labels.map((item) => item.label).join(' / '),
  });
  const panels = [];

  labels.forEach((item, index) => {
    const tabId = `${id}-tab-${item.id}`;
    const panelId = `${id}-panel-${item.id}`;
    const button = element('button', {
      type: 'button', className: 'feature-tab', text: item.label, id: tabId, role: 'tab',
      ariaControls: panelId, ariaSelected: String(index === 0), tabIndex: index === 0 ? 0 : -1,
      'data-tab': item.id,
    });
    const panel = element('section', {
      className: 'feature-tab-panel', id: panelId, role: 'tabpanel', ariaLabelledby: tabId, hidden: index !== 0,
    });
    panels.push(panel);
    tabList.appendChild(button);
  });

  const activate = (tabId, { focus = false } = {}) => {
    const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
    buttons.forEach((button, index) => {
      const active = button.dataset.tab === tabId;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      panels[index].hidden = !active;
      if (active && focus) button.focus();
    });
    onChange?.(tabId);
  };

  tabList.addEventListener('click', (event) => {
    const button = event.target.closest('[role="tab"]');
    if (button) activate(button.dataset.tab);
  });
  tabList.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const current = buttons.indexOf(document.activeElement);
    let next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : current;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    activate(buttons[next].dataset.tab, { focus: true });
  });

  return { tabList, panels, activate };
}

export function emptyState(title, description) {
  return element('div', { className: 'empty-state' }, [
    element('span', { className: 'empty-state-icon', text: '--', ariaHidden: 'true' }),
    element('h3', { text: title }),
    element('p', { text: description }),
  ]);
}

export function confirmationNotice(message) {
  const notice = element('div', { className: 'transfer-notice', role: 'status', text: message });
  window.setTimeout(() => notice.remove(), 3200);
  return notice;
}
