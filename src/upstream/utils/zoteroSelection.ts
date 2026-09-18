  // src/utils/zoteroSelection.ts
  export var LEGACY_SELECTION_METHODS = {
    getSelectedLibraryIDs: "getSelectedLibraryID",
    getSelectedCollections: "getSelectedCollection",
    getSelectedSearches: "getSelectedSavedSearch"
  };
  export function defaultSelectionHost() {
    if (typeof ZoteroPane === "undefined") {
      return undefined;
    } else {
      return ZoteroPane;
    }
  }
  export function selectionValues(host, method, asID?) {
    const selectionHost = host;
    const selectMany = selectionHost?.[method];
    if (typeof selectMany === "function") {
      const values = asID === undefined ? selectMany.call(selectionHost) : selectMany.call(selectionHost, asID);
      if (Array.isArray(values)) {
        return values;
      } else {
        return [];
      }
    }
    const selectOne = selectionHost?.[LEGACY_SELECTION_METHODS[method]];
    if (typeof selectOne !== "function") {
      return [];
    }
    const value = asID === undefined ? selectOne.call(selectionHost) : selectOne.call(selectionHost, asID);
    if (value === undefined || value === null || value === false) {
      return [];
    } else {
      return [value];
    }
  }
  export function getFirstSelectedLibraryID(host = defaultSelectionHost()) {
    return selectionValues(host, "getSelectedLibraryIDs")[0];
  }
  export function getFirstSelectedCollection(host = defaultSelectionHost()) {
    return selectionValues(host, "getSelectedCollections", false)[0];
  }
  export function getFirstSelectedCollectionID(host = defaultSelectionHost()) {
    return selectionValues(host, "getSelectedCollections", true)[0];
  }
  export function getFirstSelectedCollectionOrSearch(host) {
    return selectionValues(host, "getSelectedCollections", false)[0] ?? selectionValues(host, "getSelectedSearches", false)[0];
  }

