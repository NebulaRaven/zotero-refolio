import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

test('importing colours with no text on the clipboard reports unreadable JSON instead of throwing', async () => {
  const listeners = new Map<string, () => void>(), alerts: string[] = [];
  const element = (selector = '') => ({ style: {}, innerHTML: '', querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (type: string, listener: () => void) => { listeners.set(`${selector} ${type}`, listener); } });
  let load = () => {};
  const dialog = { window: { document: { head: element(), querySelector: element },
    addEventListener: (_type: string, listener: () => void) => { load = listener; } } };
  const context: vm.Context = {
    getPref: () => '[]', setPref() {}, getString: testGetString, getElements: (nodes: Iterable<unknown>) => [...nodes], modifyAnnotationColors() {},
    ztoolkit: { log() {}, UI: { appendElement: () => element() }, Dialog: class { addCell() { return this; } open() { return dialog; } } },
    // Zotero.Utilities.Internal.getClipboard() returns null when the clipboard holds no text.
    Zotero: { Utilities: { Internal: { getClipboard: () => null } } },
    window: { alert: (message: string) => alerts.push(message), prompt: assert.fail, setTimeout() {} }
  };
  vm.runInNewContext(await script(new URL('../src/app/annotationColors.ts', import.meta.url)), context);
  await context.editAnnotationColors();
  load();
  listeners.get('#import-colors click')!();
  assert.deepEqual(alerts, [testGetString('prefs-colors-invalid-json', { args: { content: '' } })]);
});
