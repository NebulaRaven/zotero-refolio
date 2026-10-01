import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { testGetString, testGetErrorMessage } from './localization.ts';
import { spCitationGraph, spNormalizeDOI, SPCitationClient } from '../src/core/graph.ts';

function paper(id: number, doi = `10.1000/${id}`, libraryID = 1) {
  return { id, key: `KEY${id}`, libraryID, doi, relatedItems: [] as string[], saved: [] as unknown[], deleted: false,
    getField(name: string) { return name === 'DOI' ? this.doi : `Paper ${id}`; },
    getDisplayTitle() { return `Paper ${id}`; }, isRegularItem: () => true, isEditable: () => true,
    addRelatedItem(item) { this.relatedItems.push(item.key); }, async save(options) { this.saved.push(options); }
  };
}

async function fixture(items = [paper(1), paper(2)], disk: Record<string, any> = {}) {
  const preferences = new Map<string, unknown>();
  const prompts: unknown[][] = [], responses: Array<{ button: number; remember: boolean }> = [];
  const requests: string[] = [], notices: string[] = [], errors: unknown[] = [];
  const timers = new Map<number, () => Promise<void>>();
  let tick = 0, observer: any, unregistered = 0, transactions = 0, disposed = 0, refreshed = 0;
  const context: vm.Context = {
    spCitationGraph, spNormalizeDOI, SPCitationClient, AbortController,
    config: { addonRef: 'stylepersonal' }, getString: testGetString, getErrorMessage: testGetErrorMessage,
    getPref: key => preferences.get(key), setPref: (key, value) => preferences.set(key, value),
    getFirstSelectedLibraryID: () => 1,
    addon: { data: { alive: true }, api: { refreshGraphView: async () => { refreshed++; } } },
    window: { alert: text => notices.push(text), setTimeout(fn) { timers.set(++tick, fn); return tick; }, clearTimeout(id) { timers.delete(id); } },
    LocalStorage: class {
      cache = structuredClone(disk); lock = { promise: Promise.resolve() };
      async set(item, key, value) { (this.cache[item.key] ??= {})[key] = value; }
      async flush() { Object.assign(disk, structuredClone(this.cache)); }
      async dispose() { disposed++; }
    },
    Services: { prompt: { BUTTON_POS_0: 1, BUTTON_POS_1: 256, BUTTON_TITLE_IS_STRING: 127,
      confirmEx(...args) { prompts.push(args); const response = responses.shift() || { button: 1, remember: false }; args[8].value = response.remember; return response.button; }
    } },
    ztoolkit: { ProgressWindow: class {
      createLine({ text }) { notices.push(text); return this; } show() { return this; } close() {} changeLine() {}
    } },
    Zotero: {
      getMainWindow: () => context.window,
      Items: { getAll: async library => items.filter(item => item.libraryID === library),
        get: id => items.find(item => item.id === id) ?? false, getAsync: async id => items.find(item => item.id === id) ?? false },
      Libraries: { get: id => ({ id, name: `Library ${id}`, editable: true }) },
      DB: { executeTransaction: async operation => { transactions++; await operation(); } },
      Promise: { delay: async () => {} }, logError: error => errors.push(error),
      Notifier: { registerObserver(value) { observer = value; return 'citations'; }, unregisterObserver(id) { assert.equal(id, 'citations'); unregistered++; } },
      HTTP: { request: async (_method, url) => {
        requests.push(decodeURIComponent(url.split('/works/')[1]));
        return { response: { status: 'ok', message: { reference: [{ DOI: items[1]?.doi }] } } };
      } }
    }
  };
  vm.createContext(context);
  for (const file of ['citations', 'citationPrompts']) vm.runInContext(await script(new URL(`../src/app/${file}.ts`, import.meta.url)), context);
  return { context, items, disk, preferences, prompts, responses, requests, notices, errors, timers,
    notify(event, ids) { observer.notify(event, 'item', ids); },
    async flush() { const tasks = [...timers.values()]; timers.clear(); for (const task of tasks) await task(); },
    get unregistered() { return unregistered; }, get transactions() { return transactions; }, get disposed() { return disposed; }, get refreshed() { return refreshed; }
  };
}

