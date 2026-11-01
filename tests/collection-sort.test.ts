import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

async function loadCollectionTree(locale: string) {
  const ctx: vm.Context = { getString: testGetString, config: { addonRef: 'stylepersonal' }, createCollectionItemCountClassNames: () => ({}),
    Zotero: { localeCompare: new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }).compare } };
  vm.runInNewContext(await script(new URL('../src/upstream/features/collections/collectionTree.ts', import.meta.url)), ctx);
  return ctx;
}

test('collection names sort in the interface language order', async () => {
  const ctx = await loadCollectionTree('zh-CN');
  const names = ['张三', '阿里', '李四', 'b', 'A'].map(name => ({ name }));
  const sorted = names.slice().sort(ctx.sortFunctions['Collection Name (A-Z)']).map(row => row.name);
  // Chinese collation orders Han characters by pinyin, before Latin letters, and ignores case.
  assert.deepEqual(sorted, ['阿里', '李四', '张三', 'A', 'b']);
  assert.deepEqual(names.slice().sort(ctx.sortFunctions['Collection Name (Z-A)']).map(row => row.name), sorted.reverse());
});

test('every collection sort option shows a translated label and keeps its saved value', async () => {
  const ctx = await loadCollectionTree('en-US');
  const labels = Object.keys(ctx.sortFunctions).map(value => ctx.collectionSortLabel(value));
  assert.deepEqual(labels, ['No sorting', 'Collection name (A–Z)', 'Collection name (Z–A)', 'Item count (low to high)', 'Item count (high to low)']);
});
