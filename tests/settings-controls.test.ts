import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { domFixture } from './dom-fixture.ts';
import { testGetString, testGetPreferenceOptionLabel } from './localization.ts';

const sources = await Promise.all(['core/settingsSchema.ts', 'app/ui.ts', 'app/settingControls.ts']
  .map(file => script(new URL(`../src/${file}`, import.meta.url))));
function harness() {
  const dom = domFixture();
  const context: vm.Context = { getString: testGetString, getPreferenceOptionLabel: testGetPreferenceOptionLabel, config: { addonRef: 'stylepersonal' } };
  vm.createContext(context);
  for (const source of sources) vm.runInContext(source, context);
  const parent = new dom.Element('label');
  return { parent, build: setting => context.spSettingControl(dom.document, parent, setting), context };
}

test('number controls allow any step by default and keep the text the user typed', () => {
  const { build } = harness();
  const control = build({ key: 'IFColumn.max', label: 'pref-IFColumn-max', kind: 'number', min: 0 });
  assert.equal(control.input.type, 'number');
  assert.equal(control.input.step, 'any');
  assert.equal(control.input.min, '0');
  assert.equal(control.input.getAttribute('aria-label'), testGetString('pref-IFColumn-max'));
  control.write('0.455'); assert.equal(control.read(), '0.455');
});

test('choices translate their labels and keep literal ones', () => {
  const { build } = harness();
  const control = build({ key: 'x', label: 'ui-node-label', kind: 'choice', choices: [['absolute'], ['title', 'ui-title'], ['8', 'UTC+8']] });
  const labels = control.input.querySelectorAll('menuitem').map(item => item.getAttribute('label'));
  assert.deepEqual(labels, [testGetPreferenceOptionLabel('absolute'), testGetString('ui-title'), 'UTC+8']);
  control.write('8'); assert.equal(control.read(), '8');
});

test('auto colors disable the picker and read back as auto', () => {
  const { build, parent } = harness();
  const control = build({ key: 'textTagsColumn.textColor', label: 'pref-textTagsColumn-textColor', kind: 'color', allowAuto: true });
  const auto: any = parent.querySelectorAll('input').find((input: any) => input.type === 'checkbox');
  const shown = parent.querySelector('.sp-color-value');
  control.write('auto');
  assert.equal(auto.checked, true); assert.equal(control.input.disabled, true);
  assert.equal(control.read(), 'auto'); assert.equal(shown.textContent, testGetString('ui-color-auto'));
  assert.match(control.input.value, /^#[0-9a-f]{6}$/);
  let changes = 0; control.onChange(() => changes++);
  auto.checked = false; auto.fire('change');
  assert.equal(control.input.disabled, false); assert.equal(control.read(), control.input.value); assert.equal(changes, 1);
  control.setDisabled(true); assert.equal(auto.disabled, true); assert.equal(control.input.disabled, true);
});

test('stored short or invalid colors show as six-digit hex', () => {
  const { build } = harness();
  const control = build({ key: 'IFColumn.color', label: 'pref-IFColumn-color', kind: 'color' });
  control.write('#ABC'); assert.equal(control.input.value, '#aabbcc'); assert.equal(control.read(), '#aabbcc');
  control.write('teal'); assert.equal(control.input.value, '#000000');
});

test('secrets, code and toggles use the matching native element', () => {
  const { build } = harness();
  assert.equal(build({ key: 'garden.apiKey', label: 'ui-api-key', labelArgs: { provider: 'Garden' }, kind: 'secret' }).input.type, 'password');
  const code = build({ key: 'styleEditor.value', label: 'pref-styleEditor-value', kind: 'code' });
  assert.equal(code.input.localName, 'textarea'); assert.equal(code.input.className, 'sp-code');
  const toggle = build({ key: 'tldr.autoTranslate', label: 'pref-tldr-autoTranslate', kind: 'toggle' });
  toggle.write(true); assert.equal(toggle.read(), true);
});

test('labels translate their arguments', () => {
  const { context } = harness();
  assert.equal(context.spSettingLabel({ label: 'ui-show-graph-view', labelArgs: { view: 'ui-mode-citations' } }),
    testGetString('ui-show-graph-view', { args: { view: testGetString('ui-mode-citations') } }));
  assert.equal(context.spSettingLabel({ label: 'ui-api-key', labelArgs: { provider: 'Garden' } }),
    testGetString('ui-api-key', { args: { provider: 'Garden' } }));
});
