import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { script } from './source.mts';

const sample = `import { helper } from "./helper.ts";
import type { Thing } from "./types.ts";
export const limit: number = 3;
let hidden = 1;
export class Box { declare size: number; value = helper(limit); }
export default function main(thing: Thing): string { return String(thing) + hidden; }
function other() { return "other"; }
export { other as alias };
`;
async function fixture() {
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'refolio-source-')), 'module.ts');
  await fs.writeFile(file, sample);
  return file;
}

test('script strips module syntax and types and exposes every top-level name', async () => {
  const context: vm.Context = { helper: (value: number) => value * 2 };
  vm.runInNewContext(await script(await fixture()), context);
  assert.equal(context.limit, 3);
  assert.equal(context.hidden, 1);
  assert.equal(new context.Box().value, 6);
  assert.ok(!('size' in new context.Box()), 'declared fields must not be emitted');
  assert.equal(context.main('x'), 'x1');
  assert.equal(context.other(), 'other');
});

test('script can extract a single declaration and reports a missing one', async () => {
  const file = await fixture();
  const context: vm.Context = {};
  vm.runInNewContext(await script(file, 'other'), context);
  assert.equal(context.other(), 'other');
  assert.equal(context.limit, undefined);
  await assert.rejects(script(file, 'missing'), /Declaration not found: missing/);
});
