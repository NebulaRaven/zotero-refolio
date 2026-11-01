import { testGetString } from './localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { script } from './source.mts';

const tagsFile = new URL('../src/upstream/features/tags/tags.ts', import.meta.url);
async function load(extra: Record<string, unknown> = {}) {
  const ctx: vm.Context = { window: { setTimeout() {}, clearTimeout() {} }, addon: { api: {} }, getString: testGetString,
    ztoolkit: { log: assert.fail }, getElements: () => [], ...extra };
  vm.runInNewContext(await script(tagsFile), ctx);
  ctx.Tags.prototype.prepare = () => {};
  return ctx;
}
// Values built inside the module's context, as plain values of this one for deepEqual.
const plain = <T>(value: T): T => structuredClone(value);
// Counts every RegExp the module compiles; regex literals are not counted.
function countingRegExp() {
  const counter = { compiled: 0, RegExp: class extends RegExp {
    constructor(pattern: string, flags?: string) { counter.compiled++; super(pattern, flags); }
  } };
  return counter;
}

// Library 1 unless noted. Notes, attachments and annotations are child items when they have a parent;
// collection 22 is a subcollection of 20, collection 21 is in the trash.
type Fixture = { id: number; library?: number; type: 'regular' | 'note' | 'attachment' | 'annotation'; parent?: number;
  collections?: number[]; deleted?: boolean; attachmentNote?: boolean; tags: string[] };
const fixture: Fixture[] = [
  { id: 1, type: 'regular', collections: [20], tags: ['#A/B', 'plain'] },
  { id: 2, type: 'regular', tags: ['#A/C'] },
  { id: 3, type: 'note', parent: 1, collections: [23], tags: ['#A/B', '#Note'] },
  { id: 4, type: 'attachment', parent: 1, attachmentNote: true, tags: ['#PDF'] },
  { id: 5, type: 'annotation', parent: 4, tags: ['#A/B', '#Highlight'] },
  { id: 6, type: 'attachment', parent: 3, tags: ['#Image'] },
  { id: 7, type: 'note', parent: 1, deleted: true, tags: ['#A/B', '#Trashed'] },
  { id: 8, type: 'regular', collections: [20], deleted: true, tags: ['#A/D', '#Trashed'] },
  { id: 9, type: 'note', parent: 8, tags: ['#A/D'] },
  { id: 10, type: 'regular', collections: [21], tags: ['#A/E'] },
  { id: 11, type: 'note', collections: [20], tags: ['#Standalone'] },
  { id: 12, type: 'attachment', tags: ['#A/C'] },
  { id: 13, type: 'annotation', parent: 12, tags: ['#A/C'] },
  { id: 14, type: 'regular', collections: [22], tags: ['#Sub'] },
  { id: 30, library: 2, type: 'regular', collections: [40], tags: ['#A/B', '#Other'] },
  { id: 31, library: 2, type: 'note', parent: 30, deleted: true, tags: ['#A/B'] }
];

