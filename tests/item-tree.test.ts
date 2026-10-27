import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

const itemTreeFile = new URL('../src/upstream/features/item-tree/itemTree-57.ts', import.meta.url);
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
  const patches = [];
  await ctx.ItemTree.prototype.creator.call({ addRenderCellPatch: patch => patches.push(patch), patchSetting() {} });
  const cell = { innerText: '', querySelector: () => null };
  patches[0].renderCell(cell, 1, first);
  assert.equal(cell.innerText, 'Lovelace');
});

test('the publication column renders the row it is given when a section header precedes the items', async () => {
  const journal = title => ({ title, isRegularItem: () => true });
  const first = journal('Nature'), second = journal('Science');
  const ctx = await loadItemTree({ ZoteroPane: headerOffsetPane(first, second), getPublicationTitle: item => item.title });
  const patches = [];
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
  const commands = [], listeners: Record<string, () => Promise<void>> = {};
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
