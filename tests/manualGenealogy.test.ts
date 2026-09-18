import { testGetString, testGetErrorMessage } from './localization.ts';
import type { RelationDraft, GraphData } from '../src/core/models.ts';
import { script } from './source.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spReadManualGenealogy, spSaveManualGenealogy, spDeleteManualGenealogy,
  spRestoreManualGenealogy, spMergeManualGenealogy } from '../src/core/manualGenealogy.ts';

const freshIDs = () => { let id = 0; return () => `fixture-${++id}`; };
const empty = () => spReadManualGenealogy();
const draft = (extra = {}): RelationDraft => ({ mentor: { label: 'Ada Mentor', description: 'Institution A' },
  student: { label: 'Lin Student' }, kind: 'doctoral', sourceURL: 'https://example.org/thesis', note: 'Dissertation acknowledgement', ...extra });

test('manual genealogy creates offline people, persists JSON, edits names and preserves relationship IDs', () => {
  const next = freshIDs(), original = empty();
  let { data, id } = spSaveManualGenealogy(original, draft(), next);
  assert.deepEqual(original, empty());
  data = spReadManualGenealogy(JSON.stringify(data));
  const edge = data.relations[id];
  const changed = spSaveManualGenealogy(data, draft({ id, mentor: { id: edge.mentor, label: 'Ada M.', description: 'Institution B' },
    student: { id: edge.student, label: 'Lin Student' }, note: 'Corrected source' }), next);
  assert.equal(changed.id, id); assert.equal(Object.keys(changed.data.relations).length, 1);
  assert.equal(changed.data.people[edge.mentor].label, 'Ada M.');
  assert.equal(data.people[edge.mentor].label, 'Ada Mentor');
  const graph = spMergeManualGenealogy(null, changed.data);
  assert.equal(graph.sourceMode, 'manual'); assert.deepEqual(graph.nodes[edge.mentor].links, { [edge.student]: true });
  assert.equal(graph.genealogyEdges[0].manualRecords[0].note, 'Corrected source');
  assert.equal(graph.genealogyEdges[0].wikidata, false);
});

test('same-name people remain distinct until explicitly reused and multiple advisors are supported', () => {
  const next = freshIDs();
  let { data, id } = spSaveManualGenealogy(empty(), draft({ mentor: { label: 'Same Name' }, student: { label: 'Same Name' } }), next);
  const first = data.relations[id]; assert.notEqual(first.mentor, first.student);
  ({ data } = spSaveManualGenealogy(data, draft({ mentor: { label: 'Second advisor' }, student: { id: first.student, label: 'Same Name' } }), next));
  assert.equal(Object.keys(data.people).length, 3); assert.equal(Object.keys(data.relations).length, 2);
});

test('invalid manual edits, duplicate relations, self-relations and unsafe sources leave saved data unchanged', () => {
  const next = freshIDs(), { data, id } = spSaveManualGenealogy(empty(), draft(), next);
  const edge = data.relations[id], before = JSON.stringify(data);
  const mentor = { id: edge.mentor, label: 'Ada Mentor' }, student = { id: edge.student, label: 'Lin Student' };
  assert.throws(() => spSaveManualGenealogy(data, draft({ mentor, student }), next), { message: 'ui-error-relationship-exists-edit' });
  assert.throws(() => spSaveManualGenealogy(data, draft({ mentor, student: mentor }), next), { message: 'ui-error-self-mentor' });
  assert.throws(() => spSaveManualGenealogy(data, draft({ sourceURL: 'javascript:alert(1)' }), next), { message: 'ui-error-source-url' });
  assert.throws(() => spSaveManualGenealogy(data, draft({ mentor: { label: '' } }), next), /names/);
  assert.throws(() => spSaveManualGenealogy(data, draft({ id: 'relation-missing' }), next), { message: 'ui-error-relationship-missing' });
  assert.throws(() => spSaveManualGenealogy(data, draft({ kind: 'coauthor' }), next), /type/);
  assert.equal(JSON.stringify(data), before);
});

test('manual deletion can be undone without replacing records saved in the meantime', () => {
  const next = freshIDs(), saved = spSaveManualGenealogy(empty(), draft(), next);
  const deletion = spDeleteManualGenealogy(saved.data, saved.id);
  assert.equal(Object.keys(deletion.data.relations).length, 0);
  const second = spSaveManualGenealogy(deletion.data, draft({ kind: 'general' }), next);
  const restored = spRestoreManualGenealogy(second.data, deletion.removed);
  assert.deepEqual(restored.relations[saved.id], saved.data.relations[saved.id]);
  assert.ok(restored.relations[second.id]);
  assert.equal(Object.keys(spMergeManualGenealogy(null, restored, 'doctoral').nodes).length, 2);
  assert.equal(Object.keys(spMergeManualGenealogy(null, restored, 'general').nodes).length, 2);
});

