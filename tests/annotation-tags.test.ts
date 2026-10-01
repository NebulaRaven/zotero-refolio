import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

test('colour-name tags skip IDs Zotero no longer knows about and still tag the rest', async () => {
  let notify: (event: string, type: string, ids: number[]) => Promise<void> = async () => {};
  const tagged: string[] = [];
  const annotation = { isAnnotation: () => true, annotationColor: '#ffd400', addTag: (name: string) => tagged.push(name), saveTx: async () => {} };
  const context: vm.Context = {
    registerNotify: (_types: string[], callback: typeof notify) => { notify = callback; return () => {}; },
    getPref: (key: string) => key === 'function.addColorNameTag.enable' ? true : [['general.yellow', '#ffd400']],
    findAnnotationColorName: () => 'general.yellow',
    Zotero: { Promise: { delay: async () => {} }, getString: () => 'Yellow', Items: { get: (id: number) => id === 5 ? annotation : false } }
  };
  vm.runInNewContext(await script(new URL('../src/upstream/utils/base.ts', import.meta.url), 'addColorNameTag'), context);
  context.addColorNameTag();
  await notify('add', 'item', [99, 5]);
  assert.deepEqual(tagged, ['Yellow']);
});
