  export async function getRecentlyReadItemCount(items, libraryID) {
    if (typeof items.getLastRead !== "function") {
      return undefined;
    }
    return (await items.getLastRead(libraryID)).length;
  }
  // Top-level items: no parent note, attachment or annotation, and not in the trash.
  const TOP_LEVEL_ITEM_COUNT = `SELECT COUNT(*) FROM items I WHERE I.libraryID=?
    AND I.itemID NOT IN (SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL)
    AND I.itemID NOT IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL)
    AND I.itemID NOT IN (SELECT itemID FROM itemAnnotations)
    AND I.itemID NOT IN (SELECT itemID FROM deletedItems)`;
  // Item.getCollections() leaves out trashed collections, so items filed only there count as unfiled.
  const NOT_IN_COLLECTION = ` AND I.itemID NOT IN (SELECT itemID FROM collectionItems
    WHERE collectionID NOT IN (SELECT collectionID FROM deletedCollections))`;
  /** Count the items a collection-tree row shows, or -1 when the row has no count. */
  export async function getCollectionRowItemCount(row, zotero = Zotero): Promise<number> {
    const libraryID = row.ref.libraryID ?? row.ref._libraryID;
    switch (row.type) {
      case "library":
      case "group":
      case "feed":
        return Number(await zotero.DB.valueQueryAsync(TOP_LEVEL_ITEM_COUNT, [libraryID]));
      case "unfiled":
        return Number(await zotero.DB.valueQueryAsync(TOP_LEVEL_ITEM_COUNT + NOT_IN_COLLECTION, [libraryID]));
      case "trash":
        return (await zotero.Items.getDeleted(libraryID, true)).length;
      case "collection":
        return zotero.Prefs.get("recursiveCollections")
          ? new Set(row.ref.getDescendents(false, "item", false).map(item => item.id)).size
          : row.ref.getChildItems(true, false).length;
      case "duplicates":
        return row.ref._sets ? Object.keys(row.ref._sets._objects).length : -1;
      case "recentlyRead":
        return (await getRecentlyReadItemCount(zotero.Items, libraryID)) ?? -1;
      case "search":
        return (await row.ref.search()).length;
    }
    return -1;
  }
  /** Reset at once on the first change, then at most once per interval while changes keep arriving. */
  export function createCountInvalidator(reset: () => void, interval: number) {
    let timer: number | undefined, pending = false;
    const notify = () => {
      if (timer !== undefined) {
        pending = true;
        return;
      }
      reset();
      timer = window.setTimeout(() => {
        timer = undefined;
        if (pending) {
          pending = false;
          notify();
        }
      }, interval);
    };
    const cancel = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      pending = false;
    };
    return { notify, cancel };
  }
