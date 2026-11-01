import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

const itemTreeFile = new URL('../src/upstream/features/item-tree/itemTreeColumns.ts', import.meta.url);
async function loadItemTree(extra: Record<string, unknown> = {}, prefs: Record<string, unknown> = {}) {
  const ctx: vm.Context = {
    getPref: key => prefs[key], getString: testGetString, config: { addonRef: 'stylepersonal' },
    import_dayjs: { default: { extend() {}, locale() {} } }, import_relativeTime: {}, import_utc: {}, getDayjsLocale: () => 'en',
    Zotero: { locale: 'en', Prefs: { get: () => undefined } }, ztoolkit: { log() {} }, ...extra
  };
  vm.runInNewContext(await script(itemTreeFile), ctx);
  return ctx;
}
// Zotero 10 inserts a section header above the items when several collections are selected,
// so the sorted item list is one shorter than the rows and indexes no longer line up.
const headerOffsetPane = (...items) => ({ getSortedItems: () => items.slice(1) });

test('the creator column renders the row it is given when a section header precedes the items', async () => {
  const author = name => ({ isRegularItem: () => true, getCreators: () => [{ lastName: name }], firstCreator: name });
  const first = author('Lovelace'), second = author('Hopper');
  const ctx = await loadItemTree({ ZoteroPane: headerOffsetPane(first, second) },
    { 'function.creatorColumn.enable': true, 'creatorColumn.format': '${lastName}', 'creatorColumn.join': ', ', 'creatorColumn.slices': '0' });
  const patches: Array<{ renderCell(cell: object, index: number, item: object): unknown }> = [];
  await ctx.ItemTree.prototype.creator.call({ addRenderCellPatch: patch => patches.push(patch), patchSetting() {} });
  const cell = { innerText: '', querySelector: () => null };
  patches[0].renderCell(cell, 1, first);
  assert.equal(cell.innerText, 'Lovelace');
});

test('the publication column renders the row it is given when a section header precedes the items', async () => {
  const journal = title => ({ title, isRegularItem: () => true });
  const first = journal('Nature'), second = journal('Science');
  const ctx = await loadItemTree({ ZoteroPane: headerOffsetPane(first, second), getPublicationTitle: item => item.title });
  const patches: Array<{ renderCell(cell: object, index: number, item: object): unknown }> = [];
  await ctx.ItemTree.prototype.publication.call({ addRenderCellPatch: patch => patches.push(patch), patchSetting() {} });
  const cell = { innerText: '' };
  patches[0].renderCell(cell, 1, first);
  assert.equal(cell.innerText, 'Nature');
});

