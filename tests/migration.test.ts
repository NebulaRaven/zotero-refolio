import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { assemble, assembleModule, compileScript } from '../scripts/build.mts';

test('production modules initialize Refolio with the existing preference identity', async () => {
  const silent = { groupCollapsed() {}, groupEnd() {}, log() {}, trace() {} };
  const window = { document: {}, console: silent };
  const preferenceReads: string[] = [];
  const host: vm.Context = {
    locale: 'en-US', Item: class {}, Utilities: { randomString: () => 'fixture' },
    // A toolkit prompt may already exist when another Zotero plugin loads first.
    _toolkitGlobal: { currentWindow: window, prompt: { _ready: true, instance: {} }, debugBridge: { version: 2 } },
    Plugins: { addObserver() {}, removeObserver() {} },
    Reader: { registerEventListener() {}, _readers: [] },
    Promise: { delay: () => Promise.resolve() },
    Prefs: { get(key: string) { preferenceReads.push(key); return undefined; } },
    getMainWindow: () => window, getMainWindows: () => [], debug() {},
    logError(error: unknown) { throw error; }
  };
  const context: vm.Context = {
    Zotero: host, rootURI: 'test://refolio/', console: silent,
    // getGlobalForObject is the Gecko API zotero-plugin-toolkit 5.2 uses to wrap patched functions.
    ChromeUtils: { importESModule: () => ({ AddonManager: {} }), getGlobalForObject: () => globalThis },
    Services: {
      wm: { addListener() {}, removeListener() {} },
      io: { getProtocolHandler: () => ({ wrappedJSObject: { _extensions: {} } }) }
    }
  };
  context._globalThis = context;
  const source = await assemble();
  vm.runInNewContext(source, context);
  const addon = host.StylePersonal;
  assert.equal(addon.data.alive, true);
  assert.equal(addon.data.ztoolkit.basicOptions.log.prefix, '[Refolio]');
  assert.equal(addon.data.ztoolkit.basicOptions.api.pluginID, 'style-personal@nebularaven.local');
  assert.equal(typeof addon.hooks.onStartup, 'function');
  assert.equal(typeof addon.api.requests.get, 'function');
  vm.runInNewContext(await assembleModule('src/upstream/utils/prefs.ts', 'PreferenceTest'), context);
  context.PreferenceTest.getPref('graphView.enable');
  assert.equal(preferenceReads.at(-1), 'extensions.zotero.stylepersonal.graphView.enable');
  assert.equal(await assemble(), source);
  assert.ok(!source.includes('C:\\Users\\'));
});

test('native test bundle and Gecko bootstrap compile without writing an XPI', async () => {
  const native = await assembleModule('tests/native-entry.ts');
  assert.ok(native.includes('__nativeSmoke'));
  const bootstrap = await compileScript('src/bootstrap.ts');
  assert.ok(bootstrap.includes('chrome/content/scripts/refolio.js'));
  assert.equal(bootstrap.split('await Zotero.StylePersonal.hooks.onStartup();').length, 2);
  const smoke = await compileScript('tests/zotero-smoke.ts');
  const runner = await compileScript('tests/zotero-runner.ts');
  new vm.Script(bootstrap + '\n' + smoke);
  new vm.Script('var runnerOptions = {};\n' + runner);
  assert.ok(smoke.includes('async function runRefolioNativeSmoke('));
  assert.ok(!smoke.includes('import '));
});
