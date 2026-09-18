import { testGetString, testGetErrorMessage, testGetPreferenceOptionLabel } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { spRelatedGraph } from '../src/core/graph.ts';
import { domFixture } from './dom-fixture.ts';

const root = new URL('../src/', import.meta.url);
async function load(context: vm.Context, ...files: string[]) {
  for (const file of files) vm.runInNewContext(await script(new URL(file, root)), context);
  return context;
}
function deferred<T = unknown>() {
  let resolve: (value: T) => void, reject: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve: resolve!, reject: reject! };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function timers() {
  let id = 0;
  const pending = new Map<number, () => unknown>();
  return {
    pending,
    setTimeout(fn: () => unknown) { pending.set(++id, fn); return id; },
    clearTimeout(key: number) { pending.delete(key); },
    async fire(key: number) { const fn = pending.get(key); pending.delete(key); await fn?.(); await settle(); }
  };
}

test('related-item indexing scales with items and links and keeps library identities separate', () => {
  let keyReads = 0;
  const items = Array.from({ length: 10000 }, (_, id) => ({ id, libraryID: 1,
    get key() { keyReads++; return String(id); }, relatedItems: [String(id + 1)] }));
  const graph = spRelatedGraph(items);
  assert.equal(Object.keys(graph.nodes).length, 10000);
  assert.equal(keyReads, 10000);
  assert.deepEqual(graph.nodes[0].links, { 1: true });
  assert.deepEqual(graph.nodes[9999].links, {});
  const mixed = spRelatedGraph([
    { id: 1, libraryID: 1, key: 'A', relatedItems: ['A', 'B', 'missing'] },
    { id: 2, libraryID: 1, key: 'B', relatedItems: [] },
    { id: 3, libraryID: 2, key: 'B', relatedItems: [] }
  ]);
  assert.deepEqual(mixed.nodes[1].links, { 2: true });
});

test('graph selection bursts coalesce and hidden graphs do not schedule work', async () => {
  const clock = timers(); let refreshed = 0;
  const ctx = await load({ window: clock, ztoolkit: { log: assert.fail } }, 'upstream/features/collections/graphView.ts');
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, timers: new Set(), container: { style: { display: '' } }, mode: 'related',
    refreshGraphView: async () => { refreshed++; } });
  for (let i = 0; i < 100; i++) view.queueSelectionRefresh();
  assert.equal(clock.pending.size, 1);
  await clock.fire([...clock.pending.keys()][0]);
  assert.equal(refreshed, 1);
  view.container.style.display = 'none'; view.queueSelectionRefresh();
  assert.equal(clock.pending.size, 0);
});

test('graph removes selection listeners from the original view after the host replaces it', async () => {
  const listeners = new Set(); let destroyed = 0;
  const original = { onSelect: { addListener: fn => { listeners.add(fn); }, removeListener: fn => { listeners.delete(fn); } } };
  let current = original;
  const renderer = { containerEl: { style: {} }, destroy() { destroyed++; } };
  const ctx = await load({ window: { removeEventListener() {}, ResizeObserver: class { observe() {} disconnect() {} } },
    addon: { api: {} }, ZoteroPane: { itemsView: original }, requireItemsView: () => current }, 'upstream/features/collections/graphView.ts');
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, cleanups: [], timers: new Set(), animationFrames: new Set(),
    container: { remove() {} }, refreshGraphView: async () => {} });
  await view.initIFrame({ contentWindow: { renderer }, addEventListener() {}, removeEventListener() {} });
  assert.equal(listeners.size, 1);
  current = { onSelect: { addListener() {}, removeListener() { assert.fail('Wrong selection owner'); } } };
  view.destroy(); view.destroy();
  assert.equal(listeners.size, 0); assert.equal(destroyed, 1);
});

test('a collapsed graph creates no renderer and concurrent opening shares one initialization', async () => {
  let loads = 0; const ready = deferred<void>();
  const element = () => ({ style: {}, append() {}, insertBefore() {}, setAttribute() { loads++; } });
  const ctx = await load({ document: { querySelectorAll: () => [], querySelector: () => element() },
    getPref: key => key === 'graphView.enable' ? false : '300px', config: { addonRef: 'stylepersonal' },
    ztoolkit: { UI: { createElement: (_doc, tag, options) => ({ ...element(), style: options.styles || {} }) } },
    spElement: element, spBuildGraphControls() {}, spMakeGraphResizable() {} }, 'upstream/features/collections/graphView.ts');
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, getTheme: () => 'light', setTheme() {}, initIFrame: () => ready.promise });
  await view.createContainer(); assert.equal(loads, 0);
  const first = view.ensureRenderer(); const second = view.ensureRenderer();
  assert.equal(first, second); assert.equal(loads, 1);
  ready.resolve(); await first;
});

