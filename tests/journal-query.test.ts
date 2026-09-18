import { testGetString, testGetErrorMessage } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { script } from './source.mts';
import { domFixture } from './dom-fixture.ts';
import * as journals from '../src/core/journals.ts';
import * as manual from '../src/core/manualRanks.ts';

const normalize = journals.spNormalizeJournalName;
const response = (all: Record<string, unknown>) => ({ data: { officialRank: { all } } });
const plain = value => JSON.parse(JSON.stringify(value));
const root = new URL('../src/', import.meta.url);

test('query-only settings persist across bilingual names, preserve overrides and can be cleared', () => {
  const names = journals.spPublicationNames('Acta Psychologica Sinica');
  const aliases = { 'New Journal': ['新期刊'] };
  let records = manual.spSaveManualRankRecord('{}', names, {}, normalize, ' New Journal ');
  assert.deepEqual(journals.spJournalQuery('心理学报', aliases, JSON.stringify(records)).names, ['New Journal', '新期刊']);
  records = manual.spSaveManualRankRecord(records, names, { sciif: '3' }, normalize);
  assert.equal(manual.spManualRankRecord(records, names, normalize).queryTitle, 'New Journal');
  records = manual.spSaveManualRankRecord(records, names, { sciif: '3' }, normalize, '');
  assert.equal(manual.spManualRankRecord(records, names, normalize).queryTitle, undefined);
  assert.equal(manual.spManualRankRecord(records, names, normalize).fields.sciif, '3');
  records = manual.spSaveManualRankRecord(records, names, {}, normalize, '');
  assert.deepEqual(records, {});
  assert.throws(() => manual.spSaveManualRankRecord('{}', names, {}, normalize, 'A\nB'), { message: 'ui-error-single-journal' });
});

test('rank merging distinguishes conflicts from equivalent numbers, case and missing fields', () => {
  const same = journals.spMergeRanks([
    { name: 'English', response: response({ sciif: '2.00', sci: 'Q1' }) },
    { name: '中文', response: response({ sciif: 2, sci: ' q1 ', pku: '北核', ssci: 'Q2' }) }
  ]);
  assert.deepEqual(same.conflicts, []);
  assert.deepEqual(same.rank, { sciif: '2.00', sci: 'Q1', pku: '北核', ssci: 'Q2' });
  const clash = journals.spMergeRanks([
    { name: 'New', response: response({ sciif: 3, ssci: 'Q1' }) },
    { name: 'Alias', response: { data: { officialRank: { all: { sciif: 2 } }, customRank: {
      rank: ['x&&&1'], rankInfo: [{ uuid: 'x', abbName: 'ssci', oneRankText: 'Q2' }]
    } } } }
  ]);
  assert.equal(clash.rank.sciif, '3');
  assert.deepEqual(clash.conflicts.map(c => c.field), ['sciif', 'ssci']);
  assert.equal(clash.conflicts[1].values[1].kind, 'custom');
});

async function fixture(prefs: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { 'publicationTagsColumn.source': 'easyscholar',
    'publicationTagsColumn.aliases': '{}', 'publicationTagsColumn.manualRanks': '{}',
    'easyscholar.secretKey': 'TEST', 'garden.apiKey': 'TEST', ...prefs };
  const cache = new Map<string, Record<string, unknown>>(), notices = [], calls: string[] = [];
  const storage = { lock: { promise: Promise.resolve() },
    get: (item, key) => cache.get(item.key)?.[key],
    set: async (item, key, value) => { if (!cache.has(item.key)) cache.set(item.key, {}); cache.get(item.key)[key] = value; } };
  const handlers = new Map<string, () => unknown | Promise<unknown>>();
  const ctx: vm.Context = { ...journals, ...manual, getPref: key => values[key], setPref: (key, value) => values[key] = value,
    getString: testGetString, getErrorMessage: testGetErrorMessage, addon: { api: { journalStorage: storage } },
    ztoolkit: { ProgressWindow: class {
      lines = []; constructor(title) { notices.push({ title, lines: this.lines }); }
      show() { return this; } createLine(line) { this.lines.push(line); return this; }
    } }, window: { alert: assert.fail },
    Zotero: { getMainWindows: () => [], locale: 'en', HTTP: { request: async (_method, _url, options) => {
      const name = JSON.parse(options.body).items[0].query; calls.push(name); return handlers.get(name)?.();
    } } },
    getHTTPStatus: () => 500, showPublicationTagsError() {},
    getPublicationTagNotificationPolicy: trigger => ({ showError: trigger === 'context-menu', showResult: trigger !== 'automatic' }),
    publicationRequestScheduler: { run: (_key, fn) => fn() },
    requests: { get: async url => { const name = new URL(url).searchParams.get('publicationName'); calls.push(name); return handlers.get(name)?.(); } }
  };
  for (const file of ['app/journalLookup.ts', 'app/ui.ts']) vm.runInNewContext(await script(new URL(file, root)), ctx);
  for (const fn of ['updatePublicationTags', 'getGardenJournalRank']) vm.runInNewContext(await script(new URL('upstream/utils/base.ts', root), fn), ctx);
  const setQuery = (title, queryTitle, fields = {}) => values['publicationTagsColumn.manualRanks'] = JSON.stringify(
    manual.spSaveManualRankRecord(values['publicationTagsColumn.manualRanks'], journals.spPublicationNames(title, values['publicationTagsColumn.aliases']), fields, normalize, queryTitle));
  return { ctx, values, cache, storage, notices, calls, handlers, setQuery,
    run: (title, trigger = 'automatic') => ctx.updatePublicationTags(storage, title, trigger) };
}

