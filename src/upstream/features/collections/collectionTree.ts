import { getString } from "../../utils/locale.ts";
type CountRow = { id: string } & (
 {type: 'collection'; ref: Zotero.Collection} | {type: 'search'; ref: Zotero.Search} |
 {type: 'duplicates'; ref: { _sets?: {_objects: Record<string, unknown>} }} |
 {type: 'group' | 'feed'; ref: { _libraryID: number }} |
 {type: 'library' | 'unfiled' | 'recentlyRead' | 'trash'; ref: {libraryID: number}});
import { getPref,setPref } from "../../utils/prefs.ts";
import { createCollectionItemCountClassNames,reconcileCollectionItemCount,removeOwnedCollectionItemCount,removeOwnedCollectionItemCountIfConflicting } from "./collectionItemCountDOM.ts";
import { config } from "../../config.ts";
import { invalidateCollectionsViewRow,refreshCollectionsViewRenderer,requireCollectionsView,waitForCollectionsViewReady } from "../../utils/zoteroPane.ts";
import { installIdempotentRenderItemPatch } from "./collectionItemCountPatch.ts";
import { getRecentlyReadItemCount } from "./collectionItemCountData.ts";
import { replaceOwnedProperty } from "../../utils/ownedResource.ts";
import { getFirstSelectedCollectionOrSearch } from "../../utils/zoteroSelection.ts";
import { buildMenuPopup } from "../../platform/zotero/menu.ts";
import { isEnabel } from "../../utils/base.ts";
  // src/features/collections/collectionTree.ts
  export var collectionItemCountClassNames = createCollectionItemCountClassNames(config.addonRef);
  export var collectionItemCountPatchKey = `${config.addonRef}CollectionItemCountPatch`;
  export var collectionItemCountRenderTokenKey = `${config.addonRef}CollectionItemCountRenderToken`;
  export var MAX_COLLECTION_COUNT_CACHE_ENTRIES = 256;
  export var MAX_TRACKED_COLLECTION_ROWS = 512;
  export function getCollectionItemCountCacheKey(row) {
    const libraryID = row.ref.libraryID ?? row.ref._libraryID ?? "";
    const refID = row.ref._id ?? row.ref.id ?? row.ref.key ?? "";
    return `${config.addonRef}:collection-count:${row.type}-${libraryID}-${refID}`;
  }
  export function pruneDetachedRows(rows) {
    for (const row of rows) {
      if (!row.isConnected) {
        rows.delete(row);
      }
    }
  }
  export async function collectionItemCount() {
    const collectionsView = requireCollectionsView();
    await waitForCollectionsViewReady(collectionsView);
    const patchHost = collectionsView;
    const renderedRows = new Set<HTMLElement>();
    const animationFrames = new Set<number>();
    const scheduleFrame = callback => {
      const frame = window.requestAnimationFrame(() => {
        animationFrames.delete(frame);
        callback();
      });
      animationFrames.add(frame);
    };
    let cacheOwner = addon.data.cache;
    const cacheKeys = /* @__PURE__ */new Set();
    return installIdempotentRenderItemPatch({
      host: patchHost,
      patchKey: collectionItemCountPatchKey,
      legacyOriginalKey: config.addonRef,
      createPatchedRenderItem: (originalRenderItem, isActive) => (index, selection, oldDiv, columns) => {
        const div = originalRenderItem.call(collectionsView, index, selection, oldDiv, columns);
        if (!isActive()) {
          return div;
        }
        pruneDetachedRows(renderedRows);
        renderedRows.add(div);
        while (renderedRows.size > MAX_TRACKED_COLLECTION_ROWS) {
          const oldestRow = renderedRows.values().next().value;
          if (!oldestRow) {
            break;
          }
          renderedRows.delete(oldestRow);
          const oldestPrimary = oldestRow.querySelector(".primary");
          if (oldestPrimary) {
            removeOwnedCollectionItemCount(oldestPrimary, collectionItemCountClassNames);
          }
          const oldestTokenHost = oldestRow;
          delete oldestTokenHost[collectionItemCountRenderTokenKey];
        }
        const renderToken = {};
        const tokenHost = div;
        tokenHost[collectionItemCountRenderTokenKey] = renderToken;
        const row = collectionsView.getRow(index) as unknown as CountRow;
        const cacheKey = getCollectionItemCountCacheKey(row);
        if (addon.data.cache !== cacheOwner) {
          cacheOwner = addon.data.cache;
          cacheKeys.clear();
        }
        const updateCount = async () => {
          let totalNumber = -1;
          const currentCacheOwner = cacheOwner;
          if (currentCacheOwner[cacheKey] !== undefined) {
            totalNumber = currentCacheOwner[cacheKey];
            cacheKeys.delete(cacheKey);
            cacheKeys.add(cacheKey);
          } else {
            if (row.type == "library") {
              totalNumber = (await Zotero.Items.getAll(row.ref.libraryID, true, false)).filter(i => i.isTopLevelItem()).length;
            } else if (row.type == "collection") {
              if (Zotero.Prefs.get("recursiveCollections")) {
                totalNumber = new Set(row.ref.getDescendents(false, "item", false).map(i => i.id)).size;
              } else {
                totalNumber = row.ref.getChildItems(true, false).length;
              }
            } else if (row.type == "duplicates") {
              if (row.ref._sets) {
                totalNumber = Object.keys(row.ref._sets._objects).length;
              }
            } else if (row.type == "unfiled") {
              totalNumber = (await Zotero.Items.getAll(row.ref.libraryID, true, false)).filter(i => i.isTopLevelItem() && i.getCollections().length == 0).length;
            } else if (row.type == "recentlyRead") {
              totalNumber = (await getRecentlyReadItemCount(Zotero.Items, row.ref.libraryID)) ?? -1;
            } else if (row.type == "trash") {
              totalNumber = (await Zotero.Items.getDeleted(1)).length;
            } else if (row.type == "group") {
              totalNumber = (await Zotero.Items.getAll(row.ref._libraryID, true, false)).filter(i => i.isTopLevelItem()).length;
            } else if (row.type == "feed") {
              totalNumber = (await Zotero.Items.getAll(row.ref._libraryID, true, false)).filter(i => i.isTopLevelItem()).length;
            } else if (row.type == "search") {
              totalNumber = (await row.ref.search()).length;
            }
            if (currentCacheOwner !== cacheOwner || addon.data.cache !== currentCacheOwner) {
              if (isActive()) {
                invalidateCollectionsViewRow(collectionsView, index);
              }
              return;
            }
            currentCacheOwner[cacheKey] = totalNumber;
            cacheKeys.delete(cacheKey);
            cacheKeys.add(cacheKey);
            while (cacheKeys.size > MAX_COLLECTION_COUNT_CACHE_ENTRIES) {
              const oldestKey = cacheKeys.values().next().value;
              if (oldestKey === undefined) {
                break;
              }
              cacheKeys.delete(oldestKey);
              delete currentCacheOwner[oldestKey];
            }
          }
          if (totalNumber === -1) {
            return;
          }
          if (currentCacheOwner !== cacheOwner || addon.data.cache !== currentCacheOwner || !isActive() || tokenHost[collectionItemCountRenderTokenKey] !== renderToken) {
            return;
          }
          const currentRow = collectionsView.getRow(index);
          const currentCacheKey = getCollectionItemCountCacheKey(currentRow);
          if (currentCacheKey !== cacheKey) {
            return;
          }
          const primary = div.querySelector(".primary");
          if (!primary) {
            return;
          }
          reconcileCollectionItemCount(primary, totalNumber, collectionItemCountClassNames);
          scheduleFrame(() => {
            if (!isActive() || tokenHost[collectionItemCountRenderTokenKey] !== renderToken) {
              return;
            }
            removeOwnedCollectionItemCountIfConflicting(primary, collectionItemCountClassNames);
          });
        };
        scheduleFrame(() => {
          updateCount().catch(error => {
            ztoolkit.log("Unable to update collection item count", error);
          });
        });
        return div;
      },
      onInstall: () => refreshCollectionsViewRenderer(collectionsView),
      onCleanup: () => {
        for (const frame of animationFrames) {
          window.cancelAnimationFrame(frame);
        }
        animationFrames.clear();
        for (const div of renderedRows) {
          const primary = div.querySelector(".primary");
          if (primary) {
            removeOwnedCollectionItemCount(primary, collectionItemCountClassNames);
          }
          const tokenHost = div;
          delete tokenHost[collectionItemCountRenderTokenKey];
        }
        renderedRows.clear();
        refreshCollectionsViewRenderer(collectionsView);
      }
    });
  }
  export var getString2 = s => s.toLowerCase();
  export var sortFunctions = {
    "No Sort": (A, B) => {
      return 0;
    },
    "Collection Name (A-Z)": (A, B) => {
      const nameA = getString2(A.name);
      const nameB = getString2(B.name);
      if (nameA < nameB) {
        return -1;
      } else if (nameA > nameB) {
        return 1;
      } else {
        return 0;
      }
    },
    "Collection Name (Z-A)": (A, B) => {
      const nameA = getString2(A.name);
      const nameB = getString2(B.name);
      if (nameA < nameB) {
        return 1;
      } else if (nameA > nameB) {
        return -1;
      } else {
        return 0;
      }
    },
    "Item Count (0-9)": (A, B) => {
      try {
        const numA = A.getChildItems(true, false).length;
        const numB = B.getChildItems(true, false).length;
        return numA - numB;
      } catch {
        return 0;
      }
    },
    "Item Count (9-0)": (A, B) => {
      try {
        const numA = A.getChildItems(true, false).length;
        const numB = B.getChildItems(true, false).length;
        return numB - numA;
      } catch {
        return 0;
      }
    }
  };
  export function patch() {
    const prototype = Zotero.CollectionTreeRow.prototype;
    const originalGetChildren = prototype.getChildren;
    const patchedGetChildren = function () {
      const sortBy = getPref(`collectionItem.sortBy`);
      const children = originalGetChildren.call(this);
      const sortFunc = sortFunctions[sortBy];
      if (!sortFunc) {
        return children;
      }
      return [...children].sort(sortFunc);
    };
    return replaceOwnedProperty(prototype, "getChildren", patchedGetChildren);
  }
  export var getSelectedCollection = () => {
    const collectionsView = requireCollectionsView();
    const selected = getFirstSelectedCollectionOrSearch(collectionsView);
    if (!selected) {
      throw new Error("No collection or saved search is selected.");
    }
    return selected;
  };
  export function refreshCollectionTree() {
    refreshCollectionsViewRenderer(requireCollectionsView());
  }
  export function sortCollectionItem() {
    const cleanupPatch = patch();
    const sortButton = ztoolkit.UI.insertElementBefore({
      tag: "toolbarbutton",
      namespace: "xul",
      classList: ["zotero-tb-collection-sort"],
      styles: {
        listStyleImage: `url(chrome://${config.addonRef}/content/icons/collection-sort.svg)`,
        fill: "currentColor"
      }
    }, document.querySelector("#zotero-collections-toolbar spacer"));
    const onClick = event => {
      const sortBy = Object.keys(sortFunctions);
      const prefKey = `${config.addonRef}.collectionItem.sortBy`;
      buildMenuPopup({
        x: event.screenX,
        y: event.screenY
      }, sortBy.map(by => {
        return {
          tag: "menuitem",
          attributes: {
            label: by,
            type: "checkbox",
            checked: Zotero.Prefs.get(prefKey) == by
          },
          listeners: [{
            type: "command",
            listener: () => {
              Zotero.Prefs.set(prefKey, by);
              try {
                refreshCollectionTree();
              } catch (error) {
                ztoolkit.log("Unable to refresh collection tree", error);
              }
            }
          }]
        };
      }));
    };
    sortButton?.addEventListener("click", onClick);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      sortButton?.removeEventListener("click", onClick);
      sortButton?.remove();
      cleanupPatch();
    };
  }
  export var favoritePrefKey = `${config.addonRef}.collectionItem.favoriteKeys`;
  export var FAVORITE_MENU_SEPARATOR_ID = `${config.addonRef}-favorite-collections-separator`;
  export var FAVORITE_ADD_MENU_ID = `${config.addonRef}-favorite-collections-add`;
  export var FAVORITE_REMOVE_MENU_ID = `${config.addonRef}-favorite-collections-remove`;
  export async function favoriteCollections() {
    let active = true;
    let refreshGeneration = 0;
    let splitterCleanup;
    const getParentCollectionInfo = (libraryID, key) => {
      const library = Zotero.Libraries.get(libraryID);
      if (!library) throw new Error(`Library not found: ${libraryID}`);
      const groupName = library.name;
      const names = [];
      const getCollectionState = key2 => {
        const col = Zotero.Collections.getByLibraryAndKey(libraryID, key2) || Zotero.Searches.getByLibraryAndKey(libraryID, key2);
        if (!col) {
          throw new Error(`Collection not found: ${libraryID}/${key2}`);
        }
        names.push(col.name);
        return {
          name: col.name,
          parentKey: col.parentKey || ""
        };
      };
      while (key) {
        key = getCollectionState(key).parentKey;
      }
      return groupName + "/" + names.reverse().join("/");
    };
    const refresh = async () => {
      if (!active) {
        return;
      }
      const generation = ++refreshGeneration;
      splitterCleanup?.();
      splitterCleanup = undefined;
      const id = "favorite-collections";
      const splitterID = "favorite-splitter";
      document.querySelector("#" + id)?.remove();
      document.querySelector("#" + splitterID)?.remove();
      let data = JSON.parse(String(Zotero.Prefs.get(favoritePrefKey) || "[]"));
      if (data.length == 0) {
        return;
      }
      const beforeNode = document.querySelector("#zotero-collections-tree-container");
      const height = getPref(`favoriteCollections.height`) || 0;
      const collapsed = getPref(`favoriteCollections.collapsed`);
      const minHeight = 25;
      const container = ztoolkit.UI.insertElementBefore({
        tag: "div",
        id,
        styles: {
          display: "flex",
          flexDirection: "column",
          padding: "0px 8px",
          minHeight: minHeight + "px",
          paddingBottom: "4px",
          overflow: "auto",
          height: height ? height + "px" : "50px"
        },
        attributes: {
          collapsed
        },
        children: [
        // 块名称
        {
          tag: "div",
          id: "title",
          styles: {
            marginBottom: "4px",
            display: "flex",
            alignItems: "center"
          },
          children: [{
            tag: "span",
            styles: {
              display: "inline-block",
              width: "16px",
              height: "16px",
              fill: "#f5c050"
            },
            properties: {
              innerHTML: `<svg width="16" height="16" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" class="video-fav-icon video-toolbar-item-icon" data-v-b42ec39c=""><path fill-rule="evenodd" clip-rule="evenodd" d="M19.8071 9.26152C18.7438 9.09915 17.7624 8.36846 17.3534 7.39421L15.4723 3.4972C14.8998 2.1982 13.1004 2.1982 12.4461 3.4972L10.6468 7.39421C10.1561 8.36846 9.25639 9.09915 8.19315 9.26152L3.94016 9.91102C2.63155 10.0734 2.05904 11.6972 3.04049 12.6714L6.23023 15.9189C6.96632 16.6496 7.29348 17.705 7.1299 18.7605L6.39381 23.307C6.14844 24.6872 7.62063 25.6614 8.84745 25.0119L12.4461 23.0634C13.4276 22.4951 14.6544 22.4951 15.6359 23.0634L19.2345 25.0119C20.4614 25.6614 21.8518 24.6872 21.6882 23.307L20.8703 18.7605C20.7051 17.705 21.0339 16.6496 21.77 15.9189L24.9597 12.6714C25.9412 11.6972 25.3687 10.0734 24.06 9.91102L19.8071 9.26152Z"></path></svg>`
            }
          }, {
            tag: "span",
            styles: {
              marginLeft: "5px"
            },
            properties: {
              textContent: getString("ui-favorites-count", { args: { count: data.length } })
            }
          }]
        }, {
          tag: "div",
          id: "rows",
          styles: {}
        }]
      }, beforeNode);
      const isCurrent = () => active && generation === refreshGeneration && container.isConnected;
      const splitter = ztoolkit.UI.insertElementBefore({
        tag: "splitter",
        id: splitterID,
        namespace: "xul",
        attributes: {
          orient: "vertical",
          collapse: "before",
          state: collapsed ? "collapsed" : ""
        },
        styles: {
          // marginBottom: "4px"
        }
      }, beforeNode);
      const onSplitterMouseMove = () => {
        if (!isCurrent()) {
          return;
        }
        const state = splitter.getAttribute("state");
        if (state == "dragging") {
          if (container.offsetHeight < minHeight) {
            container.style.height = minHeight + "px";
          }
          setPref(`favoriteCollections.collapsed`, false);
          setPref(`favoriteCollections.height`, container.offsetHeight);
        } else if (state == "collapsed") {
          setPref(`favoriteCollections.collapsed`, true);
        }
      };
      splitter.addEventListener("mousemove", onSplitterMouseMove);
      splitterCleanup = () => {
        splitter.removeEventListener("mousemove", onSplitterMouseMove);
      };
      const rowsNode = container.querySelector("#rows");
      for (const colData of data) {
        if (!isCurrent()) {
          return;
        }
        let collection;
        let count = "-";
        try {
          if (colData.type == "search") {
            collection = await Zotero.Searches.getByLibraryAndKeyAsync(colData.libraryID, colData.key);
            count = String((await collection.search()).length);
          } else {
            collection = await Zotero.Collections.getByLibraryAndKeyAsync(colData.libraryID, colData.key);
            count = String(collection.getChildItems(true, false).length);
          }
        } catch (e) {
          ztoolkit.log(e);
          continue;
        }
        if (!isCurrent()) {
          return;
        }
        if (!collection) {
          continue;
        }
        ztoolkit.UI.appendElement({
          tag: "div",
          classList: ["item"],
          attributes: {
            title: getParentCollectionInfo(colData.libraryID, colData.key)
          },
          styles: {
            padding: "4px",
            paddingLeft: "1.5em",
            paddingRight: "9px",
            borderRadius: "5px"
          },
          children: [{
            tag: "div",
            styles: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between"
            },
            children: [{
              tag: "div",
              styles: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center"
              },
              children: [{
                tag: "span",
                classList: ["icon", "icon-css", colData.type == "search" ? "icon-search" : "icon-collection", "cell-icon"],
                styles: {
                  width: "16px",
                  height: "16px"
                }
              }, {
                tag: "span",
                styles: {
                  marginLeft: "5px"
                },
                properties: {
                  innerText: collection.name
                }
              }]
            }, {
              tag: "span",
              properties: {
                innerText: count
              }
            }],
            listeners: [{
              type: "click",
              listener: () => {
                if (colData.type == "search") {
                  requireCollectionsView().selectSearch(collection.id);
                } else {
                  requireCollectionsView().selectCollection(collection.id);
                }
              }
            }, {
              type: "contextmenu",
              listener: event => {
                buildMenuPopup({
                  x: event.screenX,
                  y: event.screenY
                }, [{
                  tag: "menuitem",
                  attributes: {
                    label: getString("ui-move-up")
                  },
                  listeners: [{
                    type: "command",
                    listener: () => {
                      const index = data.indexOf(colData);
                      if (index == 0) {
                        return;
                      }
                      const preData = data[index - 1];
                      data[index - 1] = colData;
                      data[index] = preData;
                      Zotero.Prefs.set(favoritePrefKey, JSON.stringify(data));
                      scheduleRefresh();
                    }
                  }]
                }, {
                  tag: "menuitem",
                  attributes: {
                    label: getString("ui-move-down")
                  },
                  listeners: [{
                    type: "command",
                    listener: () => {
                      const index = data.indexOf(colData);
                      if (index == data.length - 1) {
                        return;
                      }
                      const nextData = data[index + 1];
                      data[index + 1] = colData;
                      data[index] = nextData;
                      Zotero.Prefs.set(favoritePrefKey, JSON.stringify(data));
                      scheduleRefresh();
                    }
                  }]
                }, {
                  tag: "menuseparator"
                }, {
                  tag: "menuitem",
                  attributes: {
                    label: getString("ui-remove-favorite")
                  },
                  listeners: [{
                    type: "command",
                    listener: () => {
                      data = data.filter(i => i.libraryID != colData.libraryID || i.key != colData.key);
                      Zotero.Prefs.set(favoritePrefKey, JSON.stringify(data));
                      scheduleRefresh();
                    }
                  }]
                }]);
              }
            }]
          }]
        }, rowsNode);
      }
    };
    const scheduleRefresh = () => {
      refresh().catch(error => {
        ztoolkit.log("Unable to refresh favorite collections", error);
      });
    };
    await refresh();
    const isInFavorite = () => {
      const data = JSON.parse(String(Zotero.Prefs.get(favoritePrefKey) || "[]"));
      const col = getFirstSelectedCollectionOrSearch(requireCollectionsView());
      if (!col || !["search", "collection"].includes(col.objectType)) {
        return -1;
      }
      if (["search", "collection"].includes(col.objectType) && Boolean(data.find(i => col.key == i.key && col.libraryID == i.libraryID))) {
        return 1;
      } else {
        return 0;
      }
    };
    ztoolkit.Menu.register("collection", {
      tag: "menuseparator",
      id: FAVORITE_MENU_SEPARATOR_ID
    });
    ztoolkit.Menu.register("collection", {
      tag: "menuitem",
      id: FAVORITE_ADD_MENU_ID,
      label: getString("ui-add-favorite"),
      getVisibility: () => {
        return isInFavorite() == 0;
      },
      // icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
      commandListener: () => {
        let data = JSON.parse(String(Zotero.Prefs.get(favoritePrefKey) || "[]"));
        const col = getSelectedCollection();
        data = [{
          type: col.objectType,
          key: col.key,
          libraryID: col.libraryID
        }, ...data];
        Zotero.Prefs.set(favoritePrefKey, JSON.stringify(data));
        scheduleRefresh();
      }
    });
    ztoolkit.Menu.register("collection", {
      tag: "menuitem",
      id: FAVORITE_REMOVE_MENU_ID,
      label: getString("ui-remove-favorite"),
      getVisibility: () => {
        return isInFavorite() == 1;
      },
      // icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
      commandListener: () => {
        let data = JSON.parse(String(Zotero.Prefs.get(favoritePrefKey) || "[]"));
        const col = getSelectedCollection();
        data = data.filter(i => i.key != col.key || i.libraryID != col.libraryID);
        Zotero.Prefs.set(favoritePrefKey, JSON.stringify(data));
        scheduleRefresh();
      }
    });
    return () => {
      if (!active) {
        return;
      }
      active = false;
      refreshGeneration += 1;
      splitterCleanup?.();
      splitterCleanup = undefined;
      document.querySelector("#favorite-collections")?.remove();
      document.querySelector("#favorite-splitter")?.remove();
      ztoolkit.Menu.unregister(FAVORITE_MENU_SEPARATOR_ID);
      ztoolkit.Menu.unregister(FAVORITE_ADD_MENU_ID);
      ztoolkit.Menu.unregister(FAVORITE_REMOVE_MENU_ID);
    };
  }
  export async function initCollectionTree() {
    const collectionsView = requireCollectionsView();
    await waitForCollectionsViewReady(collectionsView);
    const cleanups = [];
    const collectionItemCountEnabled = Boolean(isEnabel("collectionItemCount"));
    const sortCollectionItemEnabled = Boolean(isEnabel("sortCollectionItem"));
    const treeCleanups = [];
    if (sortCollectionItemEnabled) {
      treeCleanups.push(sortCollectionItem());
    }
    if (collectionItemCountEnabled) {
      cleanups.push(await collectionItemCount());
    }
    const sortBy = getPref(`collectionItem.sortBy`);
    if (sortCollectionItemEnabled && !collectionItemCountEnabled && sortBy && sortBy !== "No Sort") {
      refreshCollectionsViewRenderer(collectionsView);
    }
    if (isEnabel("favoriteCollections")) {
      treeCleanups.push(await favoriteCollections());
    }
    return () => {
      for (const cleanup of [...treeCleanups, ...cleanups].reverse()) {
        cleanup();
      }
    };
  }