test('shared hooks install once, restore on the last release and capture new host hooks on reload', async () => {
  const clock = timers(); let filters = 0, menus = 0;
  let receivedOptions;
  const original = async (options?) => { receivedOptions = options; return ['first']; };
  const prototype = { getItems: original };
  const menu = () => 'menu-result'; const itemsView = { _displayColumnPickerMenu: menu };
  const ctx = await load({ window: clock, requireItemsView: () => itemsView,
    Zotero: { CollectionTreeRow: { prototype } }, addon: { data: { alive: true, patch: {
      getItems: { data: [items => { filters++; return items; }] }, _displayColumnPickerMenu: { data: [() => menus++] }
    } } } }, 'upstream/utils/ownedResource.ts', 'upstream/platform/zotero/patches.ts');
  const a = ctx.patchAll(), installed = prototype.getItems, b = ctx.patchAll();
  assert.equal(prototype.getItems, installed);
  assert.deepEqual(await prototype.getItems(), ['first']); assert.equal(filters, 1);
  await prototype.getItems({ unfiltered: true }); assert.deepEqual(receivedOptions, { unfiltered: true }); assert.equal(filters, 1);
  assert.equal(itemsView._displayColumnPickerMenu(), 'menu-result'); itemsView._displayColumnPickerMenu();
  assert.equal(clock.pending.size, 1); await clock.fire([...clock.pending.keys()][0]); assert.equal(menus, 1);
  a(); a(); assert.equal(prototype.getItems, installed);
  b(); assert.equal(prototype.getItems, original); assert.equal(itemsView._displayColumnPickerMenu, menu);
  const newer = async () => ['newer']; prototype.getItems = newer;
  const c = ctx.patchAll(); assert.deepEqual(await prototype.getItems(), ['newer']);
  c(); assert.equal(prototype.getItems, newer);
});

test('notifier callbacks queued before unregister do no work after cleanup', async () => {
  let observer, notified = 0, removed = 0;
  const ctx = await load({ window: { addEventListener() {}, removeEventListener() {} }, addon: { data: { alive: true } },
    Zotero: { Notifier: { registerObserver(value) { observer = value; return 1; }, unregisterObserver() { removed++; } } } },
    'upstream/platform/zotero/notifier.ts');
  const stop = ctx.registerNotify(['item'], () => notified++);
  await observer.notify(); stop(); stop(); await observer.notify();
  assert.equal(notified, 1); assert.equal(removed, 1);
});

async function storageFixture(write: (text: string) => Promise<unknown>) {
  const clock = timers();
  const ctx = await load({ window: clock, Zotero: { File: { putContentsAsync: (_file, text) => write(text) } },
    getPref: () => true, ztoolkit: { log: assert.fail } }, 'upstream/platform/persistence/storage.ts');
  const storage = Object.create(ctx.LocalStorage.prototype);
  Object.assign(storage, { disposed: false, writeVersion: 0, lock: { promise: Promise.resolve() }, filename: 'fixture.json', cache: {} });
  return { storage, clock };
}

test('local storage serializes writes and drains newer changes before disposal finishes', async () => {
  const writes: Array<{ text: string; done: ReturnType<typeof deferred<void>> }> = [];
  const { storage, clock } = await storageFixture(text => { const done = deferred<void>(); writes.push({ text, done }); return done.promise; });
  const item = { key: 'A' };
  await storage.set(item, 'value', 1); const first = storage.flush();
  await storage.set(item, 'value', 2); assert.equal(storage.flush(), first);
  const disposal = storage.dispose(); await settle(); assert.equal(writes.length, 1);
  writes[0].done.resolve(); await settle(); assert.equal(writes.length, 2);
  assert.equal(JSON.parse(writes[1].text).A.value, 2);
  writes[1].done.resolve(); await disposal;
  assert.equal(storage.writeVersion, 0); assert.equal(clock.pending.size, 0);
});