// The tables and columns the tag counts read, with the keys and indexes Zotero 10's userdata.sql gives them.
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE items (itemID INTEGER PRIMARY KEY, libraryID INT NOT NULL);
    CREATE TABLE itemNotes (itemID INTEGER PRIMARY KEY, parentItemID INT);
    CREATE INDEX itemNotes_parentItemID ON itemNotes(parentItemID);
    CREATE TABLE itemAttachments (itemID INTEGER PRIMARY KEY, parentItemID INT);
    CREATE INDEX itemAttachments_parentItemID ON itemAttachments(parentItemID);
    CREATE TABLE itemAnnotations (itemID INTEGER PRIMARY KEY, parentItemID INT NOT NULL);
    CREATE INDEX itemAnnotations_parentItemID ON itemAnnotations(parentItemID);
    CREATE TABLE tags (tagID INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE itemTags (itemID INT NOT NULL, tagID INT NOT NULL, type INT NOT NULL, PRIMARY KEY (itemID, tagID));
    CREATE INDEX itemTags_tagID ON itemTags(tagID);
    CREATE TABLE collectionItems (collectionID INT NOT NULL, itemID INT NOT NULL, PRIMARY KEY (collectionID, itemID));
    CREATE INDEX collectionItems_itemID ON collectionItems(itemID);
    CREATE TABLE deletedItems (itemID INTEGER PRIMARY KEY);
    CREATE TABLE deletedCollections (collectionID INTEGER PRIMARY KEY);
  `);
  const run = (sql: string, ...values: Array<number | string | null>) => db.prepare(sql).run(...values);
  const tagIDs = new Map<string, number>();
  for (const item of fixture) {
    run('INSERT INTO items VALUES (?, ?)', item.id, item.library ?? 1);
    // Zotero stores an attachment's own note in itemNotes with no parent (Item.prototype._saveData)
    if (item.type === 'note' || item.attachmentNote) run('INSERT INTO itemNotes VALUES (?, ?)', item.id, item.type === 'note' ? item.parent ?? null : null);
    if (item.type === 'attachment') run('INSERT INTO itemAttachments VALUES (?, ?)', item.id, item.parent ?? null);
    if (item.type === 'annotation') run('INSERT INTO itemAnnotations VALUES (?, ?)', item.id, item.parent);
    if (item.deleted) run('INSERT INTO deletedItems VALUES (?)', item.id);
    for (const collectionID of item.collections ?? []) run('INSERT INTO collectionItems VALUES (?, ?)', collectionID, item.id);
    item.tags.forEach((tag, index) => {
      if (!tagIDs.has(tag)) run('INSERT INTO tags VALUES (?, ?)', tagIDs.set(tag, tagIDs.size + 1).get(tag), tag);
      run('INSERT INTO itemTags VALUES (?, ?, ?)', item.id, tagIDs.get(tag), index % 2);
    });
  }
  run('INSERT INTO deletedCollections VALUES (21)');
  return db;
}
// The typed getters of a mozIStorageRow.
const storageRow = (row: Record<string, unknown>) => {
  const values = Object.values(row);
  return { getUTF8String: (index: number) => String(values[index]), getInt64: (index: number) => Number(values[index]) };
};
// Zotero.DB as Zotero 10's db.js behaves: onRow gets each storage row, and without onRow only
// statements that start with SELECT or PRAGMA return their rows.
function zoteroDB(db: DatabaseSync, queries: string[] = []) {
  return {
    queryAsync: async (sql: string, params: number[], options: { onRow?: (row: ReturnType<typeof storageRow>) => void } = {}) => {
      queries.push(sql);
      const rows = db.prepare(sql).all(...params);
      if (options.onRow) {
        for (const row of rows) options.onRow(storageRow(row));
        return undefined;
      }
      return /^[^a-z]*(select|pragma)\b/i.test(sql) ? rows : undefined;
    }
  };
}

// What the old getPlainTags collected: one tag per item and tag of Zotero.Items.getAll(libraryID), which
// leaves out trashed items, narrowed to items whose item.topLevelItem.inCollection(collectionID).
function scannedTags(libraryID: number, collectionID?: number, displayAllTags = false) {
  const byID = new Map(fixture.map(item => [item.id, item]));
  const topLevelItem = (item: Fixture) => { while (item.parent) item = byID.get(item.parent)!; return item; };
  let items = fixture.filter(item => (item.library ?? 1) === libraryID && !item.deleted);
  if (collectionID && !displayAllTags) items = items.filter(item => (topLevelItem(item).collections ?? []).includes(collectionID));
  return items.flatMap(item => item.tags);
}
function tally(tags: string[]) {
  const counts = new Map<string, number>();
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
// Plain copies of a nested tag tree, keeping the names and numbers the pane shows.
function numbers(nested: Record<string, { number: number; children: object }>) {
  return Object.fromEntries(Object.entries(nested).map(([name, node]) => [name, [node.number, numbers(node.children as typeof nested)]]));
}

test('tag counts cover the items the old item scan read, child notes, attachments and annotations included', async () => {
  const db = database(), queries = [];
  const ctx = await load();
  const zotero = { DB: zoteroDB(db, queries) };
  assert.deepEqual(plain(await ctx.getTagCounts(1, undefined, zotero)), [
    ['#A/B', 3], ['#A/C', 3], ['#A/D', 1], ['#A/E', 1], ['#Highlight', 1], ['#Image', 1], ['#Note', 1],
    ['#PDF', 1], ['#Standalone', 1], ['#Sub', 1], ['plain', 1]
  ]);
  // Item 14 sits in subcollection 22 only: inCollection() checks direct membership.
  assert.deepEqual(plain(await ctx.getTagCounts(1, 20, zotero)), [
    ['#A/B', 3], ['#A/D', 1], ['#Highlight', 1], ['#Image', 1], ['#Note', 1], ['#PDF', 1], ['#Standalone', 1], ['plain', 1]
  ]);
  // A child item filed in a collection by itself does not bring its top-level item's tags along.
  assert.deepEqual(plain(await ctx.getTagCounts(1, 23, zotero)), []);
  for (const [libraryID, collectionID] of [[1, undefined], [2, undefined], [1, 20], [1, 21], [1, 22], [1, 23], [2, 40], [1, 40]]) {
    assert.deepEqual(plain(await ctx.getTagCounts(libraryID, collectionID, zotero)), tally(scannedTags(libraryID, collectionID)), `${libraryID}/${collectionID}`);
  }
  // Statement text stays stable so Zotero.DB can reuse its cached statements.
  assert.equal(new Set(queries).size, 2);
});

test('getPlainTags counts the selected collection only while Zotero shows the tags of the items in view', async () => {
  const db = database(), prefs = { 'tagSelector.displayAllTags': false };
  let collectionID: number | undefined = 20;
  const ctx = await load({
    getPref: () => '/^#(?:.+/)*(.+)/', getFirstSelectedLibraryID: () => undefined, getFirstSelectedCollectionID: () => collectionID,
    Zotero: { DB: zoteroDB(db), Prefs: { get: key => prefs[key] }, Libraries: { userLibraryID: 1 },
      Items: { getAll: () => assert.fail('getPlainTags loads every item of the library') } }
  });
  const tags = new ctx.Tags();
  // Tags the text-tag pattern rejects ("plain") stay out of the pane, as before.
  const visible = (libraryID: number, collection?: number, displayAllTags = false) =>
    tally(scannedTags(libraryID, collection, displayAllTags).filter(tag => tag.startsWith('#')));
  assert.deepEqual(plain(await tags.getPlainTags()), visible(1, 20));
  prefs['tagSelector.displayAllTags'] = true;
  assert.deepEqual(plain(await tags.getPlainTags()), visible(1, 20, true));
  prefs['tagSelector.displayAllTags'] = false; collectionID = undefined;
  assert.deepEqual(plain(await tags.getPlainTags()), visible(1));
});

test('nested tag numbers add up tag counts exactly as the old per-item list did', async () => {
  const ctx = await load();
  const tags = new ctx.Tags();
  tags.plainTags = [['#A/B', 1], ['#A/C', 1]];
  const simple = tags.getNestedTags();
  assert.equal(simple.A.number, 2);
  assert.deepEqual(numbers(simple), { A: [2, { B: [1, {}], C: [1, {}] }] });
  assert.equal(simple.A.id, JSON.stringify(['#A/B', 0]));
  for (const [libraryID, collectionID] of [[1, undefined], [1, 20], [2, undefined]]) {
    const occurrences = scannedTags(libraryID, collectionID);
    tags.plainTags = occurrences.map(tag => [tag, 1]);
    const scanned = numbers(tags.getNestedTags());
    tags.plainTags = tally(occurrences);
    assert.deepEqual(numbers(tags.getNestedTags()), scanned);
  }
  assert.deepEqual(numbers(tags.getNestedTags()), { A: [1, { B: [1, {}] }], Other: [1, {}] });
});

test('nested tags rebuild when only a count changes and skip a rebuild for the same counts', async () => {
  const ctx = await load();
  const tags = new ctx.Tags();
  let next = [['#A/B', 1], ['#A/C', 1]], rebuilt = 0;
  tags.container = { children: [] }; tags.getPlainTags = async () => next; tags.refresh = () => rebuilt++;
  await tags.init();
  assert.equal(rebuilt, 1); assert.equal(tags.nestedTags.A.number, 2);
  next = [['#A/B', 1], ['#A/C', 1]];
  await tags.init();
  assert.equal(rebuilt, 1);
  next = [['#A/B', 2], ['#A/C', 1]];
  await tags.init();
  assert.equal(rebuilt, 2); assert.equal(tags.nestedTags.A.number, 3);
});

// Tags.getTagMatch before the cache, kept to compare results with.
function compiledTagMatch(rawString: string, tag: string) {
  try {
    const res = rawString.match(/\/(.+)\/(\w*)/);
    let regex;
    if (res) {
      regex = new RegExp(res[1], res[2]);
    } else if (rawString.startsWith("~~")) {
      regex = new RegExp(`^([^${rawString.slice(2)}].+)`);
    } else {
      regex = new RegExp(`^${rawString}(.+)`);
    }
    const arr = tag.match(regex);
    return arr && (arr.slice(1).join("") || arr[0]) || "";
  } catch {
    return tag;
  }
}

test('getTagMatch compiles each pattern once and matches as a freshly compiled pattern did', async () => {
  const counter = countingRegExp();
  let pattern: string | undefined;
  const ctx = await load({ RegExp: counter.RegExp, getPref: () => pattern });
  const names = ['#A/B', '#Topic', 'plain', '~x', '#', 'A#B', '##', '#a/b/c'];
  for (pattern of ['/^#(?:.+/)*(.+)/', '/#(\\w)/gi', '/^#(.)/y', '~~#', '~~', '#', '', '(', '/[/', undefined]) {
    counter.compiled = 0;
    for (let round = 0; round < 3; round++) {
      for (const name of names) assert.equal(ctx.Tags.getTagMatch(name), compiledTagMatch(pattern, name), `${pattern} ${name}`);
    }
    assert.equal(counter.compiled, pattern === undefined ? 0 : 1, String(pattern));
  }
  // Going back to an earlier pattern compiles it again; a tag that is not a string still comes back unchanged.
  pattern = '#';
  counter.compiled = 0;
  assert.equal(ctx.Tags.getTagMatch('#Topic'), 'Topic');
  assert.equal(ctx.Tags.getTagMatch(undefined), undefined);
  assert.equal(counter.compiled, 1);
});

test('the nested tag search compiles its pattern once and filters tag segments as before', async () => {
  const counter = countingRegExp();
  const db = database();
  const ctx = await load({
    RegExp: counter.RegExp, getPref: () => '/^#(?:.+/)*(.+)/', getFirstSelectedLibraryID: () => 1, getFirstSelectedCollectionID: () => undefined,
    Zotero: { DB: zoteroDB(db), Prefs: { get: () => false }, Libraries: { userLibraryID: 1 } }
  });
  const tags = new ctx.Tags();
  ctx.Tags.getTagMatch('#warm-up');
  const search = async (text: string) => {
    tags.searchText = text;
    counter.compiled = 0;
    const result = plain(await tags.getPlainTags()).map(([tag]) => tag);
    assert.equal(counter.compiled, text.trim() ? 1 : 0, text);
    return result;
  };
  assert.deepEqual(await search('b'), ['#A/B', '#Sub']);
  assert.deepEqual(await search('^(c|e)$'), ['#A/C', '#A/E']);
  assert.deepEqual(await search('/^[A-Z]$/'), ['#A/B', '#A/C', '#A/D', '#A/E']);
  assert.deepEqual(await search('/^#h/i'), ['#Highlight']);
  assert.deepEqual(await search('#'), ['#A/B', '#A/C', '#A/D', '#A/E', '#Highlight', '#Image', '#Note', '#PDF', '#Standalone', '#Sub']);
  assert.deepEqual(await search('  '), ['#A/B', '#A/C', '#A/D', '#A/E', '#Highlight', '#Image', '#Note', '#PDF', '#Standalone', '#Sub']);
  await assert.rejects(search('c++'), SyntaxError);
});
