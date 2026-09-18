import { testGetString, testGetErrorMessage } from './localization.ts';
import { script } from './source.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { domFixture } from './dom-fixture.ts';

test('graph resizing captures the pointer, enforces minimum height, saves on release and supports the keyboard', async () => {
  const events = new Map(), attributes = new Map(), saved = [];
  let captured;
  const handle = { setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
    setPointerCapture: id => captured = id, hasPointerCapture: id => captured === id, releasePointerCapture: () => captured = undefined };
  const container = { style: {} as Record<string, string>, parentElement: { clientHeight: 1000 }, getBoundingClientRect: () => ({ height: parseFloat(container.style.height) || 500 }) };
  const view = { cleanups: [] };
  const ctx: vm.Context = { setPref: (key, value) => saved.push([key, value]), getString: testGetString, getErrorMessage: testGetErrorMessage };
  vm.runInNewContext(await script(new URL('../src/app/graphControls.ts', import.meta.url)), ctx);
  ctx.spMakeGraphResizable(view, container, handle, 200);
  events.get('pointerdown')({ button: 0, pointerId: 7, clientY: 100, preventDefault() {} });
  events.get('pointermove')({ pointerId: 7, clientY: 500 });
  assert.equal(container.style.height, '200px'); assert.equal(saved.length, 0);
  events.get('pointerup')(); assert.equal(captured, undefined);
  assert.deepEqual(saved, [['graphView.height', '200px']]);
  events.get('keydown')({ key: 'ArrowUp', preventDefault() {} });
  assert.equal(container.style.height, '220px'); assert.equal(attributes.get('aria-valuenow'), 22);
  assert.equal(attributes.get('aria-valuetext'), '220 pixels');
  view.cleanups[0](); assert.equal(events.size, 0);
});

test('graph watches actual iframe size changes and disconnects the observer on cleanup', async () => {
  let notify, observed, disconnected = false, resized = 0;
  const renderer = { containerEl: { style: {} as Record<string, string> }, onResize() { resized++; } };
  const frame = { contentWindow: { renderer }, addEventListener() {}, removeEventListener() {} };
  const selection = { addListener() {}, removeListener() {} };
  const ctx: vm.Context = { ZoteroPane: { itemsView: { onSelect: selection } }, requireItemsView: () => ({ onSelect: selection }),
    window: { ResizeObserver: class { constructor(fn) { notify = fn; } observe(target) { observed = target; } disconnect() { disconnected = true; } } } };
  vm.runInNewContext(await script(new URL('../src/upstream/features/collections/graphView.ts', import.meta.url)), ctx);
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, cleanups: [], refreshGraphView: async () => {} });
  await view.initIFrame(frame); assert.equal(observed, frame);
  notify(); assert.equal(resized, 1);
  view.active = false; notify(); assert.equal(resized, 1);
  view.cleanups.forEach(cleanup => cleanup()); assert.equal(disconnected, true);
});

async function controlsFixture() {
  const dom = domFixture(), container = new dom.Element();
  const preferences = new Map<string, unknown>([['graphView.mode', 'citations']]);
  let fetched = 0, fitted = 0, prompted = 0;
  const saved: number[][] = [];
  const items = [1, 2].map(id => ({ id, libraryID: 1, key: `KEY${id}`, isRegularItem: () => true, getDisplayTitle: () => `Paper ${id}` }));
  const ctx: vm.Context = { getString: testGetString, getErrorMessage: testGetErrorMessage, config: { addonRef: 'stylepersonal' },
    getPref: key => preferences.get(key), setPref: (key, value) => preferences.set(key, value),
    spFetchCitationRelations: async () => { fetched++; return true; }, getFirstSelectedLibraryID: () => 1,
    spCitationLibraryItems: async () => items, ZoteroPane: { getSelectedItems: () => items },
    spAddManualCitation: async (...ids) => { saved.push(ids); return true; }
  };
  for (const file of ['ui', 'manualCitations', 'graphControls']) vm.runInNewContext(await script(new URL(`../src/app/${file}.ts`, import.meta.url)), ctx);
  const view = { active: true, mode: 'citations', modeFunction: { citations() {}, note() {}, author() {}, tag() {} },
    cleanups: [], status: undefined, syncControls: undefined,
    refreshGraphView: async () => {}, setTheme() {}, fitGraph() { fitted++; }, promptForCitationRelations: async () => { prompted++; }
  };
  ctx.spBuildGraphControls(view, container);
  const click = async element => { for (const listener of element.listeners.get('click') || []) await listener(); };
  const button = label => container.querySelectorAll('button').find(element => element.textContent === label);
  return { dom, ctx, view, container, preferences, saved, click, button,
    get fetched() { return fetched; }, get fitted() { return fitted; }, get prompted() { return prompted; } };
}

