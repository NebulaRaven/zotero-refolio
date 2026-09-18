interface ViewColumn { dataKey: string; hidden?: boolean; ordinal?: number; width?: number; [key: string]: unknown; }
  // src/features/item-tree/viewGroupLogic.ts
  export function asRecord(value: unknown): Record<string, Partial<ViewColumn>> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, Partial<ViewColumn>>;
    } else {
      return {};
    }
  }
  export function asDataKeys(value) {
    if (Array.isArray(value)) {
      return value.filter(key => typeof key === "string");
    } else {
      return [];
    }
  }
  export function isColumn(value: unknown): value is ViewColumn {
    return Boolean(value && typeof value === "object" && "dataKey" in value && typeof value.dataKey === "string");
  }
  export function resolveViewGroupColumnKey(storedKey, currentKeys) {
    if (currentKeys.includes(storedKey)) {
      return storedKey;
    }
    const matches = currentKeys.filter(currentKey => currentKey.endsWith(`-${storedKey}`) || storedKey.endsWith(`-${currentKey}`));
    if (matches.length === 1) {
      return matches[0];
    } else {
      return undefined;
    }
  }
  export function columnKeysMatch(left, right) {
    return left === right || resolveViewGroupColumnKey(left, [right]) === right;
  }
  export function findStoredColumn(prefs: Record<string, Partial<ViewColumn>>, storedKey) {
    for (const [key, value] of Object.entries(prefs)) {
      const candidate = isColumn(value) ? value.dataKey : key;
      if (columnKeysMatch(candidate, storedKey) && isColumn(value)) {
        return value;
      }
      if (columnKeysMatch(candidate, storedKey) && value && typeof value === "object") {
        return {
          ...value,
          dataKey: storedKey
        };
      }
    }
    return undefined;
  }
  export function findCurrentColumn(prefs: Record<string, Partial<ViewColumn>>, currentKey) {
    for (const [key, value] of Object.entries(prefs)) {
      const candidate = isColumn(value) ? value.dataKey : key;
      if (columnKeysMatch(candidate, currentKey)) {
        if (isColumn(value)) {
          return value;
        } else {
          return {
            ...value,
            dataKey: currentKey
          };
        }
      }
    }
    return undefined;
  }
  export function hasNumeric(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  export function buildViewGroupPrefs(viewGroup, currentColumns, currentPrefs) {
    const sourcePrefs = asRecord(currentPrefs);
    const savedPrefs = asRecord(viewGroup.prefs);
    const savedKeys = asDataKeys(viewGroup.dataKeys);
    const currentKeys = currentColumns.map(column => column.dataKey);
    const result = {};
    for (const column of currentColumns) {
      const currentEntry = findCurrentColumn(sourcePrefs, column.dataKey);
      const storedKey = savedKeys.find(key => resolveViewGroupColumnKey(key, [column.dataKey]) === column.dataKey);
      const savedEntry = storedKey ? findStoredColumn(savedPrefs, storedKey) : undefined;
      const entry = {
        ...(currentEntry ?? {}),
        ...(savedEntry ?? {}),
        dataKey: column.dataKey
      };
      entry.hidden = typeof savedEntry?.hidden === "boolean" ? savedEntry.hidden : storedKey === undefined;
      if (!hasNumeric(entry.ordinal) && hasNumeric(column.ordinal)) {
        entry.ordinal = column.ordinal;
      }
      if (entry.width === undefined && column.width !== undefined) {
        entry.width = column.width;
      }
      result[column.dataKey] = entry;
    }
    for (const [key, value] of Object.entries(sourcePrefs)) {
      if (key in result || !value || typeof value !== "object") {
        continue;
      }
      const canonicalKey = isColumn(value) ? value.dataKey : key;
      if (!currentKeys.some(currentKey => columnKeysMatch(canonicalKey, currentKey))) {
        result[key] = {
          ...value,
          dataKey: canonicalKey
        };
      }
    }
    return result;
  }
  export function captureViewGroupPrefs(currentPrefs, dataKeys) {
    const sourcePrefs = asRecord(currentPrefs);
    const result = {};
    for (const dataKey of dataKeys) {
      const entry = findCurrentColumn(sourcePrefs, dataKey);
      if (entry) {
        result[dataKey] = {
          ...entry,
          dataKey
        };
      }
    }
    return result;
  }
  export function selectViewGroupPrefs(currentPrefs, dataKeys, savedPrefs, isUpdate, recordCurrentView) {
    if (isUpdate && !recordCurrentView) {
      if (savedPrefs && typeof savedPrefs === "object" && !Array.isArray(savedPrefs)) {
        return savedPrefs;
      } else {
        return undefined;
      }
    }
    return captureViewGroupPrefs(currentPrefs, dataKeys);
  }
  export function resolveViewGroupDataKeys(storedKeys, currentKeys) {
    const resolved = [];
    for (const key of asDataKeys(storedKeys)) {
      const currentKey = resolveViewGroupColumnKey(key, currentKeys);
      if (currentKey && !resolved.includes(currentKey)) {
        resolved.push(currentKey);
      }
    }
    return resolved;
  }
  export function parseViewGroups(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(group => group !== null && typeof group === "object" && !Array.isArray(group));
  }

