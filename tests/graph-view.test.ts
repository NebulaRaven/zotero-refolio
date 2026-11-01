import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { spFilterGraph, spSharedGraph } from '../src/core/graph.ts';

const graphViewFile = new URL('../src/upstream/features/collections/graphView.ts', import.meta.url);
async function loadGraphView(extra: Record<string, unknown> = {}) {
  const ctx: vm.Context = { spFilterGraph, spSharedGraph, ztoolkit: { log() {} }, ...extra };
  vm.runInNewContext(await script(graphViewFile), ctx);
  return ctx;
}

test('tag hubs show the tag rather than their id and clicking one selects its papers', async () => {
  let selected;
  const selection = { addListener() {}, removeListener() {} };
  const itemsView = { onSelect: selection, selectItems: ids => { selected = ids; } };
  const ctx = await loadGraphView({ ZoteroPane: { itemsView }, requireItemsView: () => itemsView,
    window: { ResizeObserver: class { observe() {} disconnect() {} } } });
  const nodes: Array<{ id: string; type: string; getDisplayText?: () => string }> = [
    { id: '1', type: 'item' }, { id: '2', type: 'item' }, { id: 'tag:Theory/a', type: 'tag' }];
  const renderer = { nodes, containerEl: { style: {} }, setData() {}, changed() {}, onResize() {} };
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, cleanups: [], mode: 'tag', refreshGraphView: async () => {} });
  await view.initIFrame({ contentWindow: { renderer }, addEventListener() {}, removeEventListener() {} });
  const papers = [{ id: 1, tags: ['Theory/a'] }, { id: 2, tags: ['Theory/a'] }, { id: 3, tags: ['Method/a'] }];
  view.setData(spFilterGraph(spSharedGraph(papers, p => p.tags, 'tag'), [1]));
  assert.equal(nodes[2].getDisplayText!(), 'Theory/a');
  (renderer as any).onNodeClick({}, 'tag:Theory/a', 'tag');
  assert.deepEqual([...selected], [1, 2]);
});

class Paper {
  declare id: number; declare libraryID: number; declare key: string; declare itemType: string;
  declare date: string; declare tags: string[];
  constructor(id: number, date: string, tags: string[]) {
    Object.assign(this, { id, libraryID: 1, key: `KEY${id}`, itemType: 'journalArticle', date, tags });
  }
  isRegularItem() { return true; }
  getField(name: string) { return name === 'date' ? this.date : name === 'title' ? `Title ${this.id}` : ''; }
  getDisplayTitle() { return `Title ${this.id}`; }
  getTags() { return this.tags.map(tag => ({ tag })); }
  getCreators() { return []; }
  getNotes() { return []; }
}
async function graphFixture(rows: unknown[], prefs: Record<string, unknown> = {}) {
  const papers = rows.filter((row): row is Paper => row instanceof Paper);
  const labelled: number[] = [], built: Paper[][] = [];
  const pane = { selected: [] as Paper[], getSortedItems: () => rows, getSelectedItems: () => pane.selected };
  const ctx = await loadGraphView({ ZoteroPane: pane, getPref: key => prefs[key],
    getFirstSelectedCollection: () => undefined, getFirstSelectedLibraryID: () => 1,
    Zotero: { Item: Paper, Items: { get: id => papers.find(paper => paper.id === id) } } });
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, cleanups: [], mode: 'tag',
    getItemDisplayText: item => { labelled.push(item.id); return `Paper ${item.id}`; } });
  view.modeFunction = { tag: items => { built.push(items); return view.getGraphByTagLink(items); }, note: items => view.getGraphByNoteLink(items) };
  return { ctx, view, pane, labelled, built };
}

