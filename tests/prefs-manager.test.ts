import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { testGetString } from './localization.ts';

test('the preference manager opens from settings without adding a Tools menu item', async () => {
  const registered: unknown[] = [], unregistered: string[] = [];
  const context: vm.Context = { config: { addonRef: 'stylepersonal' }, getString: testGetString, getElements: () => [],
    ztoolkit: { Menu: { register: (...args) => registered.push(args), unregister: id => unregistered.push(id) }, log() {} } };
  vm.runInNewContext(await script(new URL('../src/upstream/features/preferences/prefsManager.ts', import.meta.url)), context);
  let built = 0;
  context.PrefsManager.prototype.buildPopup = async function () { built++; };
  const fromSettings = context.spOpenPrefsManager();
  assert.equal(registered.length, 0); assert.equal(built, 1);
  fromSettings.destroy(); assert.deepEqual(unregistered, []);
  const fromMenu = new context.PrefsManager();
  assert.equal(registered.length, 1);
  fromMenu.destroy(); assert.deepEqual(unregistered, ['stylepersonal-preference-manager']);
});
