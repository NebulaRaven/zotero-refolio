import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, runtimePackage } from '../scripts/build.mts';

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