test('Human Nature uses the full query title, keeps its original cache key and works with manual overrides disabled', async () => {
  const f = await fixture({ 'function.manualJournalRanks.enable': false });
  const full = 'Human Nature-An Interdisciplinary Biosocial Perspective';
  f.setQuery('Human Nature', full);
  f.handlers.set(full, () => response({ sciif: 2, ssci: 'Q1' }));
  await f.run('Human Nature');
  assert.deepEqual(f.calls, [full]);
  assert.deepEqual(plain(f.cache.get('Human Nature').rank), { sciif: '2', ssci: 'Q1' });
  assert.equal(f.cache.has(full), false);
  f.setQuery('Human Nature', '');
  assert.equal(f.ctx.spGetAutomaticJournalRanks(f.storage, 'Human Nature'), undefined);
  f.handlers.set('Human Nature', () => response({}));
  await f.run('Human Nature');
  assert.deepEqual(plain(f.ctx.spGetAutomaticJournalRanks(f.storage, 'Human Nature')), {});
});

test('automatic conflict notices deduplicate concurrent and repeated queries but report changed or recurring conflicts', async () => {
  const f = await fixture({ 'publicationTagsColumn.aliases': JSON.stringify({ A: ['B'] }) });
  let secondary = '3';
  f.handlers.set('A', () => response({ sciif: '2', ssci: 'Q1' }));
  f.handlers.set('B', () => response({ sciif: secondary, pku: '北核' }));
  await Promise.all([f.run('A'), f.run('A')]); assert.equal(f.notices.length, 1);
  await f.run('A'); assert.equal(f.notices.length, 1);
  secondary = '4'; await f.run('A'); assert.equal(f.notices.length, 2);
  secondary = '2'; await f.run('A'); assert.equal(f.notices.length, 2);
  secondary = '4'; await f.run('A'); assert.equal(f.notices.length, 3);
  f.setQuery('A', '', { sciif: '5' }); await f.run('A', 'context-menu');
  assert.equal(f.notices.length, 4);
  assert.match(f.notices.at(-1).lines[1].text, /A = 2.*B = 4.*Using 5 \(Manual\)/);
  assert.equal(f.ctx.spGetJournalLookup(f.storage, 'A').conflicts.length, 1);
});

test('changing a query hides stale cache and discards an older in-flight result', async () => {
  const f = await fixture();
  let finish: (value: unknown) => void;
  const delayed = new Promise(resolve => finish = resolve);
  f.handlers.set('Old', () => delayed); f.handlers.set('New', () => response({ sciif: 7 }));
  const old = f.run('Old');
  f.setQuery('Old', 'New');
  await f.run('Old'); finish(response({ sciif: 2 })); await old;
  assert.equal(f.ctx.spGetAutomaticJournalRanks(f.storage, 'Old').sciif, '7');
  assert.deepEqual(plain(f.ctx.spGetJournalLookup(f.storage, 'Old').names), ['New']);
  f.setQuery('Old', 'Missing');
  assert.equal(f.ctx.spGetAutomaticJournalRanks(f.storage, 'Old'), undefined);
  await f.run('Old'); assert.equal(f.cache.get('Old').rank['sciif'], '7');
  assert.equal(f.ctx.spGetAutomaticJournalRanks(f.storage, 'Old'), undefined);
});

