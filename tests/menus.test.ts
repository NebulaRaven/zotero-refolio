import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

async function menus(registerResult: (menuID: string) => string | false = menuID => `${menuID}-key`) {
  const calls: string[] = [];
  const context: vm.Context = { config: { addonID: 'style-personal@nebularaven.local' }, Zotero: { MenuManager: {
    registerMenu: (options: { menuID: string; pluginID: string }) => { calls.push(`register ${options.menuID} ${options.pluginID}`); return registerResult(options.menuID); },
    unregisterMenu: (key: string) => { calls.push(`unregister ${key}`); return true; }
  } } };
  vm.runInNewContext(await script(new URL('../src/app/menus.ts', import.meta.url)), context);
  return { context, calls };
}
const options = { menuID: 'refolio-test', target: 'main/menubar/tools', menus: [] };

test('menus register once per Zotero session and unregister after the last window releases them', async () => {
  const { context, calls } = await menus();
  const first = context.spRegisterMenu(options), second = context.spRegisterMenu(options);
  first(); first();
  assert.deepEqual(calls, ['register refolio-test style-personal@nebularaven.local']);
  second();
  assert.equal(calls.at(-1), 'unregister refolio-test-key');
  context.spRegisterMenu(options)();
  assert.equal(calls.filter(call => call.startsWith('register')).length, 2);
});

test('a menu Zotero rejects fails loudly', async () => {
  const { context } = await menus(() => false);
  assert.throws(() => context.spRegisterMenu(options), /refolio-test/);
});
