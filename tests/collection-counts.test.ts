import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { script } from './source.mts';

const countFile = new URL('../src/upstream/features/collections/collectionItemCountData.ts', import.meta.url);
async function load(context: vm.Context = {}) {
  vm.runInNewContext(await script(countFile), context);
  return context;
}

// The tables and columns the counts read, as Zotero 10's userdata.sql defines them.
function library() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE items (itemID INTEGER PRIMARY KEY, libraryID INT NOT NULL);
    CREATE TABLE itemNotes (itemID INTEGER PRIMARY KEY, parentItemID INT);
    CREATE TABLE itemAttachments (itemID INTEGER PRIMARY KEY, parentItemID INT);
    CREATE TABLE itemAnnotations (itemID INTEGER PRIMARY KEY, parentItemID INT NOT NULL);
    CREATE TABLE deletedItems (itemID INTEGER PRIMARY KEY);
    CREATE TABLE collectionItems (collectionID INT NOT NULL, itemID INT NOT NULL);
    CREATE TABLE deletedCollections (collectionID INTEGER PRIMARY KEY);
  `);
  const insert = (table: string, values: Array<Array<number | null>>) => {
    for (const row of values) db.prepare(`INSERT INTO ${table} VALUES (${row.map(() => '?').join(',')})`).run(...row);
  };
  // Library 1: papers 1 and 2, a child note, attachment and annotation of paper 1, a standalone note,
  // a trashed paper and a paper filed only in a trashed collection. Library 2: one paper and two trashed papers.
  insert('items', [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [11, 2]]);
  insert('itemNotes', [[3, 1], [6, null]]);
  insert('itemAttachments', [[4, 1]]);
  insert('itemAnnotations', [[5, 4]]);
  insert('deletedItems', [[7], [10], [11]]);
  insert('collectionItems', [[20, 1], [21, 8]]);
  insert('deletedCollections', [[21]]);
  return {
    DB: { valueQueryAsync: async (sql: string, params: number[]) => Object.values(db.prepare(sql).get(...params)!)[0] },
    Items: {
      // Same query as Zotero.DataObjects.prototype.getDeleted
      getDeleted: async (libraryID: number, asIDs: boolean) => {
        const ids = db.prepare('SELECT itemID FROM items JOIN deletedItems USING (itemID) WHERE libraryID=?').all(libraryID).map(row => row.itemID);
        return asIDs ? ids : ids.map(id => ({ id }));
      }
    }
  };
}

test('library and unfiled counts include top-level items only and treat trashed collections as unfiled', async () => {
  const zotero = library();
  const ctx = await load();
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'library', ref: { libraryID: 1 } }, zotero), 4);
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'group', ref: { _libraryID: 2 } }, zotero), 1);
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'unfiled', ref: { libraryID: 1 } }, zotero), 3);
});

test('each library trash counts its own deleted items', async () => {
  const zotero = library();
  const ctx = await load();
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'trash', ref: { libraryID: 2 } }, zotero), 2);
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'trash', ref: { libraryID: 1 } }, zotero), 1);
});

test('collection, search and duplicate counts come from the row itself', async () => {
  const ctx = await load();
  const zotero = { Prefs: { get: () => false } };
  const collection = { getChildItems: (asIDs: boolean) => { assert.equal(asIDs, true); return [1, 2, 3]; } };
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'collection', ref: collection }, zotero), 3);
  zotero.Prefs.get = () => true;
  const nested = { getDescendents: () => [{ id: 1 }, { id: 2 }, { id: 1 }] };
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'collection', ref: nested }, zotero), 2);
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'search', ref: { search: async () => [4, 5] } }, zotero), 2);
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'duplicates', ref: { _sets: { _objects: { a: 1, b: 2 } } } }, zotero), 2);
  assert.equal(await ctx.getCollectionRowItemCount({ type: 'duplicates', ref: {} }, zotero), -1);
});

test('a burst of library changes resets the counts at once and then at most once more per interval', async () => {
  const pending = new Map<number, () => void>(); let id = 0, resets = 0;
  const ctx = await load({ window: { setTimeout: (fn: () => void) => { pending.set(++id, fn); return id; }, clearTimeout: (key: number) => pending.delete(key) } });
  const invalidator = ctx.createCountInvalidator(() => resets++, 1000);
  invalidator.notify();
  assert.equal(resets, 1);
  for (let i = 0; i < 50; i++) invalidator.notify();
  assert.equal(resets, 1);
  const fire = () => { const [key, fn] = [...pending][0]; pending.delete(key); fn(); };
  fire();
  assert.equal(resets, 2);
  fire();
  assert.equal(resets, 2);
  assert.equal(pending.size, 0);
  invalidator.notify();
  assert.equal(resets, 3);
  invalidator.cancel();
  assert.equal(pending.size, 0);
});
