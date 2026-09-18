  // src/features/reader/readerResourceLifecycle.ts
  export function takeStaleOwnedEntries(entries, liveOwners, getOwner) {
    const live = new Set(liveOwners);
    const stale = [];
    for (const [key, value] of entries) {
      if (live.has(getOwner(key, value))) {
        continue;
      }
      entries.delete(key);
      stale.push([key, value]);
    }
    return stale;
  }

