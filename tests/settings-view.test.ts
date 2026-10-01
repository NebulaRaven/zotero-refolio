import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { script } from './source.mts';
import { domFixture } from './dom-fixture.ts';
import { testGetString, testGetErrorMessage, testGetPreferenceOptionLabel } from './localization.ts';
import { spFeatureDefinitions, spFeatureGroups } from '../src/core/features.ts';
import { spFilterGraph } from '../src/core/graph.ts';

const prefix = 'extensions.zotero.stylepersonal';
const files = ['core/settingsSchema.ts', 'app/ui.ts', 'app/settingControls.ts', 'upstream/features/preferences/preferenceWindow.ts', 'app/preferences.ts'];
const sources = await Promise.all(files.map(file => script(new URL(`../src/${file}`, import.meta.url))));
const defaults = new Map<string, unknown>();
vm.runInNewContext(await fs.readFile(new URL('../addon/prefs.js', import.meta.url), 'utf8'), { pref: (key: string, value: unknown) => defaults.set(key, value) });
const descendants = (element): any[] => element.children.flatMap(child => [child, ...descendants(child)]);

async function mountSettings(prefs: Record<string, unknown> = {}, search?: any) {
  const store = new Map<string, unknown>(Object.entries(prefs));
  const observers = new Map<string, Array<() => void>>();
  const dom = domFixture(), container = new dom.Element('div');
  const win: any = new dom.Element('window'); win.document = dom.document; dom.document.defaultView = win;
  dom.document.querySelector = selector => selector === '#stylepersonal-settings' ? container : null;
  if (search) dom.document.getElementById = id => id === 'prefs-search' ? search : null;
  const context: vm.Context = {
    getString: testGetString, getErrorMessage: testGetErrorMessage, getPreferenceOptionLabel: testGetPreferenceOptionLabel,
    addon: { data: {}, api: {} }, config: { prefsPrefix: prefix, addonRef: 'stylepersonal' },
    getPref: key => store.get(key), setPref: (key, value) => store.set(key, value),
    readDefaultPreferences: () => defaults, spFeatureDefinitions, spFeatureGroups, spFilterGraph, spPublicationNames: () => [],
    spRenderManualRanks: () => () => {},
    Zotero: {
      Prefs: {
        registerObserver: (key, callback) => { observers.set(key, [...(observers.get(key) ?? []), callback]); return observers.size; },
        unregisterObserver() {}
      },
      Utilities: { Internal: { quit: restart => { context.restarted = restart; } } }
    }
  };
  vm.createContext(context);
  for (const source of sources) vm.runInContext(source, context);
  await context.registerPrefsScripts(win);
  const find = (key: string) => descendants(container).find(element => element.dataset.pref === key);
  const change = async element => { for (const listener of [...(element.listeners.get('change') ?? [])]) await listener({}); };
  const byClass = (name: string) => descendants(container).filter(element => element.classList.contains(name));
  const errorOf = element => {
    let row = element;
    while (row && !row.classList.contains('sp-field')) row = row.parentElement;
    return row?.children.find(child => child.className === 'sp-error');
  };
  const external = (key: string, value: unknown) => { store.set(key, value); for (const callback of observers.get(`${prefix}.${key}`) ?? []) callback(); };
  return { container, context, store, win, find, change, byClass, external, errorOf };
}

test('a switched-off feature greys out its settings and a switch change asks for a restart', async () => {
  const view = await mountSettings({ 'function.IFColumn.enable': false });
  const color = view.find('IFColumn.color');
  assert.equal(color.disabled, true);
  assert.equal(color.closest('.sp-feature-body').dataset.disabled, 'true');
  const [notice] = view.byClass('sp-restart');
  assert.equal(notice.hidden, true);
  const toggle = view.find('function.IFColumn.enable'); toggle.checked = true; await view.change(toggle);
  assert.equal(view.store.get('function.IFColumn.enable'), true);
  assert.equal(color.disabled, false);
  assert.equal(notice.hidden, false);
});

test('graph settings save without asking for a restart', async () => {
  const view = await mountSettings();
  const hide = view.find('graphView.hideIsolated'); hide.checked = true; await view.change(hide);
  assert.equal(view.store.get('graphView.hideIsolated'), true);
  assert.equal(view.byClass('sp-restart')[0].hidden, true);
});

test('only the selected journal provider shows its key and fields', async () => {
  const view = await mountSettings();
  const row = key => view.find(key).closest('.sp-field');
  assert.equal(row('easyscholar.secretKey').hidden, false);
  assert.equal(row('garden.apiKey').hidden, true);
  const source = view.find('publicationTagsColumn.source'); source.value = 'garden'; await view.change(source);
  assert.equal(row('easyscholar.secretKey').hidden, true);
  assert.equal(row('garden.apiKey').hidden, false);
});

test('numbers keep their stored type and invalid numbers are not saved', async () => {
  const view = await mountSettings();
  const max = view.find('IFColumn.max'); max.value = '20'; await view.change(max);
  assert.equal(view.store.get('IFColumn.max'), '20');
  const interval = view.find('recordInterval'); interval.value = '15'; await view.change(interval);
  assert.equal(view.store.get('recordInterval'), 15);
  interval.value = 'soon'; await view.change(interval);
  assert.equal(view.store.get('recordInterval'), 15);
  assert.equal(view.errorOf(interval).textContent, testGetString('ui-error-invalid-number'));
  assert.equal(view.errorOf(interval).hidden, false);
});