test('citation updates persist direction, add both native related links and preserve unrelated links and metadata', async () => {
  const f = await fixture(); f.items[0].relatedItems.push('EXISTING');
  assert.equal(await f.context.spFetchCitationRelations(), true);
  assert.deepEqual(f.items.map(item => item.relatedItems), [['EXISTING', 'KEY2'], ['KEY1']]);
  assert.deepEqual(structuredClone(f.items.map(item => item.saved)), [[{ skipDateModifiedUpdate: true }], [{ skipDateModifiedUpdate: true }]]);
  assert.deepEqual(f.context.addon.api.citationReport.edges, [{ source: 1, target: 2 }]);
  assert.deepEqual(f.disk.references['10.1000/1'].references, ['10.1000/2']);
  assert.equal(f.refreshed, 1);
  await f.context.spFetchCitationRelations();
  assert.equal(f.requests.length, 2, 'Fresh cache should avoid another network query');
  assert.equal(f.items[0].saved.length, 1, 'Existing associations should not be rewritten');
  const restored = await fixture(f.items, f.disk);
  const graph = await restored.context.spGetCitationGraph(f.items);
  assert.deepEqual(graph.citationEdges, [{ source: 1, target: 2 }]);
  assert.deepEqual(graph.nodes[2].links, {});
  assert.equal(restored.requests.length, 0);
});

test('manual citations support missing DOIs, persist item identities, and remain directed and idempotent', async () => {
  const f = await fixture([paper(1, ''), paper(2, '')]);
  await f.context.spAddManualCitation(1, 2);
  await f.context.spAddManualCitation(1, 2);
  assert.deepEqual(f.items.map(item => item.relatedItems), [['KEY2'], ['KEY1']]);
  assert.equal(f.items[0].saved.length, 1);
  const reopened = await fixture(f.items, f.disk);
  assert.deepEqual((await reopened.context.spGetCitationGraph(f.items)).citationEdges, [{ source: 1, target: 2 }]);
  await assert.rejects(f.context.spAddManualCitation(1, 1), /ui-error-citation-select-two/);
  f.items[1].libraryID = 2;
  await assert.rejects(f.context.spAddManualCitation(1, 2), /ui-error-citation-select-two/);
  assert.equal(f.requests.length, 0);
});

test('manual and fetched citations merge without duplicate edges or cross-library matches', () => {
  const items = [paper(1), paper(2), paper(3, '10.1000/2', 2), paper(4, '', 1)];
  const graph = spCitationGraph(items, new Map([['10.1000/1', ['10.1000/2']]]), new Map([['1/KEY1', ['KEY2', 'KEY4']]]));
  assert.deepEqual(graph.citationEdges, [{ source: 1, target: 2 }, { source: 1, target: 4 }]);
  assert.deepEqual(graph.nodes[3].links, {});
  assert.equal(graph.citationDataAvailable, true);
});

test('remembered update and skip choices are independent for additions and empty graphs and can be reset', async () => {
  const f = await fixture();
  f.responses.push({ button: 1, remember: true }, { button: 0, remember: true }, { button: 1, remember: false });
  assert.equal(f.context.spConfirmCitationUpdate('added', 2, 'Library'), false);
  assert.equal(f.preferences.get('citations.onAdd'), 'skip');
  assert.equal(f.context.spConfirmCitationUpdate('added', 2, 'Library'), false);
  assert.equal(f.prompts.length, 1);
  assert.equal(f.context.spConfirmCitationUpdate('empty', 2, 'Library'), true);
  assert.equal(f.preferences.get('citations.onEmpty'), 'update');
  assert.equal(f.context.spConfirmCitationUpdate('empty', 2, 'Library'), true);
  assert.equal(f.prompts.length, 2);
  f.preferences.set('citations.onAdd', 'ask');
  assert.equal(f.context.spConfirmCitationUpdate('added', 2, 'Library'), false);
  assert.equal(f.prompts.length, 3);
  assert.equal(f.preferences.get('citations.onAdd'), 'ask');
  assert.equal(f.prompts[0][7], 'Remember this choice and do not ask again');
});

