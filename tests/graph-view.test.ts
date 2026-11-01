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
