import test from 'node:test';
import assert from 'node:assert/strict';
import { addonFiles, assemble, runtimePackage } from '../scripts/build.mts';
import { applyPixiPatch, pixiBundle } from '../scripts/pixi.mts';

test('only the listed runtime packages may be bundled', () => {
  assert.equal(runtimePackage('dayjs'), 'dayjs');
  assert.equal(runtimePackage('dayjs/plugin/utc'), 'dayjs');
  assert.equal(runtimePackage('zotero-plugin-toolkit/ztoolkit'), 'zotero-plugin-toolkit');
  assert.equal(runtimePackage('color-rna'), 'color-rna');
  assert.equal(runtimePackage('runes'), 'runes');
  assert.equal(runtimePackage('dayjs-extra'), undefined);
  assert.equal(runtimePackage('lodash'), undefined);
  assert.equal(runtimePackage('./local.ts'), undefined);
});

test('the plugin bundles zotero-plugin-toolkit 5.2.0 from npm instead of the old vendored copy', async () => {
  const source = await assemble();
  assert.match(source, /var version\d* = "5\.2\.0";/);
  assert.doesNotMatch(source, /5\.1\.0-beta/);
  assert.doesNotMatch(source, /refolio:src\/vendor\//);
  assert.doesNotMatch(source, /node_modules\/lucide|@license lucide/);
  assert.doesNotMatch(source, /ChromeUtils module import API/);
});

test('the graph renderer gets pixi.js-legacy 6.4.2 from npm with listeners on the canvas document', async () => {
  const source = await pixiBundle();
  assert.match(source, /pixi\.js-legacy - v6\.4\.2/);
  assert.match(source, /this\.ownerDocument=this\.interactionDOMElement\.ownerDocument/);
  for (const method of ['addEventListener', 'removeEventListener']) {
    assert.equal(source.split(`this.ownerDocument.${method}(`).length - 1, 5);
    assert.doesNotMatch(source, new RegExp(`globalThis\\.${method}\\("(pointerup|pointercancel|mouseup)"`));
  }
  assert.doesNotMatch(source, /sourceMappingURL/);
});

test('the pixi patch refuses a release it was not written for', () => {
  assert.throws(() => applyPixiPatch('var PIXI = {};'), /pixi/);
});

test('the add-on ships the patched pixi instead of a vendored copy', async () => {
  const pixi = (await addonFiles()).filter(([name]) => name === 'chrome/content/dist/assets/pixi.js');
  assert.equal(pixi.length, 1);
  assert.equal(pixi[0][1].toString(), await pixiBundle());
});
