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
