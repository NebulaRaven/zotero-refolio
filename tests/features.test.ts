import { script } from './source.mts';
import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spFilterGraph, spSharedGraph } from '../src/core/graph.ts';
import { spNormalizeJournalName, spPublicationNames, spJournalQuery } from '../src/core/journals.ts';
import { spManualRankRecord, spSaveManualRankRecord, spEffectiveRanks, spValidateManualRank } from '../src/core/manualRanks.ts';
import { spFeatureDefinitions, spInactivePreferences } from '../src/core/features.ts';
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
test('shared tags connect papers directly and do not equate different hierarchy paths', () => {
  const papers = [{ id: 1, tags: ['Theory/a', 'same'] }, { id: 2, tags: ['Method/a'] }, { id: 3, tags: ['same', 'same'] }];
  const result = spSharedGraph(papers, p => p.tags);
  assert.deepEqual(Object.keys(result.nodes), ['1', '2', '3']);
  assert.deepEqual(result.nodes[1].links, { 3: true });
  assert.deepEqual(result.nodes[2].links, {});
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
  const ctx: vm.Context = { getPref: key => prefs[key], spPublicationNames, spNormalizeJournalName, spJournalQuery, spManualRankRecord, spEffectiveRanks };
  vm.runInNewContext(await script(new URL('../src/app/journalLookup.ts', import.meta.url)), ctx);
  vm.runInNewContext(await script(new URL('../src/app/manualRanks.ts', import.meta.url)), ctx);
  const storage = { get: (_item, field) => field === 'rank' ? { sciif: '5', sci: 'Q1' } : undefined };
  assert.equal(ctx.spGetJournalRanks(storage, 'Sleep').sciif, '7.2');
  prefs['function.manualJournalRanks.enable'] = false;
  assert.equal(ctx.spGetJournalRanks(storage, 'Sleep').sciif, '5');
  assert.ok(prefs['publicationTagsColumn.manualRanks'].includes('7.2'));
});
test('actual journal columns render manual values while still fetching missing automatic fields, including an IF of zero', async () => {
  const prefs = {
    'publicationTagsColumn.sortBy': 'sci, -sciif', 'publicationTagsColumn.source': 'easyscholar',
    'publicationColumn.fields': 'publicationTitle', 'IFColumn.field': 'sciif',
    'publicationTagsColumn.manualRanks': JSON.stringify(spSaveManualRankRecord('{}', ['Sleep'], { sciif: '0', pku: '北核' }, normalize))
  };
  const ctx: vm.Context = { getPref: key => prefs[key], getString: testGetString, spPublicationNames, spNormalizeJournalName, spJournalQuery, spManualRankRecord, spEffectiveRanks,
    getPublicationTitle: () => 'Sleep', import_dayjs: { default: { extend() {}, locale() {} } }, import_relativeTime: {}, import_utc: {}, getDayjsLocale: () => 'en',
    Zotero: { locale: 'en', Prefs: { get: key => prefs[key.replace('stylepersonal.', '')] } }, config: { addonRef: 'stylepersonal' } };
  for (const file of ['src/app/journalLookup.ts', 'src/app/manualRanks.ts', 'src/upstream/utils/easyscholar.ts', 'src/upstream/features/item-tree/itemTree-57.ts']) {
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
  for (const [key] of defaults) if (key.startsWith('function.') && !spInactivePreferences.has(key)) assert.ok(switches.has(key), key);
  for (const key of switches) assert.equal(typeof defaults.get(key), 'boolean', key);
  assert.equal(switches.size, spFeatureDefinitions.length);
});
test('reader recording and formerly unconditional tools follow their own switches', async () => {
  const prefs = { 'function.titleColumn.enable': false, 'readingProgress.recordingEnabled': true };
  const context: vm.Context = { getPref: key => prefs[key], isEnabel: key => prefs[`function.${key}.enable`] };
  vm.runInNewContext(await script(new URL('../src/upstream/app/mainWindowFeatures.ts', import.meta.url)), context);
  const features = [...context.createImmediateFeatures(), ...context.createStandardFeatures(), ...context.createFinalFeatures()];
  assert.equal(features.find(f => f.id === 'reading-time-recorder').isEnabled(), true);
  for (const [id, key] of [['tab-menu', 'tabMenu'], ['commands', 'commands'], ['preference-manager', 'prefsManager'], ['fulltext-translate', 'fulltextTranslate']]) {
    const feature = features.find(f => f.id === id); prefs[`function.${key}.enable`] = false; assert.equal(feature.isEnabled(), false);
    prefs[`function.${key}.enable`] = true; assert.equal(feature.isEnabled(), true);
  }
});
test('master disable leaves settings available without starting library or reader features', async () => {
  const started = [];
  class Runtime { async start(feature) { started.push(feature.id); } async startAll() { assert.fail('Must not start disabled features'); } }
  const ctx: vm.Context = { getPref: key => key === 'enable' ? false : undefined, addon: { data: { alive: true } }, FeatureRuntime: Runtime };
  vm.runInNewContext(await script(new URL('../src/app/hooks.ts', import.meta.url)), ctx);
  await ctx.onMainWindowLoad({}); assert.deepEqual(started, ['settings-panel']);
});
const retired = ['function.Recent.enable', 'delayTime', 'cookies.cnki', 'titleColumn.odd', 'titleColumn.even',
  'titleColumn.selected', 'IFColumn.info', 'nestedTags.sortord', 'nestedTags.linkSymbol', 'textTagsColumn.prefix',
  'annotationColumn.style', 'annotationColumn.color', 'annotationColumn.circle'];
test('settings that nothing reads stay off the settings page', () => {
  for (const key of retired) assert.ok(spInactivePreferences.has(key), key);
  assert.ok(!spFeatureDefinitions.some(([key]) => key === 'Recent'));
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
