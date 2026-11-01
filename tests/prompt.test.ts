import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { domFixture } from './dom-fixture.ts';

const promptFile = new URL('../src/upstream/features/workspace/prompt.ts', import.meta.url);

test('search results show item fields as text and italicize only the publication', async () => {
  const dom = domFixture();
  const created: Array<InstanceType<typeof dom.Element>> = [];
  const ctx: vm.Context = { document: dom.document, ztoolkit: { UI: { createElement: (_doc, tag, options) => {
    const element = Object.assign(new dom.Element(tag), options?.properties); created.push(element); return element;
  } } } };
  vm.runInNewContext(await script(promptFile, 'appendItemDescription'), ctx);
  const fields = { date: '2024-01-01', publicationTitle: '<img src=x onerror=alert(1)>', volume: '3', issue: '2', pages: '1-9' };
  const item = { firstCreator: 'Lovelace', getField: name => fields[name] || '' };
  const span: { parts: unknown[]; append(...parts: unknown[]): void } = { parts: [], append(...parts) { this.parts.push(...parts); } };
  ctx.appendItemDescription(span, item);
  assert.equal(created.length, 1);
  assert.equal(created[0].tagName, 'i');
  assert.equal(created[0].textContent, '<img src=x onerror=alert(1)>');
  assert.deepEqual(span.parts, ['Lovelace (2024), ', created[0], ', 3(2), 1-9.']);
});
