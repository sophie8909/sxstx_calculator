import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/form-relay.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function createRelay(values = {}, submitError = false) {
  const fields = new Map();
  const add = (id, value = '') => fields.set(id, { value, classList: { add() {} } });
  for (const id of ['server-name', 'server-name-other', 'server-number', 'season', 'description', 'time-year', 'time-month', 'time-day']) {
    add(`field-${id}`);
  }
  for (const [id, value] of Object.entries({
    'relay-server-name': '新合服界域、獅子連斬',
    'relay-server-name-manual': '',
    'relay-server-number': '6000101',
    'relay-season': 'S5',
    'relay-date': '2026-10-07',
    'relay-description-category': '【賽季開始】',
    'relay-description': 'automatic description',
    ...values,
  })) add(id, value);
  add('relay-feedback');
  let submissions = 0;
  fields.set('google-form-relay', { submit() {
    if (submitError) throw new Error('Submission unavailable');
    submissions += 1;
  } });
  const context = vm.createContext({
    document: { getElementById: (id) => fields.get(id), addEventListener() {} },
    window: { addEventListener() {} },
    t: (key) => key,
  });
  vm.runInContext(source.replace(/^import .*;\r?$/gm, ''), context);
  return { fields, submit: () => vm.runInContext('submitRelayForm()', context), submissions: () => submissions };
}

test('listed server names use Google Forms Other encoding, including names absent from its fixed choices', () => {
  const relay = createRelay();
  relay.submit();
  const value = (id) => relay.fields.get(`field-${id}`).value;
  assert.equal(relay.submissions(), 1);
  assert.equal(value('server-name'), '__other_option__');
  assert.equal(value('server-name-other'), '新合服界域、獅子連斬');
  assert.equal(value('server-number'), '6000101');
  assert.equal(value('season'), 'S5');
  assert.equal(value('description'), '【賽季開始】');
  assert.deepEqual(['time-year', 'time-month', 'time-day'].map(value), ['2026', '10', '7']);
  assert.equal(relay.fields.get('relay-feedback').textContent, 'relay_submit_check_response');
  assert.equal(relay.fields.get('relay-description').value, 'automatic description');
});

test('manual servers and free descriptions retain their values', () => {
  const relay = createRelay({
    'relay-server-name': '', 'relay-server-name-manual': '  新界域　名稱  ',
    'relay-description-category': '', 'relay-description': '  自訂目標  ',
  });
  relay.submit();
  assert.equal(relay.submissions(), 1);
  assert.equal(relay.fields.get('field-server-name').value, '__other_option__');
  assert.equal(relay.fields.get('field-server-name-other').value, '新界域 名稱');
  assert.equal(relay.fields.get('field-description').value, '自訂目標');
});

test('invalid input does not submit and submission errors preserve user input', () => {
  const invalid = createRelay({ 'relay-server-number': '123' });
  invalid.submit();
  assert.equal(invalid.submissions(), 0);
  assert.equal(invalid.fields.get('relay-feedback').textContent, 'relay_validation_required');
  const failed = createRelay({}, true);
  failed.submit();
  assert.equal(failed.fields.get('relay-feedback').textContent, 'exp_required_submit_failed');
  assert.equal(failed.fields.get('relay-description').value, 'automatic description');
});

test('Google response is visible and iframe loads can no longer claim contribution success', () => {
  const form = html.match(/<form\s+id="google-form-relay"[\s\S]*?<\/form>/)?.[0] || '';
  assert.match(form, /action="https:\/\/docs\.google\.com\/forms\/d\/e\/[^"/]+\/formResponse"/);
  assert.match(form, /method="POST"/);
  assert.match(form, /target="_blank"/);
  assert.match(form, /rel="noopener"/);
  assert.match(form, /name="entry\.1531554423\.other_option_response" id="field-server-name-other"/);
  assert.doesNotMatch(html + source, /google-form-relay-target|__relaySubmitted|relay-success-panel|relay_submit_success/);
});