test('the graph labels only papers that survive the filter and skips trash rows that are not items', async () => {
  const papers = [new Paper(1, '2020', ['x']), new Paper(2, '2021-05-01', ['x']), new Paper(3, '2019', ['y']),
    new Paper(4, '2022', ['y']), new Paper(5, '', ['y'])];
  // Zotero 10 lists deleted collections and searches in the trash; their ids can equal item ids.
  const deletedCollection = { id: 3, key: 'COLL', name: 'Old collection' };
  const f = await graphFixture([...papers, deletedCollection], { 'graphView.scope': 'all', 'graphView.minYear': '2020' });
  const graph = await f.view.getGraph();
  assert.deepEqual(f.built.map(items => items.map(item => item.id)), [[1, 2, 3, 4, 5]]);
  assert.deepEqual(Object.keys(graph.nodes).sort(), ['1', '2', '4', 'tag:x']);
  assert.deepEqual(f.labelled.sort(), [1, 2, 4]);
  assert.deepEqual([graph.nodes[2].label, graph.nodes[2].fullLabel, graph.nodes[2].year], ['Paper 2', 'Title 2', 2021]);
  assert.equal(graph.nodes['tag:x'].label, 'x');
  f.view.mode = 'note';
  assert.deepEqual({ ...(await f.view.getGraph()).nodes }, {});
});

async function liveGraph(rows: Paper[]) {
  const timers: Array<() => void> = [], rendered: Array<{ nodes: Record<string, unknown> }> = [];
  let notify: ((...data: unknown[]) => void) | undefined, notifyTypes: string[] = [], notifyPriority: number | undefined, unregistered = 0;
  const pane = { selected: [] as Paper[], getSortedItems: () => rows, getSelectedItems: () => pane.selected };
  const addon = { api: {} as { refreshGraphView?: () => Promise<void> } };
  const ctx = await loadGraphView({ ZoteroPane: pane, addon, getPref: key => key === 'graphView.mode' ? 'tag' : undefined,
    getFirstSelectedCollection: () => undefined, getFirstSelectedLibraryID: () => 1,
    registerNotify: (types, callback, priority) => { notifyTypes = [...types]; notify = callback; notifyPriority = priority; return () => { unregistered++; }; },
    // The items tree never appears, so initialization waits and leaves the renderer to the test.
    document: { querySelectorAll: () => [], querySelector: () => null },
    window: { addEventListener() {}, removeEventListener() {}, setTimeout: fn => timers.push(fn), clearTimeout() {} },
    Zotero: { Item: Paper, Items: { get: id => rows.find(paper => paper.id === id) }, Promise: { delay: () => new Promise(() => {}) } } });
  const view = new ctx.GraphView();
  let builds = 0;
  const build = view.modeFunction.tag;
  view.modeFunction.tag = items => { builds++; return build(items); };
  Object.assign(view, { renderer: {}, container: { style: { display: '' }, remove() {} },
    setData: graph => rendered.push(graph), getItemDisplayText: item => `Paper ${item.id}` });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const select = async (...papers: Paper[]) => {
    pane.selected = papers; view.queueSelectionRefresh();
    while (timers.length) { timers.shift()!(); await flush(); }
  };
  return { view, addon, rendered, select, flush, notify: (...data: unknown[]) => notify!(...data),
    get builds() { return builds; }, get notifyTypes() { return notifyTypes; }, get notifyPriority() { return notifyPriority; },
    get unregistered() { return unregistered; } };
}

