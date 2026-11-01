  export function takeStaleOwnedEntries<K, V>(entries: Map<K, V>, liveOwners: Iterable<unknown>, getOwner: (key: K, value: V) => unknown): Array<[K, V]> {
    const live = new Set(liveOwners);
    const stale: Array<[K, V]> = [];
    for (const [key, value] of entries) {
      if (live.has(getOwner(key, value))) {
        continue;
      }
      entries.delete(key);
      stale.push([key, value]);
    }
    return stale;
  }

