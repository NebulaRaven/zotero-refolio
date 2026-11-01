import { testGetString, testGetErrorMessage, testGetPreferenceOptionLabel } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
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

test('graph selection bursts coalesce and hidden graphs do not schedule work', async () => {
  const clock = timers(); let refreshed = 0;
  const ctx = await load({ window: clock, ztoolkit: { log: assert.fail } }, 'upstream/features/collections/graphView.ts');
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, timers: new Set(), container: { style: { display: '' } }, mode: 'citations',
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

test('local storage reads create no entries, so asking about an item never persists it', async () => {
  const writes: string[] = [];
  const { storage } = await storageFixture(async text => { writes.push(text); });
  assert.equal(storage.get({ key: 'A' }, 'readingTime'), undefined);
  assert.equal(storage.get({ key: 'A' }, 'readingTime'), undefined);
  await storage.set({ key: 'B' }, 'value', 1); await storage.flush();
  assert.deepEqual(Object.keys(JSON.parse(writes[0])), ['B']);
});

test('empty entries of a loaded storage file are dropped and stored values read back unchanged', async () => {
  const writes: string[] = [];
  const reading = { page: 2, data: { 0: 40 } };
  const ctx = await load({ window: timers(), IOUtils: { exists: async () => false }, PathUtils: { joinRelative: (dir, name) => `${dir}/${name}` },
    Zotero: { DataDirectory: { dir: 'data' }, Promise: { defer: deferred },
      File: { getContentsAsync: async () => JSON.stringify({ A: {}, B: { readingTime: reading }, C: {} }), putContentsAsync: async (_file, text) => { writes.push(text); } } },
    getPref: () => true, ztoolkit: { log() {} } }, 'upstream/platform/persistence/storage.ts');
  const storage = new ctx.LocalStorage('fixture'); await storage.lock.promise;
  assert.equal(storage.filename, 'data/fixture.json');
  assert.equal(storage.get({ key: 'A' }, 'readingTime'), undefined);
  assert.equal(JSON.stringify(storage.get({ key: 'B' }, 'readingTime')), JSON.stringify(reading));
  await storage.set({ key: 'D' }, 'rank', 'Q1'); await storage.flush();
  assert.deepEqual(JSON.parse(writes[0]), { B: { readingTime: reading }, D: { rank: 'Q1' } });
});

/** Note storage on a fake add-on item whose getNotes(), like Zotero's, lists the untrashed child notes. */
async function noteStorageFixture({ holdSaves = false } = {}) {
  let nextID = 10, lookups = 0, created = 0, noteLists = 0;
  const notes = new Map<number, Note>(), heldSaves: Array<() => void> = [];
  const parent = { id: 1, key: 'ADDONKEY', childIDs: [] as number[], getNotes() { noteLists++; return this.childIDs.filter(id => !notes.get(id)!.deleted); } };
  class Note {
    id = nextID++; parentID: number | false = false; deleted = false; note = ''; _displayTitle = '';
    setNote(text: string) { this.note = text; this._displayTitle = text.split('\n')[0]; }
    async saveTx() {
      if (holdSaves) await new Promise<void>(resolve => heldSaves.push(resolve));
      if (!notes.has(this.id)) { notes.set(this.id, this); parent.childIDs.push(this.id); }
    }
    async eraseTx() { erase(this); }
  }
  const resolve = (id: number) => { lookups++; return notes.get(id) || false; };
  const ctx = await load({ window: timers(), getPref: () => true, ztoolkit: { log: assert.fail },
    Zotero: { Item: class extends Note { constructor() { super(); created++; } },
      Items: { get: resolve, getLibraryAndKeyFromID: id => notes.has(id) && { libraryID: 1, key: String(id) }, getByLibraryAndKey: (_library, key) => resolve(Number(key)) } } },
    'upstream/platform/persistence/storage.ts');
  const storage = new ctx.AddonItem(); storage.item = parent;
  // Notes arriving or leaving through sync, outside the storage.
  const sync = (key: string, data: object) => { const note = new Note(); note.parentID = parent.id; note.setNote(`${key}\n${JSON.stringify(data)}`); notes.set(note.id, note); parent.childIDs.push(note.id); return note; };
  const erase = (note: Note) => { notes.delete(note.id); parent.childIDs.splice(parent.childIDs.indexOf(note.id), 1); };
  return { storage, sync, erase, notes, lookups: () => lookups, created: () => created, noteLists: () => noteLists,
    releaseSaves: () => { for (const release of heldSaves.splice(0)) release(); } };
}

// Sync and other library changes reach the storage in later event-loop turns, never inside a render pass.
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('note storage completes a write it accepted before being disposed', async () => {
  const f = await noteStorageFixture({ holdSaves: true });
  const writing = f.storage.set({ key: 'NEWKEY00' }, 'readingTime', 5);
  await nextTurn();
  const disposing = f.storage.dispose();
  f.releaseSaves(); await writing; await disposing;
  const saved = [...f.notes.values()].map(note => note.note);
  assert.equal(saved.length, 1);
  assert.match(saved[0], /^NEWKEY00\n.*"readingTime":5/);
});

test('note storage rechecks an indexed note that sync rewrote for another key', async () => {
  const f = await noteStorageFixture();
  const note = f.sync('AAAAAAAA', { readingTime: 1 });
  assert.equal(f.storage.get({ key: 'AAAAAAAA' }, 'readingTime'), 1);
  note.setNote(`BBBBBBBB\n${JSON.stringify({ readingTime: 99 })}`);
  assert.equal(f.storage.get({ key: 'AAAAAAAA' }, 'readingTime'), undefined);
  assert.equal(f.storage.get({ key: 'BBBBBBBB' }, 'readingTime'), 99);
  await f.storage.set({ key: 'AAAAAAAA' }, 'readingTime', 5);
  assert.match(note.note, /"readingTime":99/);
  assert.equal(f.created(), 1);
});

test('note storage lists the add-on notes once per render pass, not once per row', async () => {
  const f = await noteStorageFixture();
  f.sync('AAAAAAAA', { readingTime: 1 });
  await nextTurn();
  const before = f.noteLists();
  for (let row = 0; row < 100; row++) f.storage.get({ key: `ROW${row}` }, 'readingTime');
  assert.equal(f.noteLists() - before, 1);
  f.sync('LATER000', { readingTime: 2 });
  await nextTurn();
  assert.equal(f.storage.get({ key: 'LATER000' }, 'readingTime'), 2);
});

test('note storage finds keys in an index built from one scan, including notes it created or sync added later', async () => {
  const { storage, sync, lookups, created } = await noteStorageFixture();
  sync('AAAAAAAA', { readingTime: 1 }); sync('BBBBBBBB', { readingTime: 2 });
  const missing = { key: 'CCCCCCCC' };
  assert.equal(storage.get(missing, 'readingTime'), undefined);
  const scanned = lookups();
  for (let i = 0; i < 5; i++) assert.equal(storage.get(missing, 'readingTime'), undefined);
  assert.equal(storage.get({ key: 'AAAAAAAA' }, 'readingTime'), 1);
  assert.equal(lookups(), scanned, 'a miss scanned the notes again');
  await storage.set({ key: 'DDDDDDDD' }, 'readingTime', 4); assert.equal(created(), 1);
  const afterCreate = lookups();
  assert.equal(storage.get({ key: 'DDDDDDDD' }, 'readingTime'), 4); assert.equal(storage.get(missing, 'readingTime'), undefined);
  assert.equal(lookups(), afterCreate, 'the created note was not added to the index');
  sync('CCCCCCCC', { readingTime: 3 });
  await nextTurn();
  assert.equal(storage.get(missing, 'readingTime'), 3);
});

test('note storage does not serve notes that sync replaced, trashed or erased from its index', async () => {
  const { storage, sync, erase } = await noteStorageFixture();
  const first = sync('AAAAAAAA', { readingTime: 1 }); sync('BBBBBBBB', { readingTime: 2 });
  const item = { key: 'AAAAAAAA' };
  assert.equal(storage.get(item, 'readingTime'), 1);
  // Same note count: one note erased and its replacement synced in.
  erase(first); const second = sync('AAAAAAAA', { readingTime: 5 });
  await nextTurn();
  assert.equal(storage.get(item, 'readingTime'), 5);
  await storage.set(item, 'readingTime', 6);
  assert.match(second.note, /"readingTime":6/); assert.match(first.note, /"readingTime":1/);
  second.deleted = true;
  assert.equal(storage.get(item, 'readingTime'), undefined);
});

test('note storage never creates a second note for a key, even when its index missed a change', async () => {
  const { storage, sync, created } = await noteStorageFixture();
  const other = sync('OTHERKEY', { value: 1 });
  assert.equal(storage.get({ key: 'NEWKEY00' }, 'value'), undefined);
  // Sync rewrites a note in place, which neither the note count nor the note IDs reveal.
  other.setNote(`NEWKEY00\n${JSON.stringify({ value: 2 })}`);
  await storage.set({ key: 'NEWKEY00' }, 'value', 3);
  assert.equal(created(), 0); assert.match(other.note, /"value":3/);
  await storage.set({ key: 'FRESHKEY' }, 'value', 1); await storage.set({ key: 'FRESHKEY' }, 'value', 2);
  assert.equal(created(), 1); assert.equal(storage.get({ key: 'FRESHKEY' }, 'value'), 2);
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
  const { tags } = await tagsFixture(); const a = deferred<Array<[string, number]>>(), b = deferred<Array<[string, number]>>(); let calls = 0;
  tags.container = { children: [] }; tags.getPlainTags = () => (++calls === 1 ? a.promise : b.promise);
  const rendered = []; tags.refresh = async () => rendered.push([...tags.plainTags]);
  const older = tags.init(true), newer = tags.init(true);
  b.resolve([['#new', 1]]); await newer; a.resolve([['#old', 1]]); await older;
  assert.deepEqual(rendered, [[['#new', 1]]]);
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
    registerNotify: () => () => {},
    Zotero: { Reader: { getByTabID: () => selected } }, addon: { api: { storage: { set: () => writes++ } } },
    ztoolkit: { Reader: { getReader() { calls++; return pending.promise; } }, log: assert.fail } }, 'upstream/features/reader/record.ts');
  const recorder = new ctx.Record(); const first = callback(); await callback(); assert.equal(calls, 1);
  selected = { _item: { parentItem: { key: 'B' } } }; pending.resolve(original); await first;
  assert.equal(writes, 0); recorder.destroy();
});

