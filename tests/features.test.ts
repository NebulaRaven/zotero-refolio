import { script } from './source.mts';
import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spFilterGraph, spSharedGraph } from '../src/core/graph.ts';
import { spNormalizeJournalName, spPublicationNames, spJournalQuery } from '../src/core/journals.ts';
import { spManualRankRecord, spReadManualRanks, spSaveManualRankRecord, spEffectiveRanks, spValidateManualRank } from '../src/core/manualRanks.ts';
import { spFeatureDefinitions, spRetiredPreferences } from '../src/core/features.ts';
import { spGenealogyRelations, spGenealogyGraph, SPGenealogyClient } from '../src/core/genealogy.ts';

const graph = { nodes: {
  a: { type: 'item', year: 2020, links: { b: true } }, b: { type: 'item', year: 2021, links: { c: true } },
  c: { type: 'item', year: 2022, links: { d: true } }, d: { type: 'item', year: 2023, links: {} },
  e: { type: 'item', year: null, links: {} }, f: { type: 'item', year: 2021, links: {} }
} };
test('graph expands one or two undirected neighbourhood layers while keeping citation direction', () => {
  const first = spFilterGraph(graph, ['b']);
  assert.deepEqual(Object.keys(first.nodes).sort(), ['a', 'b', 'c']);
  assert.deepEqual(first.nodes.a.links, { b: true });
  assert.deepEqual(first.nodes.b.links, { c: true });
  assert.deepEqual(first.nodes.c.links, {});
  assert.deepEqual(Object.keys(spFilterGraph(graph, ['b'], { depth: 2 }).nodes).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(spFilterGraph(graph, []).nodes, {});
  assert.deepEqual(graph.nodes.c.links, { d: true });
});
test('year bounds are inclusive, exclude unknown years, and isolation is evaluated after filtering', () => {
  const result = spFilterGraph(graph, [], { scope: 'all', minYear: 2021, maxYear: 2022, hideIsolated: true });
  assert.deepEqual(Object.keys(result.nodes), ['b', 'c']);
  assert.deepEqual(result.nodes.b.links, { c: true });
  assert.equal(Object.keys(spFilterGraph(graph, [], { scope: 'all' }).nodes).length, 6);
  assert.throws(() => spFilterGraph(graph, [], { minYear: 2023, maxYear: 2022 }), /year/);
  assert.throws(() => spFilterGraph(graph, [], { minYear: 'abc' }), /year/);
});
test('shared tags join papers through one hub per tag and do not equate different hierarchy paths', () => {
  const papers = [{ id: 1, tags: ['Theory/a', 'same'] }, { id: 2, tags: ['Method/a'] }, { id: 3, tags: ['same', 'same'] }, { id: 4, tags: ['solo', 'solo'] }];
  const result = spSharedGraph(papers, p => p.tags, 'tag');
  assert.deepEqual(Object.keys(result.nodes), ['1', '2', '3', '4', 'tag:same']);
  assert.deepEqual(result.nodes['tag:same'], { links: { 1: true, 3: true }, type: 'tag', hub: true, label: 'same' });
  for (const id of [1, 2, 3, 4]) assert.deepEqual(result.nodes[id].links, {});
});
const sharedGraph = (papers: Array<{ id: number; year?: number | null; tags: string[] }>) => {
  const result = spSharedGraph(papers, p => p.tags, 'tag');
  for (const paper of papers) result.nodes[paper.id].year = paper.year ?? null;
  return result;
};
const linkCount = (result: { nodes: Record<string, { links: Record<string, boolean> }> }) =>
  Object.values(result.nodes).reduce((sum, node) => sum + Object.keys(node.links).length, 0);
test('a shared tag hub does not spend a depth level, so papers sharing a tag are one step apart', () => {
  const raw = sharedGraph([{ id: 1, tags: ['x'] }, { id: 2, tags: ['x', 'y'] }, { id: 3, tags: ['y'] },
    { id: 4, tags: ['x', 'w'] }, { id: 5, tags: ['x', 'w'] }]);
  const first = spFilterGraph(raw, [1]);
  // tag:y reaches paper 3 only at depth 2, so with one visible paper it is dropped; tag:w joins two visible papers.
  assert.deepEqual(Object.keys(first.nodes).sort(), ['1', '2', '4', '5', 'tag:w', 'tag:x']);
  assert.deepEqual(first.nodes['tag:x'].links, { 1: true, 2: true, 4: true, 5: true });
  assert.deepEqual(first.nodes['tag:w'].links, { 4: true, 5: true });
  assert.deepEqual(Object.keys(spFilterGraph(raw, [1], { depth: 2 }).nodes).sort(), ['1', '2', '3', '4', '5', 'tag:w', 'tag:x', 'tag:y']);
  assert.deepEqual(Object.keys(spFilterGraph(raw, [3]).nodes).sort(), ['2', '3', 'tag:y']);
});
test('year bounds keep shared hubs, which then need two visible papers before isolation is judged', () => {
  const raw = sharedGraph([{ id: 1, year: 2020, tags: ['x'] }, { id: 2, year: 2010, tags: ['x'] },
    { id: 3, year: 2020, tags: ['y'] }, { id: 4, year: 2021, tags: ['y'] }, { id: 5, year: null, tags: ['y'] }]);
  // A note-mode tag node carries no hub flag and keeps the year rule of ordinary nodes.
  raw.nodes.note = { type: 'tag', links: { 3: true } };
  const filtered = spFilterGraph(raw, [], { scope: 'all', minYear: 2015 });
  assert.deepEqual(Object.keys(filtered.nodes).sort(), ['1', '3', '4', 'tag:y']);
  assert.deepEqual(filtered.nodes['tag:y'].links, { 3: true, 4: true });
  const isolated = spFilterGraph(raw, [], { scope: 'all', minYear: 2015, hideIsolated: true });
  assert.deepEqual(Object.keys(isolated.nodes).sort(), ['3', '4', 'tag:y']);
  assert.deepEqual(Object.keys(spFilterGraph(raw, [1], { minYear: 2015, hideIsolated: true }).nodes), []);
});
test('3000 papers sharing one tag produce links linear in the papers', () => {
  const papers = Array.from({ length: 3000 }, (_, index) => ({ id: index + 1, year: 2020, tags: ['shared'] }));
  const raw = sharedGraph(papers);
  assert.equal(Object.keys(raw.nodes).length, 3001);
  assert.equal(linkCount(raw), 3000);
  const selected = spFilterGraph(raw, [1], { hideIsolated: true });
  assert.equal(Object.keys(selected.nodes).length, 3001);
  assert.equal(linkCount(selected), 3000);
  assert.equal(linkCount(spFilterGraph(raw, [], { scope: 'all', minYear: 2020 })), 3000);
});

const normalize = spNormalizeJournalName;
test('manual ranks are shared across bilingual names and survive fresh provider results without mutating them', () => {
  const names = spPublicationNames('Acta Psychologica Sinica');
  let records = spSaveManualRankRecord('{}', names, { sciif: '0', pku: '北大中文核心', sci: null }, normalize);
  const record = spManualRankRecord(JSON.stringify(records), spPublicationNames('心理学报'), normalize);
  const provider = { sciif: '5', sci: 'Q2', cscd: '核心库' };
  assert.deepEqual(spEffectiveRanks(provider, record), { sciif: '0', pku: '北大中文核心', cscd: '核心库' });
  assert.equal(provider.sciif, '5'); assert.equal(provider.sci, 'Q2');
  assert.deepEqual(spEffectiveRanks({ sciif: '9', sci: 'Q1' }, record), { sciif: '0', pku: '北大中文核心' });
  records = spSaveManualRankRecord(records, spPublicationNames('心理学报'), {}, normalize);
  assert.equal(Object.keys(records).length, 0);
  assert.equal(spEffectiveRanks(provider, spManualRankRecord(records, names, normalize)), provider);
});
test('manual ranks work without an API key or cached data, and invalid edits fail before replacing values', () => {
  assert.deepEqual(spEffectiveRanks(undefined, { fields: { pku: '北核' } }), { pku: '北核' });
  assert.throws(() => spValidateManualRank('sciif', '-1'), { message: 'ui-error-impact-factor-nonnegative' });
  assert.throws(() => spValidateManualRank('sci', 'Q5'), { message: 'ui-error-quartile' });
  assert.equal(spValidateManualRank('sci', 'q2'), 'Q2');
  assert.throws(() => spSaveManualRankRecord('{}', ['Sleep'], JSON.parse('{"__proto__":null}'), normalize), /field/);
  assert.throws(() => spSaveManualRankRecord('{}', [], { sci: 'Q1' }, normalize), /journal/);
});
test('actual journal adapter reads overrides for both columns and can disable them without deleting stored data', async () => {
  const prefs = { 'publicationTagsColumn.manualRanks': JSON.stringify(spSaveManualRankRecord('{}', ['Sleep'], { sciif: '7.2' }, normalize)) };
  const ctx: vm.Context = { getPref: key => prefs[key], spPublicationNames, spNormalizeJournalName, spJournalQuery, spManualRankRecord, spReadManualRanks, spEffectiveRanks };
  vm.runInNewContext(await script(new URL('../src/app/journalLookup.ts', import.meta.url)), ctx);
  vm.runInNewContext(await script(new URL('../src/app/manualRanks.ts', import.meta.url)), ctx);
  const storage = { get: (_item, field) => field === 'rank' ? { sciif: '5', sci: 'Q1' } : undefined };
  assert.equal(ctx.spGetJournalRanks(storage, 'Sleep').sciif, '7.2');
  prefs['function.manualJournalRanks.enable'] = false;
  assert.equal(ctx.spGetJournalRanks(storage, 'Sleep').sciif, '5');
  assert.ok(prefs['publicationTagsColumn.manualRanks'].includes('7.2'));
});
test('journal adapter reuses parsed preferences and per-title results until a journal preference changes', async () => {
  const manualRanks = (value: string) => JSON.stringify(spSaveManualRankRecord('{}', ['Sleep'], { sciif: value }, normalize));
  const prefs = { 'publicationTagsColumn.aliases': JSON.stringify({ Sleep: ['Sleep Journal'] }),
    'publicationTagsColumn.manualRanks': manualRanks('7.2'), 'publicationTagsColumn.source': 'easyscholar' };
  const queries: unknown[][] = [], records: unknown[][] = [];
  const ctx: vm.Context = { getPref: key => prefs[key], spPublicationNames, spNormalizeJournalName, spReadManualRanks, spEffectiveRanks,
    spJournalQuery: (...args: Parameters<typeof spJournalQuery>) => { queries.push(args); return spJournalQuery(...args); },
    spManualRankRecord: (...args: Parameters<typeof spManualRankRecord>) => { records.push(args); return spManualRankRecord(...args); } };
  vm.runInNewContext(await script(new URL('../src/app/journalLookup.ts', import.meta.url)), ctx);
  vm.runInNewContext(await script(new URL('../src/app/manualRanks.ts', import.meta.url)), ctx);
  const storage = { get: (_item, field) => field === 'rank' ? { sciif: '5', sci: 'Q1' } : undefined };
  const read = (title = 'Sleep') => [ctx.spGetJournalRanks(storage, title).sciif, ctx.spGetJournalQuery(title).provider, ctx.spGetAutomaticJournalRanks(storage, title).sci];
  const calls = () => [queries.length, records.length];
  for (let i = 0; i < 3; i++) assert.deepEqual(read(), ['7.2', 'easyscholar', 'Q1']);
  assert.deepEqual(calls(), [1, 1]);
  assert.deepEqual(read('Sleep Journal'), ['7.2', 'easyscholar', 'Q1']);
  assert.deepEqual(calls(), [2, 2]);
  // Both titles receive the same parsed preferences instead of parsing the raw strings again.
  assert.equal(typeof queries[0][1], 'object'); assert.equal(queries[1][1], queries[0][1]);
  assert.equal(typeof queries[0][2], 'object'); assert.equal(queries[1][2], queries[0][2]); assert.equal(records[1][0], records[0][0]);
  prefs['publicationTagsColumn.aliases'] = JSON.stringify({ Sleep: ['Sleep Research'] });
  assert.deepEqual(read(), ['7.2', 'easyscholar', 'Q1']); assert.deepEqual(calls(), [3, 3]);
  prefs['publicationTagsColumn.manualRanks'] = manualRanks('8');
  assert.deepEqual(read(), ['8', 'easyscholar', 'Q1']); assert.deepEqual(calls(), [4, 4]);
  prefs['publicationTagsColumn.source'] = 'garden';
  assert.deepEqual(read(), ['8', 'garden', 'Q1']); assert.deepEqual(calls(), [5, 5]);
  prefs['function.manualJournalRanks.enable'] = false;
  assert.deepEqual(read(), ['5', 'garden', 'Q1']); assert.deepEqual(calls(), [6, 5]);
  prefs['function.manualJournalRanks.enable'] = true;
  assert.deepEqual(read(), ['8', 'garden', 'Q1']); assert.deepEqual(calls(), [7, 6]);
  assert.deepEqual(read(), ['8', 'garden', 'Q1']); assert.deepEqual(calls(), [7, 6]);
});
test('journal adapter keeps reporting invalid journal preferences instead of caching the error', async () => {
  const prefs = { 'publicationTagsColumn.aliases': '{', 'publicationTagsColumn.manualRanks': '{}' };
  const ctx: vm.Context = { getPref: key => prefs[key], spPublicationNames, spNormalizeJournalName, spReadManualRanks, spJournalQuery, spManualRankRecord, spEffectiveRanks };
  vm.runInNewContext(await script(new URL('../src/app/journalLookup.ts', import.meta.url)), ctx);
  vm.runInNewContext(await script(new URL('../src/app/manualRanks.ts', import.meta.url)), ctx);
  for (let i = 0; i < 2; i++) {
    assert.throws(() => ctx.spGetJournalQuery('Sleep'), { name: 'SyntaxError' });
    assert.throws(() => ctx.spGetManualJournalRecord('Sleep'), { name: 'SyntaxError' });
  }
  prefs['publicationTagsColumn.aliases'] = '{}'; prefs['publicationTagsColumn.manualRanks'] = '[]';
  for (let i = 0; i < 2; i++) {
    assert.throws(() => ctx.spGetJournalQuery('Sleep'), { message: 'ui-error-invalid-manual-ranks' });
    assert.throws(() => ctx.spGetManualJournalRecord('Sleep'), { message: 'ui-error-invalid-manual-ranks' });
  }
  prefs['publicationTagsColumn.manualRanks'] = '{}';
  assert.deepEqual(Array.from(ctx.spGetJournalQuery('Sleep').names), ['Sleep']);
  assert.equal(ctx.spGetManualJournalRecord('Sleep'), undefined);
});
test('journal adapter bounds the titles it remembers', async () => {
  let computed = 0;
  const ctx: vm.Context = { getPref: () => undefined, spReadManualRanks,
    spJournalQuery: title => { computed++; return { provider: 'easyscholar', names: [title], redirected: false, identity: title }; } };
  vm.runInNewContext(await script(new URL('../src/app/journalLookup.ts', import.meta.url)), ctx);
  ctx.spGetJournalQuery('First'); ctx.spGetJournalQuery('First');
  assert.equal(computed, 1);
  for (let i = 0; i < ctx.journalCacheLimit; i++) ctx.spGetJournalQuery(`Journal ${i}`);
  assert.equal(computed, ctx.journalCacheLimit + 1);
  ctx.spGetJournalQuery('First');
  assert.equal(computed, ctx.journalCacheLimit + 2);
});
test('actual journal columns render manual values while still fetching missing automatic fields, including an IF of zero', async () => {
  const prefs = {
    'publicationTagsColumn.sortBy': 'sci, -sciif', 'publicationTagsColumn.source': 'easyscholar',
    'publicationColumn.fields': 'publicationTitle', 'IFColumn.field': 'sciif',
    'publicationTagsColumn.manualRanks': JSON.stringify(spSaveManualRankRecord('{}', ['Sleep'], { sciif: '0', pku: '北核' }, normalize))
  };
  const ctx: vm.Context = { getPref: key => prefs[key], getString: testGetString, spPublicationNames, spNormalizeJournalName, spJournalQuery, spManualRankRecord, spReadManualRanks, spEffectiveRanks,
    getPublicationTitle: () => 'Sleep', import_dayjs: { default: { extend() {}, locale() {} } }, import_relativeTime: {}, import_utc: {}, getDayjsLocale: () => 'en',
    Zotero: { locale: 'en', Prefs: { get: key => prefs[key.replace('stylepersonal.', '')] } }, config: { addonRef: 'stylepersonal' } };
  for (const file of ['src/app/journalLookup.ts', 'src/app/manualRanks.ts', 'src/upstream/utils/easyscholar.ts', 'src/upstream/features/item-tree/itemTreeColumns.ts']) {
    vm.runInNewContext(await script(new URL('../'+file, import.meta.url)), ctx);
  }
  const columns = new Map(); let queued = 0, cache;
  const host = { localStorage: { lock: { promise: Promise.resolve() }, get: (_item, field) => field === 'rank' ? cache : undefined },
    publicationUpdateGate: { tryStart: () => true }, scheduleTimeout: () => queued++, patchSetting() {}, patchItemBox() {},
    registerColumn: async (key, provider) => columns.set(key, provider) };
  await ctx.ItemTree.prototype.publicationTags.call(host);
  await ctx.ItemTree.prototype.IF.call(host);
  assert.equal(columns.get('publicationTags')({}).data.pku, '北核');
  assert.equal(columns.get('IF')({}).data, '0'); assert.equal(queued, 2);
  cache = { sciif: '5', sci: 'Q2' };
  assert.equal(columns.get('publicationTags')({}).data.sci, 'Q2');
  assert.equal(columns.get('IF')({}).data, '0'); assert.equal(queued, 2);
});
test('the IF column shares the publication tag update gate, so each title has one pending automatic lookup', async () => {
  const prefs = { 'publicationTagsColumn.sortBy': 'sci', 'publicationColumn.fields': 'publicationTitle', 'IFColumn.field': 'sciif' };
  let title = 'Sleep'; const updates = [];
  const ctx: vm.Context = { getPref: key => prefs[key], getString: testGetString, spPublicationNames, spNormalizeJournalName, spJournalQuery, spManualRankRecord, spReadManualRanks, spEffectiveRanks,
    getPublicationTitle: () => title, updatePublicationTags: async (_storage, journal, trigger) => { updates.push([journal, trigger]); },
    import_dayjs: { default: { extend() {}, locale() {} } }, import_relativeTime: {}, import_utc: {}, getDayjsLocale: () => 'en',
    Zotero: { locale: 'en', Prefs: { get: key => prefs[key.replace('stylepersonal.', '')] } }, config: { addonRef: 'stylepersonal' } };
  for (const file of ['src/app/journalLookup.ts', 'src/app/manualRanks.ts', 'src/upstream/utils/easyscholar.ts', 'src/upstream/utils/keyedTaskGate.ts', 'src/upstream/features/item-tree/itemTreeColumns.ts']) {
    vm.runInNewContext(await script(new URL('../'+file, import.meta.url)), ctx);
  }
  const columns = new Map(), timers: Array<() => Promise<void>> = [];
  const host = { localStorage: { lock: { promise: Promise.resolve() }, get: () => undefined },
    publicationUpdateGate: new ctx.KeyedTaskGate(), scheduleTimeout: callback => timers.push(callback), patchSetting() {}, patchItemBox() {},
    registerColumn: async (key, provider) => columns.set(key, provider) };
  await ctx.ItemTree.prototype.IF.call(host);
  await ctx.ItemTree.prototype.publicationTags.call(host);
  for (let i = 0; i < 3; i++) { columns.get('IF')({}); columns.get('publicationTags')({}); }
  assert.equal(timers.length, 1);
  title = 'Nature'; columns.get('IF')({}); columns.get('IF')({});
  assert.equal(timers.length, 2);
  await Promise.all(timers.splice(0).map(run => run()));
  assert.deepEqual(updates, [['Sleep', 'automatic'], ['Nature', 'automatic']]);
  // A finished lookup releases the title, so a later render can try again.
  columns.get('IF')({}); assert.equal(timers.length, 1);
});

const claim = (id, extra = {}) => ({ rank: 'normal', mainsnak: { datavalue: { value: { id } } }, ...extra });
const person = (id, claims = {}) => ({ id, labels: { en: { value: `Person ${id}` } }, claims: { P31: [claim('Q5')], ...claims } });
test('genealogy preserves supervision direction, separates broad relationships, and rejects deprecated or unspecified targets', () => {
  const entity = person('Q1', { P184: [claim('Q2'), claim('Q3', { rank: 'deprecated' }), { mainsnak: { snaktype: 'novalue' } }], P185: [claim('Q4')], P802: [claim('Q6')] });
  assert.deepEqual(spGenealogyRelations(entity).map(e => [e.source, e.target]), [['Q2', 'Q1'], ['Q1', 'Q4']]);
  assert.deepEqual(spGenealogyRelations(entity, 'general').map(e => [e.source, e.target]), [['Q1', 'Q6']]);
});
test('genealogy merges reciprocal records with provenance and does not invent relationships for unrelated people', () => {
  const entities = {
    Q1: person('Q1', { P185: [claim('Q2')] }),
    Q2: person('Q2', { P184: [claim('Q1', { references: [{ snaks: { P854: [{ datavalue: { value: 'https://example.org/thesis' } }, { datavalue: { value: 'javascript:alert(1)' } }] } }] })] }),
    Q3: person('Q3')
  };
  const result = spGenealogyGraph(entities, 'Q1');
  assert.deepEqual(Object.keys(result.nodes), ['Q1', 'Q2']);
  assert.equal(result.genealogyEdges.length, 1);
  assert.equal(result.genealogyEdges[0].referenced, true);
  assert.equal(result.genealogyEdges[0].statements.length, 2);
  assert.deepEqual(result.genealogyEdges[0].references, ['https://example.org/thesis']);
  assert.deepEqual(result.nodes.Q1.links, { Q2: true });
});
test('genealogy client checks inverse statements, spaces requests, caches successes and sends no author search until requested', async () => {
  let time = 0; const calls = [];
  const entities = { Q1: person('Q1'), Q2: person('Q2', { P184: [claim('Q1')] }) };
  const client = new SPGenealogyClient(async url => {
    calls.push({ url, time }); const params = new URL(url).searchParams;
    if (params.has('query')) return { results: { bindings: [{ person: { value: 'http://www.wikidata.org/entity/Q2' } }] } };
    return { entities: Object.fromEntries(params.get('ids').split('|').map(id => [id, entities[id]])) };
  }, async delay => { time += delay; }, () => time);
  assert.equal(calls.length, 0);
  const graph = await client.graph('Q1');
  assert.deepEqual(graph.nodes.Q1.links, { Q2: true });
  assert.equal(calls.length, 3);
  assert.ok(calls.slice(1).every((call, i) => call.time - calls[i].time >= 300));
  await client.graph('Q1'); assert.equal(calls.length, 3);
});
test('genealogy rejects non-person candidates, propagates failures, and honours cancellation', async () => {
  const notPerson = new SPGenealogyClient(async () => ({ entities: { Q1: { id: 'Q1', claims: {} } } }), async () => {});
  await assert.rejects(notPerson.graph('Q1'), { message: 'ui-error-select-person' });
  let calls = 0;
  const invalid = new SPGenealogyClient(async () => { calls++; return {}; }, async () => {});
  await assert.rejects(invalid.search('Wundt'), { message: 'ui-error-invalid-wikidata-response' });
  await assert.rejects(invalid.search('Wundt'), { message: 'ui-error-invalid-wikidata-response' }); assert.equal(calls, 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(invalid.search('Wundt', 'en', controller.signal), /cancelled/); assert.equal(calls, 2);
});
test('every active default feature switch is represented by a readable panel entry', async () => {
  const defaults = new Map();
  vm.runInNewContext(await fs.readFile(new URL('../addon/prefs.js', import.meta.url), 'utf8'), { pref: (key, value) => defaults.set(key.replace('extensions.zotero.stylepersonal.', ''), value) });
  const switches = new Set(spFeatureDefinitions.map(([key]) => `function.${key}.enable`));
  for (const [key] of defaults) if (key.startsWith('function.')) assert.ok(switches.has(key), key);
  for (const key of switches) assert.equal(typeof defaults.get(key), 'boolean', key);
  assert.equal(switches.size, spFeatureDefinitions.length);
});
test('reader recording and formerly unconditional tools follow their own switches', async () => {
  const prefs = { 'function.titleColumn.enable': false, 'readingProgress.recordingEnabled': true };
  const context: vm.Context = { getPref: key => prefs[key], isEnabel: key => prefs[`function.${key}.enable`] };
  vm.runInNewContext(await script(new URL('../src/upstream/app/mainWindowFeatures.ts', import.meta.url)), context);
  const features = [...context.createImmediateFeatures(), ...context.createStandardFeatures(), ...context.createFinalFeatures()];
  assert.equal(features.find(f => f.id === 'reading-time-recorder').isEnabled(), true);
  for (const [id, key] of [['tab-menu', 'tabMenu'], ['commands', 'commands'], ['fulltext-translate', 'fulltextTranslate']]) {
    const feature = features.find(f => f.id === id); prefs[`function.${key}.enable`] = false; assert.equal(feature.isEnabled(), false);
    prefs[`function.${key}.enable`] = true; assert.equal(feature.isEnabled(), true);
  }
});
test('stopping the reading-time recorder waits for its last save', async () => {
  let finishSave;
  class Recorder { destroy() { return new Promise(resolve => { finishSave = resolve; }); } }
  const context: vm.Context = { getPref: () => true, Record: Recorder };
  vm.runInNewContext(await script(new URL('../src/upstream/app/mainWindowFeatures.ts', import.meta.url)), context);
  const feature = context.createStandardFeatures().find(f => f.id === 'reading-time-recorder');
  const addon = { api: {} as Record<string, unknown> };
  const stop = feature.start({ addon });
  let stopped = false;
  const stopping = Promise.resolve(stop()).then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false);
  finishSave(); await stopping;
  assert.equal(stopped, true);
  assert.equal(addon.api.record, undefined);
});
test('master disable leaves settings available without starting library or reader features', async () => {
  const started = [];
  class Runtime { async start(feature) { started.push(feature.id); } async startAll() { assert.fail('Must not start disabled features'); } }
  const ctx: vm.Context = { getPref: key => key === 'enable' ? false : undefined, addon: { data: { alive: true } }, FeatureRuntime: Runtime };
  vm.runInNewContext(await script(new URL('../src/app/hooks.ts', import.meta.url)), ctx);
  await ctx.onMainWindowLoad({}); assert.deepEqual(started, ['settings-panel']);
});
const retired = ['function.readStatus.enable', 'function.ReadUnreadStatus.enable', 'function.itemTypeFilter.enable',
  'function.renderItemAnnotations.enable', 'function.renderItemNotes.enable', 'graphView.show', 'graphView.theme',
  'function.Recent.enable', 'delayTime', 'cookies.cnki', 'titleColumn.odd', 'titleColumn.even', 'titleColumn.selected',
  'IFColumn.info', 'nestedTags.sortord', 'nestedTags.linkSymbol', 'textTagsColumn.prefix',
  'annotationColumn.style', 'annotationColumn.color', 'annotationColumn.circle', 'AIGenerateTags.prompt', 'remarkColumn.prompt',
  'function.menuVisibility.enable'];
test('retired settings are gone from the defaults and cleared from existing profiles', async () => {
  const defaults = new Set<string>();
  vm.runInNewContext(await fs.readFile(new URL('../addon/prefs.js', import.meta.url), 'utf8'),
    { pref: (key: string) => defaults.add(key.replace('extensions.zotero.stylepersonal.', '')) });
  for (const key of retired) {
    assert.ok(!defaults.has(key), `${key} still has a default`);
    assert.ok(spRetiredPreferences.includes(key), `${key} is not cleared from profiles`);
  }
  assert.ok(!spFeatureDefinitions.some(([key]) => key === 'Recent'));
  const cleared: string[] = [];
  const context: vm.Context = { spRetiredPreferences, config: { prefsPrefix: 'extensions.zotero.stylepersonal' },
    Zotero: { Prefs: { clear: (key: string, global: boolean) => { assert.equal(global, true); cleared.push(key); } } } };
  vm.runInNewContext(await script(new URL('../src/app/hooks.ts', import.meta.url), 'clearRetiredPreferences'), context);
  context.clearRetiredPreferences();
  assert.deepEqual(cleared, spRetiredPreferences.map(key => `extensions.zotero.stylepersonal.${key}`));
});
test('retired settings have no readers left in the source', async () => {
  const base = new URL('../src/', import.meta.url);
  const files = (await fs.readdir(base, { recursive: true })).map(file => file.replaceAll('\\', '/'))
    .filter(file => file.endsWith('.ts') && !file.endsWith('utils/prefs.ts') && file !== 'core/features.ts');
  const text = (await Promise.all(files.map(file => fs.readFile(new URL(file, base), 'utf8')))).join('\n');
  for (const key of retired.filter(key => key !== 'function.Recent.enable')) {
    assert.ok(!text.includes(key), key);
    const column = key.match(/^\w+Column\.(\w+)$/);
    if (column) assert.ok(!new RegExp(`\\$\\{\\w+\\}Column\\.${column[1]}\\b`).test(text), key);
  }
  assert.ok(!/isEnabel\(["'`]Recent|enabled\(["'`]Recent|function\.Recent/.test(text));
});