test('selection changes reuse the unfiltered graph while library changes and explicit refreshes rebuild it', async () => {
  const papers = [new Paper(1, '2020', ['x']), new Paper(2, '2021', ['x', 'y']), new Paper(3, '2022', ['y'])];
  const f = await liveGraph(papers);
  await f.addon.api.refreshGraphView!();
  await f.select(papers[0]); await f.select(papers[2]);
  assert.equal(f.builds, 1);
  assert.deepEqual(Object.keys(f.rendered.at(-1)!.nodes).sort(), ['2', '3', 'tag:y']);
  assert.deepEqual(f.notifyTypes, ['item', 'item-tag', 'collection-item']);
  papers[2].tags = ['x', 'y']; f.notify('add', 'item-tag', ['3-1'], {});
  await f.select(papers[0]);
  assert.equal(f.builds, 2);
  assert.deepEqual(Object.keys(f.rendered.at(-1)!.nodes).sort(), ['1', '2', '3', 'tag:x', 'tag:y']);
  // Related items and citation updates refresh explicitly and must see the change.
  await f.addon.api.refreshGraphView!();
  assert.equal(f.builds, 3);
  // Another collection or search lists other items and needs its own graph.
  papers.pop(); await f.select(papers[0]);
  assert.equal(f.builds, 4);
  f.view.destroy();
  assert.equal(f.unregistered, 1);
  assert.equal(f.view.rawGraph, undefined);
  assert.equal(f.addon.api.refreshGraphView, undefined);
});

test('a graph built before a library change or an explicit refresh does not replace the cached graph', async () => {
  const papers = [new Paper(1, '2020', ['x']), new Paper(2, '2021', ['x'])];
  const f = await liveGraph(papers);
  const build = f.view.modeFunction.tag, held: Array<() => void> = [];
  // A held build reads the tags when it starts and finishes only when released.
  const hold = () => { f.view.modeFunction.tag = items => { const graph = build(items); return new Promise(resolve => held.push(() => resolve(graph))); }; };
  const visible = () => Object.keys(f.rendered.at(-1)!.nodes).sort();
  hold(); await f.select(papers[0]);
  papers[1].tags = ['z']; f.notify('modify', 'item-tag', ['2-1'], {});
  held.shift()!(); await f.flush();
  f.view.modeFunction.tag = build; await f.select(papers[0]);
  assert.deepEqual(visible(), ['1']);
  f.notify('modify', 'item', [1], {});
  hold(); await f.select(papers[0]);
  // Citation data changes reach the graph only through an explicit refresh.
  f.view.modeFunction.tag = build; papers[1].tags = ['x'];
  await f.addon.api.refreshGraphView!();
  held.shift()!(); await f.flush();
  await f.select(papers[0]);
  assert.deepEqual(visible(), ['1', '2', 'tag:x']);
});

test('the cached graph is dropped before Zotero\'s item tree reacts to the same change', async () => {
  const f = await liveGraph([new Paper(1, '2020', ['x'])]);
  // Zotero's item tree observes with priority 50 and reselects an edited item, which refreshes the graph.
  assert.ok(f.notifyPriority !== undefined && f.notifyPriority < 50);
});

test('a graph build that finishes after destroy leaves nothing cached', async () => {
  const papers = [new Paper(1, '2020', ['x']), new Paper(2, '2021', ['x'])];
  const f = await liveGraph(papers);
  const build = f.view.modeFunction.tag, held: Array<() => void> = [];
  f.view.modeFunction.tag = items => { const graph = build(items); return new Promise(resolve => held.push(() => resolve(graph))); };
  const refresh = f.addon.api.refreshGraphView!();
  f.view.destroy();
  held.shift()!(); await refresh; await f.flush();
  assert.equal(f.view.rawGraph, undefined);
});

test('registerNotify passes an observer priority on to Zotero', async () => {
  const registered = [];
  const ctx: vm.Context = { addon: { data: { alive: true } }, config: { addonRef: 'stylepersonal' },
    window: { addEventListener() {}, removeEventListener() {} },
    Zotero: { Notifier: { registerObserver: (...args) => { registered.push(args); return 'id'; }, unregisterObserver() {} } } };
  vm.runInNewContext(await script(new URL('../src/upstream/platform/zotero/notifier.ts', import.meta.url)), ctx);
  ctx.registerNotify(['item'], () => {});
  ctx.registerNotify(['item'], () => {}, 40);
  assert.deepEqual(registered.map(args => args.slice(1)), [[['item']], [['item'], 'stylepersonal', 40]]);
});
