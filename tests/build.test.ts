import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimePackage } from '../scripts/build.mts';

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