test('manual supplements merge with matching Wikidata identities without duplicates or changes to online records', () => {
  const next = freshIDs();
  const base: GraphData = { center: 'Q1', kind: 'doctoral', nodes: {
    Q1: { label: 'Online mentor', type: 'person', links: { Q2: true } }, Q2: { label: 'Online student', type: 'person', links: {} }
  }, genealogyEdges: [{ source: 'Q1', target: 'Q2', kind: 'doctoral', referenced: true, references: ['https://example.org/online'], statements: ['https://www.wikidata.org/wiki/Q2#P184'] }] };
  const before = JSON.stringify(base);
  let { data } = spSaveManualGenealogy(empty(), draft({ mentor: { id: 'Q1', label: 'Mentor' }, student: { id: 'Q2', label: 'Student' } }), next);
  ({ data } = spSaveManualGenealogy(data, draft({ mentor: { id: 'Q1', label: 'Mentor' } }), next));
  ({ data } = spSaveManualGenealogy(data, draft(), next));
  const graph = spMergeManualGenealogy(base, data);
  assert.equal(graph.genealogyEdges.length, 2); assert.equal(Object.keys(graph.nodes).length, 3);
  assert.equal(graph.nodes.Q1.label, 'Online mentor');
  assert.equal(graph.genealogyEdges[0].wikidata, true); assert.equal(graph.genealogyEdges[0].manualRecords.length, 1);
  assert.deepEqual(graph.genealogyEdges[0].references, base.genealogyEdges[0].references);
  assert.equal(JSON.stringify(base), before);
  assert.equal(spMergeManualGenealogy(base, JSON.stringify(data)).genealogyEdges.length, 2);
});

test('invalid saved genealogy data is reported instead of silently replaced', () => {
  assert.throws(() => spReadManualGenealogy('{broken'), SyntaxError);
  assert.throws(() => spReadManualGenealogy({ version: 2, people: {}, relations: {} }), { message: 'ui-error-invalid-genealogy' });
  assert.throws(() => spReadManualGenealogy({ version: 1, people: 3, relations: {} }), { message: 'ui-error-invalid-genealogy' });
  assert.throws(() => spReadManualGenealogy({ version: 1, people: {}, relations: { 'relation-x': { mentor: '__proto__', student: 'constructor', kind: 'doctoral' } } }), { message: 'ui-error-invalid-saved-relationship' });
});

test('actual genealogy panel initialises local records and uses the Academic Family Tree main site without an API request', async () => {
  const next = freshIDs(), saved = spSaveManualGenealogy(empty(), draft(), next);
  const elements = [];
  const doc: vm.Context = { defaultView: { crypto: { randomUUID: next } } };
  const makeElement = (doc, tag, parent = undefined, text = '') => {
    const element = { ownerDocument: doc, tag, textContent: text, value: '', children: [], events: {},
      append(child) { this.children.push(child); }, setAttribute() {}, addEventListener(type, listener) { this.events[type] = listener; },
      replaceChildren(...children) { this.children = children; }, scrollIntoView() {} };
    parent?.append(element); elements.push(element); return element;
  };
  doc.createElementNS = (_namespace, tag) => makeElement(doc, tag);
  const view: vm.Context = { cleanups: [], status: {}, active: true, mode: 'genealogy', schedule() {}, refreshGraphView: async () => {} };
  const ctx: vm.Context = { spElement: makeElement, getString: testGetString, getErrorMessage: testGetErrorMessage, spReadManualGenealogy, spMergeManualGenealogy,
    spSaveManualGenealogy, spDeleteManualGenealogy, spRestoreManualGenealogy,
    getPref: () => JSON.stringify(saved.data), setPref: () => assert.fail('Must not save during initialisation'),
    Zotero: { locale: 'en', HTTP: { request: () => assert.fail('Must remain offline') } },
    ZoteroPane: { getSelectedItems: () => [] }, SPGenealogyClient: class {} };
  for (const file of ['ui', 'manualGenealogy', 'genealogy']) vm.runInNewContext(await script(new URL(`../src/app/${file}.ts`, import.meta.url)), ctx);
  ctx.spBuildGenealogyControls(view, makeElement(doc, 'div'));
  assert.equal(view.getGenealogyGraph().genealogyEdges.length, 1);
  assert.equal(elements.find(element => element.tag === 'a' && element.textContent === 'Academic Family Tree').href, 'https://academictree.org/');
  assert.ok(elements.some(element => element.textContent === 'Manual relationships'));
});
