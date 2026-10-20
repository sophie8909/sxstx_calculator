import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/features/local-records/controls.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?$/gm, '')
  .replace('export function mountLocalRecordControls', 'function mountLocalRecordControls');

class Node {
  constructor(tag, options = {}) {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    Object.assign(this, options);
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  dispatch(type) { this.listeners[type]?.({ target: this }); }
  get selectedOptions() { return this.children.filter((node) => node.value === this.value); }
}

function createControls({ initializeError = false, switchError = false, createError = false } = {}) {
  const calls = [];
  let state = { activeId: 'one', records: [{ id: 'one', name: 'Primary' }, { id: 'two', name: 'Alt' }] };
  const container = new Node('div');
  container.append(new Node('old-content'));
  const t = (key, values = {}) => key === 'local_record_default' ? `Record ${values.number}` : key;
  const context = vm.createContext({
    t,
    element: (tag, options, children = []) => {
      const node = new Node(tag);
      for (const [key, value] of Object.entries(options || {})) {
        if (key === 'className') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key.startsWith('data-')) node.setAttribute?.(key, value) ?? (node[key] = value);
        else node[key] = value;
      }
      node.append(...children.filter(Boolean));
      return node;
    },
    initializeLocalRecords: () => {
      calls.push('initialize');
      if (initializeError) throw new Error('storage');
      return state;
    },
    renameLocalRecord: (name) => {
      calls.push(`rename:${name}`);
      state = { ...state, records: state.records.map((record) => record.id === state.activeId ? { ...record, name: name.trim() } : record) };
      return state;
    },
    switchLocalRecord: (id) => {
      calls.push(`switch:${id}`);
      if (switchError) throw new Error('storage');
      state = { ...state, activeId: id };
      return state;
    },
    createLocalRecord: (name) => {
      calls.push(`create:${name}`);
      if (createError) throw new Error('storage');
      state = { activeId: 'new', records: [...state.records, { id: 'new', name }] };
      return state;
    },
  });
  vm.runInContext(`${source}\nmountLocalRecordControls`, context);
  const mount = vm.runInContext('mountLocalRecordControls', context);
  const events = [];
  const controls = mount(container, {
    beforeSwitch: () => events.push('flush'),
    reload: () => events.push('reload'),
  });
  const walk = (node) => [node, ...node.children.flatMap(walk)];
  const nodes = walk(controls);
  return {
    calls, container, controls, events, nodes,
    select: nodes.find((node) => node.tagName === 'select'),
    input: nodes.find((node) => node.tagName === 'input'),
    button: nodes.find((node) => node.tagName === 'button'),
    status: nodes.find((node) => node.role === 'status'),
  };
}

test('renames persist in place, while blank names restore the saved value', () => {
  const ui = createControls();
  const input = ui.input;
  input.value = '  New Name  ';
  input.dispatch('input');
  assert.deepEqual(ui.calls, ['initialize', 'rename:  New Name  ']);
  assert.equal(input.value, '  New Name  ');
  assert.equal(ui.select.selectedOptions[0].textContent, 'New Name');
  assert.equal(ui.container.children[0], ui.controls);

  input.value = '   ';
  input.dispatch('input');
  input.dispatch('change');
  assert.equal(input.value, 'New Name');
  assert.deepEqual(ui.calls, ['initialize', 'rename:  New Name  ']);
});

test('switch and add flush pending inputs before changing records and reload only after success', () => {
  const switched = createControls();
  switched.select.value = 'two';
  switched.select.dispatch('change');
  assert.deepEqual(switched.events, ['flush', 'reload']);
  assert.deepEqual(switched.calls, ['initialize', 'switch:two']);

  const added = createControls();
  added.button.dispatch('click');
  assert.deepEqual(added.events, ['flush', 'reload']);
  assert.deepEqual(added.calls, ['initialize', 'create:Record 3']);
});

test('storage failures retain active selection and do not reload', () => {
  const ui = createControls({ switchError: true });
  ui.select.value = 'two';
  ui.select.dispatch('change');
  assert.equal(ui.select.value, 'one');
  assert.deepEqual(ui.events, ['flush']);
  assert.equal(ui.status.textContent, 'local_record_error');

  const added = createControls({ createError: true });
  added.button.dispatch('click');
  assert.deepEqual(added.events, ['flush']);
  assert.equal(added.status.textContent, 'local_record_error');
});

test('mount replaces container content, initialization errors disable controls, and controls have no IDs', () => {
  const ui = createControls();
  assert.equal(ui.container.children.length, 1);
  assert.equal(ui.container.children[0], ui.controls);
  assert.ok(ui.nodes.every((node) => !node.id));

  const failed = createControls({ initializeError: true });
  assert.equal(failed.select.disabled, true);
  assert.equal(failed.input.disabled, true);
  assert.equal(failed.button.disabled, true);
  assert.equal(failed.status.textContent, 'local_record_error');
});
