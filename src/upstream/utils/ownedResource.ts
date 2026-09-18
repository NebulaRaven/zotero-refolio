  // src/utils/ownedResource.ts
  export function replaceOwnedProperty(target, key, replacement) {
    const previous = target[key];
    target[key] = replacement;
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      if (target[key] === replacement) {
        target[key] = previous;
      }
    };
  }
  export function appendOwnedEntry(entries, entry) {
    entries.push(entry);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      const index = entries.indexOf(entry);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    };
  }