test('choosing a status changes the clicked item even when a section header precedes the items', async () => {
  const paper = (id: number) => {
    const tags = [{ tag: '/Unread' }];
    return { id, saved: 0, tags, getTags: () => tags.map(tag => ({ ...tag })), removeTag(name) { tags.splice(tags.findIndex(tag => tag.tag === name), 1); },
      addTag(name) { tags.push({ tag: name }); }, async saveTx() { this.saved++; } };
  };
  const clicked = paper(1), other = paper(2);
  const commands: Array<() => Promise<void>> = [], listeners: Record<string, () => Promise<void>> = {};
  const ctx = await loadItemTree({
    ZoteroPane: headerOffsetPane(clicked, other), getColoredTags: () => [], isStatusTagName: tag => tag.startsWith('/'),
    Zotero: { locale: 'en', isWin: false, Items: { get: id => [clicked, other].find(item => item.id === id) },
      Libraries: { userLibraryID: 1 }, Tags: { getColors: async () => new Map([['/Reading', { color: '#f00' }]]) } },
    getFirstSelectedLibraryID: () => 1, window: { screenX: 0, screenY: 0 },
    document: { querySelector: () => ({ getBoundingClientRect: () => ({ y: 0 }) }) },
    buildMenuPopup: (_position, children) => ({ querySelectorAll: () => children.map(() => ({
      setAttribute() {}, remove() {}, addEventListener: (_type, fn) => commands.push(fn)
    })) }),
    ztoolkit: { log() {}, UI: { appendElement() {} } }
  });
  const columns = new Map();
  await ctx.ItemTree.prototype.status.call({ isSelectedRow: () => false,
    registerColumn: async (key, provider, renderer) => columns.set(key, { provider, renderer }) });
  const { provider, renderer } = columns.get('status');
  const span = { style: {}, addEventListener: (type, fn) => { listeners[type] = fn; }, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  renderer(span, JSON.parse(JSON.stringify(provider(clicked).data)), 1);
  await listeners.click();
  await commands[0]();
  assert.deepEqual(clicked.tags.map(tag => tag.tag), ['/Reading']);
  assert.equal(clicked.saved, 1);
  assert.deepEqual(other.tags.map(tag => tag.tag), ['/Unread']);
  assert.equal(other.saved, 0);
});

async function annotationColumn(extra: Record<string, unknown> = {}, host: Record<string, unknown> = {}) {
  const ctx = await loadItemTree(extra, { 'function.annotationColumn.enable': true });
  const scheduled: Array<() => unknown> = [];
  let column;
  await ctx.ItemTree.prototype.annotation.call({ patchSetting() {}, scheduleTimeout: fn => scheduled.push(fn),
    registerColumn: async (_key, provider, renderer) => { column = { provider, renderer }; }, ...host });
  return { ...column, scheduled };
}

test('an item already known to have no pages does not look up its attachment again', async () => {
  const { provider, scheduled } = await annotationColumn({}, { getCachedPageNum: () => 0 });
  assert.equal(provider({ id: 1 }).data, false);
  assert.equal(scheduled.length, 0);
});

test('the annotation strip reads each annotation position once and colours each page by its largest annotation', async () => {
  let reads = 0;
  const annotation = (pageIndex, width, color, sortIndex) => ({
    annotationColor: color, annotationSortIndex: sortIndex,
    get _annotationPosition() { reads++; return JSON.stringify({ pageIndex, rects: [[0, 0, width, 1]] }); }
  });
  const annotations = [annotation(0, 1, '#small', '1'), annotation(0, 5, '#large', '2'), annotation(2, 1, '#last', '3')];
  const strip: string[] = [];
  const item = { isRegularItem: () => true, getBestAttachment: async () => ({ getAnnotations: () => annotations }) };
  const { renderer, scheduled } = await annotationColumn({
    Zotero: { locale: 'en', Items: { get: () => item } },
    ztoolkit: { log() {}, UI: { appendElement: (options, parent) => { if (parent === 'strip') strip.push(options.styles.backgroundColor); return 'strip'; } } }
  });
  renderer({ style: {} }, { pageNum: 3, id: 1 }, 0);
  await scheduled[0]();
  assert.deepEqual(strip, ['#large', 'transparent', '#last']);
  assert.equal(reads, annotations.length);
});

test('status cells size themselves with the Zotero font-size variable instead of computing styles', async () => {
  const styles: string[] = [];
  const element = () => ({ setAttribute: (name, value) => { if (name === 'style') styles.push(value); },
    querySelector: () => ({ setAttribute() {} }) });
  const ctx = await loadItemTree({
    getColoredTags: () => [], isStatusTagName: () => true,
    ColorRNA_default: class { rgb() { return [1, 2, 3]; } HSL(value?) { return value ? { getHex: () => '#123' } : [0, 0, 0]; } },
    window: { getComputedStyle: () => assert.fail('A status cell forced a style computation') },
    document: { querySelector: () => ({}) },
    ztoolkit: { log() {}, UI: { createElement: element } }
  });
  let renderer;
  await ctx.ItemTree.prototype.status.call({ isSelectedRow: () => false,
    registerColumn: async (_key, _provider, render) => { renderer = render; } });
  renderer({ style: {}, appendChild() {}, addEventListener() {} }, { tag: '/Reading', color: '#f00', itemID: 1 }, 0);
  assert.match(styles[0], /height: calc\(var\(--zotero-font-size, 1em\) \* 1\.4\)/);
});

test('rating stars declare a valid display value', async () => {
  const stars: Array<{ styles: { display: string } }> = [];
  const ctx = await loadItemTree({ ztoolkit: { log() {}, UI: { appendElement: options => { stars.push(options); return options; } } } },
    { 'ratingColumn.selectedStar': '⭐', 'ratingColumn.padding': '1' });
  let renderer;
  await ctx.ItemTree.prototype.rating.call({ isSelectedRow: () => false, patchItemBox() {}, patchSetting() {},
    registerColumn: async (_key, _provider, render) => { renderer = render; } });
  renderer({ style: {} }, { rate: 3, id: 1 }, 0);
  assert.equal(stars.length, 5);
  for (const star of stars) assert.equal(star.styles.display, 'inline-block');
});

test('linking related items still saves and finishes when the graph view is turned off', async () => {
  const shortcuts = new Map<string, () => Promise<void>>();
  const paper = (id: number) => ({ id, related: [] as number[], saved: 0, isRegularItem: () => true,
    addRelatedItem(other: { id: number }) { if (!this.related.includes(other.id)) this.related.push(other.id); }, removeRelatedItem() {}, async saveTx() { this.saved++; } });
  const first = paper(1), second = paper(2);
  // Without the graph-view feature nothing publishes addon.api.refreshGraphView.
  const ctx = await loadItemTree({
    window: { require: () => ({ prototype: {} }) }, Zotero: { locale: 'en', Prefs: { get: () => undefined }, ItemTreeManager: {} },
    addon: { api: {}, data: { alive: true } }, ZoteroPane: { itemsView: {}, getSelectedItems: () => [first, second] },
    installItemTreeColumnResetGuard: () => () => {}, suppressDeprecatedItemTreeColumnWarnings: () => () => {},
    installItemTreeRenderPatch: () => () => {}, LocalStorage: class {}, waitForItemsViewTree: async () => true,
    startItemTreeContributions: async (contributions: Array<{ isEnabled?: () => boolean; start: () => unknown }>) => {
      for (const contribution of contributions) if (!contribution.isEnabled || contribution.isEnabled()) await contribution.start();
      return () => {};
    },
    isEnabel: (key: string) => key === 'relatedItems', spRegisterMenu: () => () => {},
    registerShortcut: (key: string, callback: () => Promise<void>) => { shortcuts.set(key, callback); return () => {}; }
  });
  await ctx.ItemTree.prototype.init.call({ active: true, patchRenderCell: [], trackCleanup: (cleanup: () => void) => cleanup });
  await shortcuts.get('relatedItems.link.shortcut')!();
  assert.deepEqual([first.related, second.related, first.saved, second.saved], [[2], [1], 1, 1]);
});