test('graph views and actions occupy separate controls and view switches do not fetch citation data', async () => {
  const f = await controlsFixture();
  const tabs = f.container.querySelector('.sp-graph-modes'), actions = f.container.querySelector('.sp-graph-actions');
  assert.notEqual(tabs.parentElement, actions.parentElement);
  for (const button of tabs.children) assert.equal(button.getAttribute('role'), 'tab');
  for (const button of actions.children) {
    assert.equal(button.dataset.mode, undefined); assert.equal(button.getAttribute('aria-selected'), null);
  }
  await f.click(f.button('Fit')); assert.equal(f.fitted, 1); assert.equal(f.view.mode, 'citations');
  await f.click(f.button('Update citations')); assert.equal(f.fetched, 1);
  const notes = tabs.children.find(button => button.dataset.mode === 'note');
  const citations = tabs.children.find(button => button.dataset.mode === 'citations');
  await f.click(notes); await f.click(citations);
  assert.equal(f.fetched, 1); assert.equal(f.prompted, 1);
  await f.click(citations); assert.equal(f.prompted, 1, 'The active tab is not a fresh entry');
});

test('every graph view can be hidden and restored, including when all views are hidden', async () => {
  const f = await controlsFixture();
  const tabs = f.container.querySelector('.sp-graph-modes');
  f.preferences.set('graphView.modes.citations', false); f.view.syncControls();
  assert.equal(f.view.mode, 'note'); assert.equal(tabs.children[0].hidden, true);
  for (const mode of ['note', 'author', 'tag']) f.preferences.set(`graphView.modes.${mode}`, false);
  f.view.syncControls(); assert.equal(f.view.mode, undefined);
  assert.ok(tabs.children.every(button => button.hidden));
  assert.equal((f.button('Fit') as any).disabled, true);
  f.preferences.set('graphView.modes.citations', true); f.view.syncControls();
  assert.equal(f.view.mode, 'citations'); assert.equal(tabs.children[0].hidden, false);
  f.preferences.set('graphView.modes.author', true); f.preferences.set('graphView.mode', 'author'); f.view.syncControls();
  assert.equal(f.view.mode, 'author', 'Settings must update the active view immediately');
});

test('native dropdown commands select and save the chosen value exactly once', async () => {
  const f = await controlsFixture();
  const menu = f.ctx.spSelect(f.dom.document, f.container);
  f.ctx.spSelectOptions(menu, [['ask', 'Ask'], ['update', 'Update'], ['skip', 'Skip']], 'ask');
  const chosen: string[] = [];
  menu.addEventListener('change', () => chosen.push(menu.value));
  const options = menu.querySelectorAll('menuitem');
  menu.fire('command', { target: options[2] });
  assert.equal(menu.value, 'skip'); assert.deepEqual(chosen, ['skip']);
  assert.equal(menu.localName, 'menulist'); assert.equal(menu.getAttribute('native'), 'true');
  assert.equal(menu.children[0].localName, 'menupopup');
  f.ctx.spSelectOptions(menu, [['update', 'Update']], 'update');
  assert.equal(menu.querySelectorAll('menuitem').length, 1); assert.deepEqual(chosen, ['skip']);
});

test('manual citation controls prefill selected papers, allow direction changes and save the selected direction', async () => {
  const f = await controlsFixture();
  await f.click(f.button('Add citation'));
  const panel = f.container.querySelector('.sp-manual-citation');
  assert.equal(panel.hidden, false);
  const fields = panel.querySelectorAll('menulist');
  assert.deepEqual(fields.map(field => field.value), ['1', '2']);
  await f.click(f.button('Swap direction'));
  assert.deepEqual(fields.map(field => field.value), ['2', '1']);
  await f.click(f.button('Save'));
  assert.deepEqual(f.saved, [[2, 1]]); assert.equal(panel.hidden, true);
  assert.equal(panel.children.length, 0);
});