test('clearing or mistyping a text-stored number keeps the saved value and explains why next to the field', async () => {
  const view = await mountSettings();
  const max = view.find('IFColumn.max');
  max.value = ''; await view.change(max);
  assert.equal(view.store.has('IFColumn.max'), false);
  assert.equal(view.errorOf(max).hidden, false);
  max.value = ''; max.validity = { badInput: true }; await view.change(max);
  assert.equal(view.store.has('IFColumn.max'), false);
  max.validity = { badInput: false }; max.value = '0'; await view.change(max);
  assert.equal(view.store.has('IFColumn.max'), false);
  max.value = '20'; await view.change(max);
  assert.equal(view.store.get('IFColumn.max'), '20');
  assert.equal(view.errorOf(max).hidden, true);
});

test('an empty graph year still clears the filter', async () => {
  const view = await mountSettings({ 'graphView.minYear': '2001' });
  const min = view.find('graphView.minYear'); min.value = ''; await view.change(min);
  assert.equal(view.store.get('graphView.minYear'), '');
});

test('a switch changed elsewhere updates even when it was the last control clicked', async () => {
  const view = await mountSettings({ 'function.showAnnotationColorName.enable': false });
  const toggle = view.find('function.showAnnotationColorName.enable'); toggle.focus();
  view.external('function.showAnnotationColorName.enable', true);
  assert.equal(toggle.checked, true);
  assert.equal(view.find('annotationColorNameDirection').disabled, false);
});

test('a text field being typed in keeps its text until the window loses focus', async () => {
  const view = await mountSettings();
  const max = view.find('IFColumn.max'); max.focus(); max.value = '2';
  view.win.document.hasFocus = () => true;
  view.external('IFColumn.max', '30'); assert.equal(max.value, '2');
  view.win.document.hasFocus = () => false;
  view.external('IFColumn.max', '31'); assert.equal(max.value, '31');
});

test('settings read only at startup ask for a restart', async () => {
  for (const [key, value] of [['recordInterval', '15'], ['addTags.shortcut', 'Ctrl + G']]) {
    const view = await mountSettings();
    const input = view.find(key); input.value = value; await view.change(input);
    assert.equal(view.byClass('sp-restart')[0].hidden, false, key);
  }
  const view = await mountSettings();
  const recording = view.find('readingProgress.recordingEnabled'); recording.checked = true; await view.change(recording);
  assert.equal(view.byClass('sp-restart')[0].hidden, false);
});

test('auto colors save auto and custom colors save hex values', async () => {
  const view = await mountSettings();
  const color = view.find('textTagsColumn.textColor');
  const auto = color.parentElement.querySelectorAll('input').find(input => input.type === 'checkbox');
  assert.equal(auto.checked, true); assert.equal(color.disabled, true);
  auto.checked = false; for (const listener of [...auto.listeners.get('change')]) await listener({});
  assert.match(String(view.store.get('textTagsColumn.textColor')), /^#[0-9a-f]{6}$/);
  color.value = '#123456'; await view.change(color);
  assert.equal(view.store.get('textTagsColumn.textColor'), '#123456');
});

test('changes made elsewhere update the open settings page', async () => {
  const view = await mountSettings({ 'function.IFColumn.enable': false });
  view.external('function.IFColumn.enable', true);
  assert.equal(view.find('IFColumn.color').disabled, false);
  view.external('IFColumn.color', '#010203');
  assert.equal(view.find('IFColumn.color').value, '#010203');
});

test('restart now restarts Zotero', async () => {
  const view = await mountSettings();
  const button = view.byClass('sp-restart')[0].children.find(element => element.tagName === 'button');
  for (const listener of button.listeners.get('click')) listener({});
  assert.equal(view.context.restarted, true);
});

test('values outside the known options still render', async () => {
  const view = await mountSettings({ 'graphView.depth': '3' });
  assert.equal(view.find('graphView.depth').value, '3');
});

test('remounting does not duplicate groups and release removes everything it added', async () => {
  const view = await mountSettings();
  const count = view.byClass('main-section').length;
  assert.equal(count, spFeatureGroups.length + 1);
  view.context.addon.data.prefs.release();
  assert.equal(view.container.children.length, 0);
  await view.context.registerPrefsScripts(view.win);
  assert.equal(view.byClass('main-section').length, count);
  view.context.addon.data.prefs.release();
});

test('Zotero settings search expands more options and restores them afterwards', async () => {
  const search = new (domFixture().Element)('search-textbox');
  const view = await mountSettings({}, search);
  const more = view.byClass('sp-more');
  assert.ok(more.length > 3);
  more[0].open = true;
  search.value = 'opacity'; search.fire('input');
  assert.ok(more.every(details => details.open));
  search.value = ''; search.fire('command');
  assert.equal(more[0].open, true);
  assert.ok(more.slice(1).every(details => !details.open));
  view.context.addon.data.prefs.release();
  assert.equal(search.listeners.get('input').size, 0);
  assert.equal(search.listeners.get('command').size, 0);
  await view.context.registerPrefsScripts(view.win);
  assert.equal(search.listeners.get('input').size, 1);
  view.context.addon.data.prefs.release();
});