test('partial renamed queries preserve only cache from the same query and record failed aliases', async () => {
  const f = await fixture({ 'publicationTagsColumn.aliases': JSON.stringify({ New: ['新刊'] }) });
  await f.storage.set({ key: 'Old' }, 'rank', { sciif: '1', pku: 'Old label' });
  f.setQuery('Old', 'New');
  f.handlers.set('New', () => response({ sciif: '8' }));
  f.handlers.set('新刊', () => { throw new Error('network'); });
  await f.run('Old');
  assert.deepEqual(plain(f.cache.get('Old').rank), { sciif: '8' });
  assert.deepEqual(plain(f.ctx.spGetJournalLookup(f.storage, 'Old').failedNames), ['新刊']);
});

test('Garden uses the same query-title and conflict policy', async () => {
  const f = await fixture({ 'publicationTagsColumn.source': 'garden', 'publicationTagsColumn.aliases': JSON.stringify({ New: ['Alias'] }) });
  f.setQuery('Old', 'New');
  for (const [name, value] of [['New', 'Q1'], ['Alias', 'Q2']]) f.handlers.set(name, () => ({ status: 200, response: {
    results: [{ matched: true, labels: [{ name: 'JCR', value }, { name: 'IF', value: 2 }] }]
  } }));
  await f.run('Old');
  assert.deepEqual(f.calls, ['New', 'Alias']);
  assert.equal(f.cache.get('Old').rank['JCR'], 'Q1'); assert.equal(f.notices.length, 1);
  assert.equal(f.ctx.spGetJournalLookup(f.storage, 'Old').conflicts[0].field, 'JCR');
});

async function panel(f: Awaited<ReturnType<typeof fixture>>) {
  const dom = domFixture(); const parent = new dom.Element(), status = new dom.Element();
  const win: any = new dom.Element('window'); win.document = dom.document; dom.document.defaultView = win;
  dom.Element.prototype['scrollIntoView'] = () => {};
  vm.runInNewContext(await script(new URL('app/manualRanks.ts', root)), f.ctx);
  const stop = f.ctx.spRenderManualRanks(dom.document, parent, status);
  const input = label => parent.querySelectorAll('input').find(node => node.getAttribute('aria-label') === label);
  const click = async label => {
    const button = parent.querySelectorAll('button').find(node => node.textContent === label);
    assert.ok(button, label);
    for (const listener of button.listeners.get('click') || []) await listener({});
  };
  const text = () => [parent, ...parent.querySelectorAll('p'), ...parent.querySelectorAll('td')].map(node => node.textContent).join('\n');
  return { parent, status, input, click, text, stop };
}

test('journal settings save query-only records, fetch them immediately and show conflict sources and the manual choice', async () => {
  const f = await fixture({ 'publicationTagsColumn.aliases': JSON.stringify({ New: ['Alias'] }) });
  f.handlers.set('New', () => response({ sciif: '3', ssci: 'Q1' }));
  f.handlers.set('Alias', () => response({ sciif: '2', pku: '北核' }));
  const ui = await panel(f); f.ctx.addon.api.openManualJournal('Old');
  ui.input('Query journal name').value = 'New';
  await ui.click('Save journal settings');
  assert.deepEqual(f.calls, ['New', 'Alias']);
  assert.equal(manual.spManualRankRecord(f.values['publicationTagsColumn.manualRanks'], ['Old'], normalize).queryTitle, 'New');
  assert.match(ui.text(), /New: 3\nAlias: 2/);
  f.setQuery('Old', 'New', { sciif: '9' }); f.ctx.addon.api.openManualJournal('Old');
  assert.equal(ui.input('Query journal name').value, 'New');
  assert.match(ui.text(), /9 \(Manual\)/);
  ui.input('Query journal name').value = 'Unsaved';
  await ui.click('Refresh journal ratings');
  assert.match(ui.status.textContent, /Save the query name/); assert.equal(f.calls.length, 2);
  ui.stop(); assert.equal(f.ctx.addon.api.openManualJournal, undefined);
});

test('a lookup finishing after the settings journal changes leaves the current panel intact', async () => {
  const f = await fixture(); let finish: (value: unknown) => void;
  f.handlers.set('New', () => new Promise(resolve => finish = resolve));
  const ui = await panel(f); f.ctx.addon.api.openManualJournal('Old');
  ui.input('Query journal name').value = 'New';
  const saving = ui.click('Save journal settings');
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.deepEqual(f.calls, ['New']);
  f.ctx.addon.api.openManualJournal('Other');
  finish(response({ sciif: 6 })); await saving;
  assert.equal(ui.input('Journal name').value, 'Other');
  assert.equal(ui.input('Query journal name').value, '');
  assert.doesNotMatch(ui.text(), /Queried: New/);
  assert.equal(f.cache.get('Old').rank['sciif'], '6');
  ui.stop();
});