test('declining or skipping prompts causes no HTTP or data writes; explicit update still works', async () => {
  const f = await fixture();
  assert.equal(await f.context.spFetchCitationRelations({ reason: 'added' }), false);
  assert.equal(f.requests.length, 0); assert.equal(f.transactions, 0); assert.deepEqual(f.disk, {});
  f.preferences.set('citations.onAdd', 'skip');
  assert.equal(await f.context.spFetchCitationRelations({ reason: 'added' }), false);
  assert.equal(f.prompts.length, 1);
  assert.equal(await f.context.spFetchCitationRelations(), true);
  assert.equal(f.requests.length, 2);
});

test('adding papers queries only the new batch and matches against the full library and earlier reference lists', async () => {
  const f = await fixture([paper(1), paper(2), paper(3)], { references: {
    '10.1000/1': { at: Date.now(), references: ['10.1000/3'] }
  } });
  f.preferences.set('citations.onAdd', 'update');
  await f.context.spFetchCitationRelations({ reason: 'added', itemIDs: [3] });
  assert.deepEqual(f.requests, ['10.1000/3']);
  assert.deepEqual(f.context.addon.api.citationReport.edges, [{ source: 1, target: 3 }, { source: 3, target: 2 }]);
  assert.deepEqual(f.disk.references['10.1000/1'].references, ['10.1000/3']);
  await f.context.spFetchCitationRelations({ reason: 'added', itemIDs: [3] });
  assert.equal(f.requests.length, 1, 'A batch covered by an intervening query must not be queried again');
});

test('network failures preserve saved references and report the failure', async () => {
  const f = await fixture(undefined, { references: { '10.1000/1': { at: 0, references: ['10.1000/2'] } } });
  f.context.Zotero.HTTP.request = async () => { throw new Error('HTTP 503'); };
  await f.context.spFetchCitationRelations();
  assert.equal(f.context.addon.api.citationReport.available, 0);
  assert.equal(f.context.addon.api.citationReport.failures.length, 2);
  assert.deepEqual(f.disk.references['10.1000/1'].references, ['10.1000/2']);
  assert.deepEqual((await f.context.spGetCitationGraph(f.items)).citationEdges, [{ source: 1, target: 2 }]);
});

test('read-only libraries and invalid manual selections fail before any write', async () => {
  const f = await fixture();
  f.context.Zotero.Libraries.get = () => ({ editable: false });
  f.items[0].isEditable = () => false;
  await assert.rejects(f.context.spFetchCitationRelations(), /ui-error-citations-read-only/);
  await assert.rejects(f.context.spAddManualCitation(1, 2), /ui-error-citations-read-only/);
  assert.equal(f.requests.length, 0); assert.equal(f.transactions, 0);
});

test('empty-graph prompts run only on entry, coalesce concurrent entries and stop once a relationship exists', async () => {
  const f = await fixture();
  await Promise.all([f.context.spPromptEmptyCitationGraph(1, () => true), f.context.spPromptEmptyCitationGraph(1, () => true)]);
  assert.equal(f.prompts.length, 1);
  for (let i = 0; i < 3; i++) await f.context.spGetCitationGraph(f.items);
  assert.equal(f.prompts.length, 1, 'Ordinary refresh must not prompt');
  await f.context.spPromptEmptyCitationGraph(1, () => true);
  assert.equal(f.prompts.length, 2, 'An unremembered choice should be asked on the next entry');
  await f.context.spAddManualCitation(1, 2);
  await f.context.spPromptEmptyCitationGraph(1, () => true);
  assert.equal(f.prompts.length, 2);
  assert.equal(f.requests.length, 0);
});

