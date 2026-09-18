import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';

test('the isolated runner waits for the installed test run before replacing its plugin', async () => {
  let finish: () => void, installs = 0;
  const previousRun = new Promise<void>(resolve => { finish = resolve; });
  const statuses: Array<{ stage: string }> = [];
  const addonManager = {
    AUTOUPDATE_DISABLE: 0,
    getAddonByID: async () => ({ isActive: true, appDisabled: false }),
    getInstallForFile: async () => ({ addon: { id: 'style-personal@nebularaven.local' }, install: async () => { installs++; } })
  };
  const context = vm.createContext({
    runnerOptions: { profile: 'test/profile', dataDir: 'test/data', request: 'request', candidate: 'candidate', status: 'status' },
    Zotero: { initializationPromise: Promise.resolve(), uiReadyPromise: Promise.resolve(),
      Profile: { dir: 'test/profile' }, DataDirectory: { dir: 'test/data' },
      StylePersonal: { api: { __nativeRun: previousRun } }, logError: assert.fail },
    ChromeUtils: { importESModule: uri => uri.includes('Timer') ? { setInterval: () => 1 } : { AddonManager: addonManager } },
    IOUtils: { readUTF8: async () => JSON.stringify({ revision: 'new' }), writeUTF8: async (_path, text) => { statuses.push(JSON.parse(text)); } },
    Components: { classes: { '@mozilla.org/file/local;1': { createInstance: () => ({ initWithPath() {} }) } }, interfaces: { nsIFile: {} } }
  });
  vm.runInContext(await script(new URL('./zotero-runner.ts', import.meta.url)), context);
  const startup = context.startup();
  for (let index = 0; index < 10; index++) await Promise.resolve();
  assert.equal(installs, 0);
  assert.equal(statuses.length, 0);
  finish!(); await startup;
  assert.equal(installs, 1);
  assert.deepEqual(statuses.map(status => status.stage), ['installing', 'installed']);
});