/** Storage that, like note storage, returns a parsed copy and records the total of every write. */
function readingTimeStorage() {
  const stored = new Map<string, string>(); const writes: Array<[string, number]> = [];
  const total = (value: { data: Record<string, number> }) => Object.values(value.data).reduce((sum, seconds) => sum + seconds, 0);
  return { writes,
    get(item: { key: string }) { const text = stored.get(item.key); return text === undefined ? undefined : JSON.parse(text); },
    async set(item: { key: string }, _key: string, value: { data: Record<string, number> }) { stored.set(item.key, JSON.stringify(value)); writes.push([item.key, total(value)]); } };
}

/** A recorder reading PDFs in tabs A and B; read() lets 20-second recording ticks pass on the selected tab. */
async function recorderFixture(storage: object, log: (...args: unknown[]) => void = assert.fail) {
  let now = 0, position = 0, tick: (() => Promise<void>) | undefined, tabNotify: ((...data: unknown[]) => unknown) | undefined, unregistered = 0;
  const listeners = new Map<string, () => unknown>();
  const reader = (key: string) => ({ _item: { parentItem: { key } }, _internalReader: { _lastView: { _iframeWindow: { PDFViewerApplication: { pagesCount: 3,
    pdfViewer: { _location: { pageNumber: 1, left: 0, top: 0, scale: 1 } } } } } } });
  const readers: Record<string, ReturnType<typeof reader>> = { A: reader('A'), B: reader('B') }; const tabs = { selectedID: 'A' };
  const ctx = await load({ window: { setInterval(fn) { tick = fn; return 1; }, clearInterval() { tick = undefined; },
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } },
  Date: { now: () => now }, getPref: () => 20, isReadingProgressRecordingEnabled: () => true, Zotero_Tabs: tabs,
  registerNotify: (types, callback) => { assert.deepEqual([...types], ['tab']); tabNotify = callback; return () => { unregistered++; }; },
  Zotero: { Reader: { getByTabID: id => readers[id] } }, addon: { api: { storage } },
  ztoolkit: { Reader: { getReader: async () => readers[tabs.selectedID] }, log } }, 'upstream/utils/lruCache.ts', 'upstream/features/reader/record.ts');
  const recorder = new ctx.Record();
  const read = async (seconds: number) => {
    for (let elapsed = 0; elapsed < seconds; elapsed += 20) {
      now += 20_000;
      // Scrolling on keeps the recorder from treating the reader as idle.
      readers[tabs.selectedID]._internalReader._lastView._iframeWindow.PDFViewerApplication.pdfViewer._location.top = ++position;
      await tick?.();
    }
  };
  return { recorder, read, select: (key: 'A' | 'B') => { tabs.selectedID = key; }, fire: (type: string) => listeners.get(type)!(),
    selectTab: (key: 'A' | 'B') => { tabs.selectedID = key; return tabNotify!('select', 'tab', [key], {}); }, unregistered: () => unregistered };
}