test('failed storage writes remain dirty and can be retried', async () => {
  let attempts = 0;
  const { storage } = await storageFixture(async () => { if (++attempts === 1) throw new Error('disk'); });
  await storage.set({ key: 'A' }, 'value', 'kept');
  await assert.rejects(storage.flush(), /disk/);
  assert.equal(storage.cache.A.value, 'kept'); assert.ok(storage.writeVersion > 0);
  await storage.flush(); assert.equal(storage.writeVersion, 0); assert.equal(attempts, 2);
});

async function tagsFixture() {
  const clock = timers();
  const ctx = await load({ window: clock, addon: { api: {} }, getString: testGetString, ztoolkit: { log: assert.fail }, getElements: () => [] }, 'upstream/features/tags/tags.ts');
  ctx.Tags.prototype.prepare = () => {};
  return { tags: new ctx.Tags(), clock };
}

test('nested tags share the item filter, use Zotero 10 search scopes and release pending work', async () => {
  const filters = [], listeners = new Set(), searches = [];
  const scope = {}, scopeReady = deferred(), searchReady = deferred();
  let removedStyles = 0, searchCalls = 0;
  const hook = () => {};
  const ctx = await load({ window: timers(), getString: testGetString, document: { documentElement: { appendChild() {} } },
    ColorRNA_default: class { rgb() { return [1, 2, 3]; } },
    addon: { api: {}, hooks: { onCollectionSelect: hook }, data: { patch: { getItems: { data: filters } } } },
    requireCollectionsView: () => ({ onSelect: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } }),
    ztoolkit: { UI: { createElement: () => ({ remove: () => removedStyles++ }) }, log: assert.fail },
    Zotero: { Prefs: { get: () => false }, Search: class {
      constructor(options) { searches.push(options); }
      addCondition() {}
      setScope(value, children) { assert.equal(value, scope); assert.equal(children, true); }
      search() { searchCalls++; return searchReady.promise; }
    } } }, 'upstream/utils/ownedResource.ts', 'upstream/features/tags/tags.ts');
  const tags = new ctx.Tags();
  tags.getTagPrefixes = () => ['#A'];
  assert.equal(filters.length, 1); assert.equal(listeners.size, 1);
  const items = [{ id: 1 }, { id: 2 }];
  const row = { ref: { libraryID: 7 }, isFeeds: () => false, isTrash: () => false, getSearchObject: () => scopeReady.promise };
  const result = filters[0](items, row);
  scopeReady.resolve(scope); searchReady.resolve([2]);
  assert.deepEqual(await result, [items[1]]); assert.equal(searches[0].libraryID, 7);
  assert.equal(tags.collectionItems, items);
  const lateScope = deferred(); row.getSearchObject = () => lateScope.promise;
  const late = filters[0](items, row);
  tags.destroy(); lateScope.resolve(scope);
  assert.equal(await late, items); assert.equal(searchCalls, 1);
  assert.equal(filters.length, 0); assert.equal(listeners.size, 0); assert.equal(removedStyles, 1);
});

test('tag update bursts share one task, use the latest items and release the initial timer', async () => {
  const clock = timers(), filters = [], updates = [];
  const ctx = await load({ window: clock, getString: testGetString, Zotero: { Promise: { delay: async () => {} } },
    ZoteroPane: { tagSelector: {} }, addon: { api: {}, data: { alive: true, patch: { getItems: { data: filters } } } },
    getElements: () => [], ztoolkit: { log: assert.fail } }, 'upstream/utils/ownedResource.ts', 'upstream/features/tags/tags.ts');
  ctx.Tags.prototype.prepare = () => {};
  ctx.Tags.prototype.updateTagsIn = items => updates.push(items);
  const stop = await ctx.initTags({ aborted: false });
  assert.equal(clock.pending.size, 1);
  for (let i = 0; i < 100; i++) filters[0]([{ id: i }]);
  assert.equal(clock.pending.size, 2);
  await clock.fire([...clock.pending.keys()].at(-1));
  assert.deepEqual(updates, [[{ id: 99 }]]);
  filters[0]([]); await clock.fire([...clock.pending.keys()].at(-1));
  assert.deepEqual(updates.at(-1), []);
  stop(); assert.equal(clock.pending.size, 0); assert.equal(filters.length, 0);
});