test('new-item observer skips IDs Zotero no longer knows about', async () => {
  const f = await fixture([paper(1), paper(2)]);
  const stop = f.context.spRegisterCitationUpdates();
  f.notify('add', [99, 2]);
  assert.equal(f.timers.size, 1);
  await f.flush(); assert.equal(f.prompts.length, 1);
  assert.deepEqual(f.errors, []);
  stop();
});

test('new-item observer batches papers, ignores attachments and existing-item edits, and handles a DOI supplied later', async () => {
  const f = await fixture([paper(1), paper(2), paper(3), paper(4, '')]);
  f.items[2].isRegularItem = () => false;
  const stop = f.context.spRegisterCitationUpdates();
  f.notify('add', [1]); f.notify('add', [2, 3, 4]);
  assert.equal(f.timers.size, 1);
  await f.flush(); assert.equal(f.prompts.length, 1);
  assert.match(String(f.prompts[0][2]), /2 new papers/);
  f.notify('modify', [1, 2]); assert.equal(f.timers.size, 0);
  f.items[3].doi = '10.1000/4'; f.notify('modify', [4]);
  await f.flush(); assert.equal(f.prompts.length, 2);
  f.notify('add', [1]); stop();
  assert.equal(f.timers.size, 0); assert.equal(f.unregistered, 1);
  f.notify('add', [1]); assert.equal(f.timers.size, 0);
});

test('relationship writes do not recursively trigger new-paper prompts', async () => {
  const f = await fixture(); f.preferences.set('citations.onAdd', 'update');
  const stop = f.context.spRegisterCitationUpdates();
  for (const item of f.items) item.save = async options => { item.saved.push(options); f.notify('modify', [item.id]); };
  f.notify('add', [1, 2]); await f.flush();
  assert.equal(f.transactions, 1); assert.equal(f.timers.size, 0); assert.equal(f.requests.length, 2);
  stop();
});

test('shutdown cancels an in-flight lookup, releases storage and makes queued work inert', async () => {
  const f = await fixture(); let complete: (value: any) => void;
  f.context.Zotero.HTTP.request = async () => new Promise(resolve => { complete = resolve; });
  const pending = f.context.spFetchCitationRelations();
  while (!complete) await new Promise(resolve => setImmediate(resolve));
  const queued = f.context.spFetchCitationRelations();
  f.context.addon.data.alive = false;
  const stopped = f.context.spShutdownCitations();
  complete({ response: { status: 'ok', message: { reference: [] } } });
  assert.equal(await pending, false); assert.equal(await queued, false); await stopped;
  assert.equal(f.transactions, 0); assert.equal(f.disposed, 1); assert.deepEqual(f.disk, {});
});

test('manual linking stays responsive during a network lookup and survives its later results', async () => {
  const f = await fixture(); let complete: (value: any) => void;
  f.context.Zotero.HTTP.request = async () => new Promise(resolve => { complete = resolve; });
  const fetching = f.context.spFetchCitationRelations({ itemIDs: [1] });
  while (!complete) await new Promise(resolve => setImmediate(resolve));
  await f.context.spAddManualCitation(2, 1);
  assert.deepEqual((await f.context.spGetCitationGraph(f.items)).citationEdges, [{ source: 2, target: 1 }]);
  complete({ response: { status: 'ok', message: { reference: [{ DOI: '10.1000/2' }] } } });
  await fetching;
  assert.deepEqual((await f.context.spGetCitationGraph(f.items)).citationEdges, [{ source: 1, target: 2 }, { source: 2, target: 1 }]);
  assert.deepEqual(f.disk['manual:1'].KEY2, ['KEY1']);
});