test('reading time is saved once per save interval rather than on every recording tick', async () => {
  const storage = readingTimeStorage();
  const { recorder, read } = await recorderFixture(storage);
  await read(100);
  assert.deepEqual(storage.writes, []);
  await read(20);
  assert.deepEqual(storage.writes, [['A', 120]]);
  await read(220);
  assert.deepEqual(storage.writes, [['A', 120], ['A', 240]]);
  await recorder.destroy();
  assert.deepEqual(storage.writes, [['A', 120], ['A', 240], ['A', 340]]);
});

test('reading time is saved at once when the reader switches item, the window deactivates or the recorder stops', async () => {
  const storage = readingTimeStorage();
  const { recorder, read, select, fire } = await recorderFixture(storage);
  await read(40);
  select('B'); await read(20);
  assert.deepEqual(storage.writes, [['A', 40]]);
  await fire('deactivate');
  assert.deepEqual(storage.writes, [['A', 40], ['B', 20]]);
  await read(20);
  fire('activate'); await read(20);
  // A is read back from storage, so its saved 40 seconds are neither lost nor counted twice.
  select('A'); await read(20);
  assert.deepEqual(storage.writes, [['A', 40], ['B', 20], ['B', 40]]);
  await recorder.destroy();
  assert.deepEqual(storage.writes, [['A', 40], ['B', 20], ['B', 40], ['A', 60]]);
});