test('tag refresh and teardown cancel all owned timers, including callbacks already dequeued', async () => {
  const { tags, clock } = await tagsFixture(); let ran = 0;
  const id = tags.schedule(() => ran++); const stale = clock.pending.get(id);
  tags.clearRenderTimers(); await stale(); await settle(); assert.equal(ran, 0);
  const queued = tags.schedule(() => ran++), callback = clock.pending.get(queued);
  clock.pending.delete(queued); callback(); tags.clearRenderTimers(); await settle(); assert.equal(ran, 0);
  for (let i = 0; i < 100; i++) tags.schedule(() => ran++);
  tags.destroy(); assert.equal(clock.pending.size, 0);
  assert.equal(tags.schedule(() => ran++), undefined);
});

test('late tag initialization cannot overwrite a newer selection and cached tag sets reuse counts', async () => {
  const { tags } = await tagsFixture(); const a = deferred<string[]>(), b = deferred<string[]>(); let calls = 0;
  tags.container = { children: [] }; tags.getPlainTags = () => (++calls === 1 ? a.promise : b.promise);
  const rendered = []; tags.refresh = async () => rendered.push([...tags.plainTags]);
  const older = tags.init(true), newer = tags.init(true);
  b.resolve(['#new']); await newer; a.resolve(['#old']); await older;
  assert.deepEqual(rendered, [['#new']]);
  let reads = 0;
  const items = [1, 2].map(id => ({ id, getTags: () => { reads++; return [{ tag: '#tag' }]; }, isPDFAttachment: () => false }));
  tags.collectionItems = items;
  tags.updateTagsIn(items); tags.updateTagsIn([...items].reverse());
  assert.equal(reads, 2); assert.equal(tags.tagsIns.size, 1);
});

test('TLDR edits save on change to the bound item and discard late results after switching or typing', async () => {
  let options; const events = new Map(); const responses = [], writes = [];
  const input = { isConnected: true, value: '', addEventListener: (type, callback) => events.set(type, callback) };
  const body = { isConnected: true, querySelector: () => input };
  const ctx = await load({ config: { addonID: 'test', addonRef: 'test' }, getPref: () => false, getString: testGetString,
    Zotero: { ItemPaneManager: { registerSection(value) { options = value; return 'tldr'; }, unregisterSection() {} },
      HTTP: { request() { const response = deferred(); responses.push(response); return response.promise; } } },
    ztoolkit: { log: assert.fail, ExtraField: { getExtraField: item => item.saved || '', setExtraField: async (item, key, value) => writes.push([item.id, value]) } },
    getTldrTextFromResponse: response => response.text,
    prepareTldrText: async (text, { persist }) => { await persist(text); return text; } }, 'upstream/features/reader/TLDR.ts');
  const stop = ctx.registerTLDRPane({ MozXULElement: { insertFTLIfNeeded() {} } });
  options.onInit({ body }); assert.equal(events.has('keyup'), false);
  const a = { id: 1, getField: () => 'doi-a' }, b = { id: 2, saved: 'Saved B', getField: () => 'doi-b' };
  const old = options.onRender({ body, item: a });
  options.onItemChange({ body, item: b, tabType: 'library', setEnabled() {} });
  await options.onRender({ body, item: b });
  responses[0].resolve({ response: { text: 'Late A' } }); await old;
  assert.equal(input.value, 'Saved B'); assert.equal(writes.length, 0);
  const pending = options.onRender({ body, item: a });
  input.value = 'My draft'; events.get('input')();
  responses[1].resolve({ response: { text: 'Late lookup' } }); await pending;
  assert.equal(input.value, 'My draft'); assert.equal(writes.length, 0);
  await events.get('change')(); assert.deepEqual(writes, [[1, 'My draft']]);
  stop(); input.value = 'After stop'; await events.get('change')(); assert.equal(writes.length, 1);
});

