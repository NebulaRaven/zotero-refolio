import { testGetString, testGetErrorMessage } from './localization.ts';
import { script } from './source.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('graph resizing captures the pointer, enforces minimum height, saves on release and supports the keyboard', async () => {
  const events = new Map(), attributes = new Map(), saved = [];
  let captured;
  const handle = { setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
    setPointerCapture: id => captured = id, hasPointerCapture: id => captured === id, releasePointerCapture: () => captured = undefined };
  const container = { style: {} as Record<string, string>, parentElement: { clientHeight: 1000 }, getBoundingClientRect: () => ({ height: parseFloat(container.style.height) || 500 }) };
  const view = { cleanups: [] };
  const ctx: vm.Context = { setPref: (key, value) => saved.push([key, value]), getString: testGetString, getErrorMessage: testGetErrorMessage };
  vm.runInNewContext(await script(new URL('../src/app/graphControls.ts', import.meta.url)), ctx);
  ctx.spMakeGraphResizable(view, container, handle, 200);
  events.get('pointerdown')({ button: 0, pointerId: 7, clientY: 100, preventDefault() {} });
  events.get('pointermove')({ pointerId: 7, clientY: 500 });
  assert.equal(container.style.height, '200px'); assert.equal(saved.length, 0);
  events.get('pointerup')(); assert.equal(captured, undefined);
  assert.deepEqual(saved, [['graphView.height', '200px']]);
  events.get('keydown')({ key: 'ArrowUp', preventDefault() {} });
  assert.equal(container.style.height, '220px'); assert.equal(attributes.get('aria-valuenow'), 22);
  assert.equal(attributes.get('aria-valuetext'), '220 pixels');
  view.cleanups[0](); assert.equal(events.size, 0);
});

test('graph watches actual iframe size changes and disconnects the observer on cleanup', async () => {
  let notify, observed, disconnected = false, resized = 0;
  const renderer = { containerEl: { style: {} as Record<string, string> }, onResize() { resized++; } };
  const frame = { contentWindow: { renderer }, addEventListener() {}, removeEventListener() {} };
  const selection = { addListener() {}, removeListener() {} };
  const ctx: vm.Context = { ZoteroPane: { itemsView: { onSelect: selection } }, requireItemsView: () => ({ onSelect: selection }),
    window: { ResizeObserver: class { constructor(fn) { notify = fn; } observe(target) { observed = target; } disconnect() { disconnected = true; } } } };
  vm.runInNewContext(await script(new URL('../src/upstream/features/collections/graphView.ts', import.meta.url)), ctx);
  const view = Object.create(ctx.GraphView.prototype);
  Object.assign(view, { active: true, cleanups: [], refreshGraphView: async () => {} });
  await view.initIFrame(frame); assert.equal(observed, frame);
  notify(); assert.equal(resized, 1);
  view.active = false; notify(); assert.equal(resized, 1);
  view.cleanups.forEach(cleanup => cleanup()); assert.equal(disconnected, true);
});