test('reading time of the item left behind is saved as soon as another tab is selected', async () => {
  const storage = readingTimeStorage();
  const { recorder, read, selectTab, unregistered } = await recorderFixture(storage);
  await read(40);
  await selectTab('B');
  assert.deepEqual(storage.writes, [['A', 40]]);
  await recorder.destroy();
  assert.equal(unregistered(), 1);
});

test('reading time that failed to save is kept and saved with the next write', async () => {
  const storage = readingTimeStorage(); const errors: unknown[] = [];
  const set = storage.set; let failures = 1;
  storage.set = async (item, key, value) => { if (failures-- > 0) throw new Error('database'); return set(item, key, value); };
  const { recorder, read, select } = await recorderFixture(storage, (_message, error) => errors.push(error));
  await read(40);
  select('B'); await read(20);
  assert.equal(errors.length, 1); assert.deepEqual(storage.writes, []);
  await read(20);
  assert.deepEqual(storage.writes, [['A', 40]]);
  await recorder.destroy();
  assert.deepEqual(storage.writes, [['A', 40], ['B', 40]]);
});

test('reading time added while an earlier save is still being written is saved later', async () => {
  const storage = readingTimeStorage(); const set = storage.set; const slow = deferred<void>();
  storage.set = async (item, key, value) => { await set(item, key, value); if (storage.writes.length === 1) await slow.promise; };
  const { recorder, read, fire } = await recorderFixture(storage);
  await read(40); const saving = fire('deactivate');
  fire('activate'); await read(20);
  slow.resolve(); await saving;
  await recorder.destroy();
  assert.deepEqual(storage.writes, [['A', 40], ['A', 60]]);
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
    spFeatureGroups: ['journals', 'graph', 'reader', 'columns'].map(id => [id, `ui-group-${id}`]),
    spFeatureDefinitions: [['manualJournalRanks', 'journals', 'ui-feature-manualJournalRanks']],
    readDefaultPreferences: () => new Map([['extensions.zotero.stylepersonal.enable', true]]),
    Zotero: { Prefs: { registerObserver(key, callback) { observers.set(++nextObserver, callback); return nextObserver; }, unregisterObserver(id) { observers.delete(id); } } } },
    'core/settingsSchema.ts', 'app/ui.ts', 'app/settingControls.ts', 'upstream/features/preferences/preferenceWindow.ts', 'app/manualRanks.ts', 'app/preferences.ts');
  await ctx.registerPrefsScripts(win); const count = observers.size;
  assert.ok(count > 0); assert.equal(typeof ctx.addon.api.openManualJournal, 'function');
  ctx.addon.data.prefs.release();
  assert.equal(observers.size, 0); assert.equal(ctx.addon.api.openManualJournal, undefined);
  assert.deepEqual(container.children, [heading]); assert.equal(container.dataset.loaded, undefined);
  assert.equal(win.listeners.get('unload').size, 0);
  await ctx.registerPrefsScripts(win); assert.equal(observers.size, count); ctx.addon.data.prefs.release();
});
