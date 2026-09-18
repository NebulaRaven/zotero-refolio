  // src/features/collections/collectionItemCountData.ts
  export async function getRecentlyReadItemCount(items, libraryID) {
    if (typeof items.getLastRead !== "function") {
      return undefined;
    }
    return (await items.getLastRead(libraryID)).length;
  }