test('reading timers do not overlap and ignore a reader replaced while lookup is pending', async () => {
  let callback, calls = 0, writes = 0;
  const pending = deferred(); const original = { _item: { parentItem: { key: 'A' } } };
  let selected = original;
  const ctx = await load({ window: { setInterval(fn) { callback = fn; return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    getPref: () => 20, isReadingProgressRecordingEnabled: () => true, LruCache: class extends Map { constructor() { super(); } }, Zotero_Tabs: { selectedID: 'reader' },
    Zotero: { Reader: { getByTabID: () => selected } }, addon: { api: { storage: { set: () => writes++ } } },
    ztoolkit: { Reader: { getReader() { calls++; return pending.promise; } }, log: assert.fail } }, 'upstream/features/reader/record.ts');
  const recorder = new ctx.Record(); const first = callback(); await callback(); assert.equal(calls, 1);
  selected = { _item: { parentItem: { key: 'B' } } }; pending.resolve(original); await first;
  assert.equal(writes, 0); recorder.destroy();
});

test('field dragging uses one frame per burst, releases document listeners and cancels animations on cleanup', async () => {
  const dom = domFixture(); const parent = new dom.Element(), input = new dom.Element('input');
  parent.append(input); input.value = 'a, b, c';
  const ctx = await load({ getElements: nodes => Array.from(nodes) }, 'upstream/features/item-tree/columnFieldPicker.ts');
  const stop = ctx.mountColumnFieldPicker(input, {
    sourcePrefKey: 'source', selectLabel: 'Fields', getOptions: () => ['a', 'b', 'c'].map(value => ({ value, description: value }))
  });
  const picker = parent.querySelector('.style-column-field-picker');
  assert.equal(dom.host.listeners.get('mousemove')?.size || 0, 0);
  picker.fire('mousedown', { button: 0, target: picker.querySelector('.field-chip-label'), clientX: 5, clientY: 5 });
  assert.equal(dom.host.listeners.get('mousemove').size, 1);
  for (let i = 0; i < 100; i++) dom.host.fire('mousemove', { clientX: 300 + i, clientY: 5, preventDefault() {} });
  assert.equal(dom.frames.size, 1); dom.frame(); assert.ok(dom.animationCount > 0);
  dom.host.fire('mouseup'); assert.equal(dom.host.listeners.get('mousemove').size, 0);
  assert.equal(input.value, 'b, c, a');
  picker.fire('mousedown', { button: 0, target: picker.querySelector('.field-chip-label'), clientX: 5, clientY: 5 });
  dom.host.fire('mousemove', { clientX: 300, clientY: 5, preventDefault() {} });
  assert.equal(dom.frames.size, 1);
  stop(); stop(); await settle();
  assert.equal(dom.frames.size, 0); assert.equal(dom.cancelledAnimations, dom.animationCount);
  assert.ok([...dom.host.listeners.values()].every(listeners => listeners.size === 0));
  assert.equal(parent.children.length, 1); assert.equal(input.hidden, false);
});

test('preference teardown removes observers and manual-journal callbacks and permits a clean remount', async () => {
  const dom = domFixture(); const container = new dom.Element(), heading = new dom.Element('h1'); container.append(heading);
  const win: any = new dom.Element('window'); win.document = dom.document; dom.document.defaultView = win;
  dom.document.querySelector = selector => selector === '#stylepersonal-settings' ? container : null;
  const observers = new Map(); let nextObserver = 0;
  const addon = { data: {}, api: {} };
  const ctx = await load({ addon, config: { prefsPrefix: 'extensions.zotero.stylepersonal' },
    getPref: () => undefined, getString: testGetString, getErrorMessage: testGetErrorMessage, getPreferenceOptionLabel: testGetPreferenceOptionLabel, spSelectOptions() {}, spReadManualRanks: () => ({}), spManualRankFields: [],
    spElement: (doc, tag, parent, text) => { const element = doc.createElement(tag); element.textContent = text; parent?.append(element); return element; },
    spFeatureGroups: ['journals', 'graph', 'reader', 'columns'].map(id => [id, `ui-group-${id}`]), spFeatureDefinitions: [], spInactivePreferences: new Set(),
    readDefaultPreferences: () => new Map([['extensions.zotero.stylepersonal.enable', true]]),
    Zotero: { Prefs: { registerObserver(key, callback) { observers.set(++nextObserver, callback); return nextObserver; }, unregisterObserver(id) { observers.delete(id); } } } },
    'upstream/features/preferences/preferenceWindow.ts', 'app/manualRanks.ts', 'app/preferences.ts');
  await ctx.registerPrefsScripts(win); const count = observers.size;
  assert.ok(count > 0); assert.equal(typeof ctx.addon.api.openManualJournal, 'function');
  ctx.addon.data.prefs.release();
  assert.equal(observers.size, 0); assert.equal(ctx.addon.api.openManualJournal, undefined);
  assert.deepEqual(container.children, [heading]); assert.equal(container.dataset.loaded, undefined);
  assert.equal(win.listeners.get('unload').size, 0);
  await ctx.registerPrefsScripts(win); assert.equal(observers.size, count); ctx.addon.data.prefs.release();
});
