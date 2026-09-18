  // src/features/item-tree/itemTreeColumnLifecycle.ts
  export function hasOwn(record, key) {
    return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
  }
  export function isItemTreeColumnRegistered(registry, dataKey) {
    if (typeof registry.isCustomColumn === "function") {
      try {
        if (registry.isCustomColumn.call(registry, dataKey)) {
          return true;
        }
      } catch {}
    }
    if (hasOwn(registry._columnManager?._optionsCache, dataKey)) {
      return true;
    }
    if (hasOwn(registry._customColumns, dataKey)) {
      return true;
    }
    if (typeof registry.getCustomColumns === "function") {
      try {
        return registry.getCustomColumns.call(registry).some(column => column.dataKey === dataKey);
      } catch {}
    }
    return false;
  }
  export function unregisterItemTreeColumnIfRegistered(registry, dataKey) {
    if (!isItemTreeColumnRegistered(registry, dataKey)) {
      return false;
    }
    return registry.unregisterColumn(dataKey);
  }
  export var DEPRECATED_COLUMN_OPTIONS = ["defaultIn", "disableIn", "disabledIn"];
  export function suppressDeprecatedItemTreeColumnWarnings(registry) {
    const definitions = registry._columnManager?._config?.optionTypeDefinition;
    if (!definitions) {
      return () => {};
    }
    const removed = [];
    for (const key of DEPRECATED_COLUMN_OPTIONS) {
      const definition = definitions[key];
      if (!definition || typeof definition !== "object") {
        continue;
      }
      const optionDefinition = definition;
      if (!Object.prototype.hasOwnProperty.call(optionDefinition, "checkHook")) {
        continue;
      }
      removed.push({
        definition: optionDefinition,
        value: optionDefinition.checkHook
      });
      delete optionDefinition.checkHook;
    }
    let restored = false;
    return () => {
      if (restored) {
        return;
      }
      restored = true;
      for (const {
        definition,
        value
      } of removed) {
        if (!Object.prototype.hasOwnProperty.call(definition, "checkHook")) {
          definition.checkHook = value;
        }
      }
    };
  }

