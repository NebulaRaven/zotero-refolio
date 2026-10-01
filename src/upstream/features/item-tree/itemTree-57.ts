import type { EditableText } from '../../../types/ui.ts';
import { requireItemsView } from "../../utils/zoteroPane.ts";
import { clearPref } from "../../utils/prefs.ts";
import { import_dayjs,import_relativeTime,import_runes,import_utc } from "./itemTree.ts";
import { getDayjsLocale } from "../../utils/date.ts";
import { KeyedTaskGate } from "../../utils/keyedTaskGate.ts";
import { replaceOwnedProperty } from "../../utils/ownedResource.ts";
import { installItemTreeColumnResetGuard,waitForItemsViewTree } from "../../utils/zoteroPane.ts";
import { suppressDeprecatedItemTreeColumnWarnings,unregisterItemTreeColumnIfRegistered } from "./itemTreeColumnLifecycle.ts";
import { installItemTreeRenderPatch } from "./itemTreeRenderPatch.ts";
import { LocalStorage } from "../../platform/persistence/storage.ts";
import { config } from "../../config.ts";
import { startItemTreeContributions } from "./itemTreeLifecycle.ts";
import { adjustDialogLayout,escapeExceptAllowedTags,getColoredTags,getPublicationTitle,isEnabel,isOnlyEmoji,lineProgress,registerShortcut,updatePublicationTags } from "../../utils/base.ts";
import { getString, getPreferenceOptionLabel } from "../../utils/locale.ts";

import { spGetJournalRanks,spGetManualJournalRecord,spOpenSettings } from "../../../app/manualRanks.ts";
import { spGetAutomaticJournalRanks } from "../../../app/journalLookup.ts";
import { spRegisterMenu } from "../../../app/menus.ts";
import { buildRatingStorageUpdate,isLegacyRatingTagName,isStatusTagName,resolveRating } from "./ratingTags.ts";
import { getPref,setPref } from "../../utils/prefs.ts";
import { spDisplayDate } from "../../../core/dates.ts";
import { isTitleColumnItem,reconcileTitleCellDecorations } from "./titleCell.ts";
import { drawOpacityProgress } from "../../utils/draw.ts";
import ColorRNA_default from "color-rna";
import { Tags } from "../tags/tags.ts";
import { garden_default } from "../../utils/garden.ts";
import { easyscholar_default } from "../../utils/easyscholar.ts";
import { getFirstSelectedLibraryID } from "../../utils/zoteroSelection.ts";
import { buildMenuPopup } from "../../platform/zotero/menu.ts";
import { mountColumnFieldPicker } from "./columnFieldPicker.ts";
import { ItemBoxPatchRegistry } from "./itemBoxPatchRegistry.ts";
import { registerNotify } from "../../platform/zotero/notifier.ts";
  // src/features/item-tree/itemTree.ts
  import_dayjs.default.extend(import_relativeTime.default);
  import_dayjs.default.locale(getDayjsLocale(Zotero.locale));
  import_dayjs.default.extend(import_utc.default);
  export class ItemTree {
    declare active: boolean;
    declare cleanups: Array<() => void | Promise<void>>;
    declare timers: Set<number>;
    declare cache: { pdfPageNum: {}; };
    declare pageNumCacheKeys: string[];
    declare publicationUpdateGate: KeyedTaskGate;
    declare patchRenderCell: undefined[];
    declare ready: Promise<void>;
    declare stopRenderCellPatch: () => void;
    declare localStorage: LocalStorage;

    constructor() {
      this.active = true;
      this.cleanups = [];
      this.timers = /* @__PURE__ */new Set();
      this.cache = {
        pdfPageNum: {}
      };
      this.pageNumCacheKeys = [];
      this.publicationUpdateGate = new KeyedTaskGate();
      this.patchRenderCell = [];
      this.ready = this.init();
      registerColumnResizeFix(() => this.active && addon.data.alive).then(cleanup => {
        if (cleanup) {
          this.trackCleanup(cleanup);
        }
      }, error => ztoolkit.log("Failed to install item-tree resize fix", error));
      const renderCell = (item, key) => {
        try {
          const getColumnObj = () => {
            if (Zotero.ItemTreeManager._columnManager) {
              return Zotero.ItemTreeManager._columnManager._optionsCache;
            } else {
              return Zotero.ItemTreeManager._customColumns;
            }
          };
          const dataKey = "stylepersonal-" + key;
          const columnObj = getColumnObj();
          if (!columnObj[dataKey]) {
            return ztoolkit.UI.createElement(document, "span");
          }
          return columnObj[dataKey].renderCell(-1, columnObj[dataKey].dataProvider(item, dataKey), {
            ...columnObj[dataKey], dataKey, label: columnObj[dataKey].label || dataKey,
            className: ""
          }, false, document);
        } catch (e) {
          ztoolkit.log(e);
          return ztoolkit.UI.createElement(document, "span");
        }
      };
      this.trackCleanup(replaceOwnedProperty(addon.api, "renderCell", renderCell));
    }
    trackCleanup(cleanup) {
      let active = true;
      const tracked = () => {
        if (!active) {
          return;
        }
        active = false;
        const index = this.cleanups.indexOf(tracked);
        if (index >= 0) {
          this.cleanups.splice(index, 1);
        }
        try {
          cleanup();
        } catch (error) {
          ztoolkit.log("Failed to clean up item-tree resource", error);
        }
      };
      if (!this.active) {
        tracked();
        return () => {};
      }
      this.cleanups.push(tracked);
      return tracked;
    }
    scheduleTimeout(callback, delay = 0) {
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        if (!this.active || !addon.data.alive) {
          return;
        }
        try {
          const result = callback();
          if (result && typeof result.catch === "function") {
            result.catch(error => ztoolkit.log("Item-tree timer failed", error));
          }
        } catch (error) {
          ztoolkit.log("Item-tree timer failed", error);
        }
      }, delay);
      this.timers.add(timer);
      return timer;
    }
    addRenderCellPatch(patch2) {
      if (this.active) {
        this.patchRenderCell.push(patch2);
      }
    }
    async init() {
      if (!this.active) {
        return;
      }
      const itemTree = window.require("zotero/itemTree");
      this.trackCleanup(installItemTreeColumnResetGuard(itemTree.prototype));
      try {
        this.trackCleanup(suppressDeprecatedItemTreeColumnWarnings(Zotero.ItemTreeManager));
      } catch (error) {
        ztoolkit.log("Failed to normalize item-tree column definitions", error);
      }
      const stopRenderCellPatch = installItemTreeRenderPatch(itemTree.prototype, this.patchRenderCell, () => this.active && addon.data.alive, error => ztoolkit.log("Failed to decorate an item-tree cell", error));
      if (this.active) {
        this.stopRenderCellPatch = stopRenderCellPatch;
        this.trackCleanup(stopRenderCellPatch);
      } else {
        stopRenderCellPatch();
        return;
      }
      this.localStorage = new LocalStorage(config.addonRef);
      addon.api.journalStorage = this.localStorage;
      this.trackCleanup(() => {
        if (addon.api.journalStorage === this.localStorage) delete addon.api.journalStorage;
        this.localStorage.dispose();
        this.cache = {
          pdfPageNum: {}
        };
        this.pageNumCacheKeys.length = 0;
        this.publicationUpdateGate.clear();
      });
      if (!(await waitForItemsViewTree(() => ZoteroPane.itemsView, () => this.active && addon.data.alive, () => Zotero.Promise.delay(100)))) {
        return;
      }
      if (!this.active || !addon.data.alive) {
        return;
      }
      const contributionKeys = [
      // The built-in title decoration must not depend on optional columns.
      "title", "tags", "textTags", "publicationTags", "IF", "status", "rating", "remark", "annotation", "creator", "publication", "readTime", "dateAdded"];
      this.trackCleanup(await startItemTreeContributions(contributionKeys.map(key => ({
        id: `column:${key}`,
        isEnabled: () => Boolean(isEnabel(key + "Column")),
        start: () => this[key]()
      })), ({
        id,
        error
      }) => ztoolkit.log(`Item-tree contribution ${id} failed`, error), () => this.active && addon.data.alive));
      if (!this.active || !addon.data.alive) {
        return;
      }
      const refolioIcon = `chrome://${config.addonRef}/content/icons/refolio.svg`;
      const regularItems = (context: { items?: Zotero.Item[] }) => (context.items ?? []).filter(item => item.isRegularItem());
      this.trackCleanup(await startItemTreeContributions([{
        id: "menu:style",
        // Feature switches are read at startup, so skip a submenu that would stay empty.
        isEnabled: () => Boolean(isEnabel("manualJournalRanks") || isEnabel("publicationTagsColumn")),
        start: () => spRegisterMenu({
          menuID: "refolio-item-menu",
          target: "main/library/item",
          menus: [{
            menuType: "submenu",
            l10nID: "stylepersonal-menu-refolio",
            icon: refolioIcon,
            menus: [{
              menuType: "menuitem",
              l10nID: "stylepersonal-menu-edit-journal-labels",
              onShowing: (_event, context) => {
                context.setVisible(Boolean(isEnabel("manualJournalRanks")));
                context.setEnabled(regularItems(context).length > 0);
              },
              onCommand: (_event, context) => spOpenSettings(getPublicationTitle(regularItems(context)[0]))
            }, {
              menuType: "menuitem",
              l10nID: "stylepersonal-menu-update-journal-labels",
              icon: refolioIcon,
              onShowing: (_event, context) => {
                context.setVisible(Boolean(isEnabel("publicationTagsColumn")));
                context.setEnabled(regularItems(context).length > 0);
              },
              onCommand: async (_event, context) => {
                const titles = [...new Set(regularItems(context).map(item => getPublicationTitle(item)))];
                for (const title of titles) {
                  try {
                    await updatePublicationTags(this.localStorage, title, "context-menu");
                  } catch (e) {
                    ztoolkit.log(e);
                  }
                }
                await requireItemsView().refreshAndMaintainSelection();
              }
            }]
          }]
        })
      }, {
        id: "menu:related-items",
        isEnabled: () => Boolean(isEnabel("relatedItems")),
        start: () => {
          const relatedItemsCallback = async (selected: Zotero.Item[], operation = "add") => {
            const items = selected.filter(i => i.isRegularItem());
            for (const item1 of items) {
              for (const item2 of items) {
                if (item1 != item2) {
                  if (operation == "remove") {
                    item1.removeRelatedItem(item2);
                    item2.removeRelatedItem(item1);
                  } else {
                    item1.addRelatedItem(item2);
                    item2.addRelatedItem(item1);
                  }
                }
              }
              await item1.saveTx();
            }
            await addon.api.refreshGraphView();
          };
          const releaseMenu = spRegisterMenu({
            menuID: "refolio-related-items-menu",
            target: "main/library/item",
            menus: [{
              menuType: "submenu",
              l10nID: "stylepersonal-menu-related-items",
              icon: `chrome://${config.addonRef}/content/icons/related.svg`,
              menus: ([["stylepersonal-menu-link-items", "add"], ["stylepersonal-menu-unlink-items", "remove"]] as const).map(([l10nID, operation]) => ({
                menuType: "menuitem" as const,
                l10nID,
                onShowing: (_event: Event, context: _ZoteroTypes.MenuManager.LibraryMenuContext) => context.setEnabled(regularItems(context).length >= 2),
                onCommand: async (_event: Event, context: _ZoteroTypes.MenuManager.LibraryMenuContext) => {
                  await relatedItemsCallback(context.items ?? [], operation);
                }
              }))
            }]
          });
          const stopShortcut = registerShortcut("relatedItems.link.shortcut", async () => {
            await relatedItemsCallback(ZoteroPane.getSelectedItems());
          });
          return () => {
            stopShortcut();
            releaseMenu();
          };
        }
      }], ({
        id,
        error
      }) => ztoolkit.log(`Item-tree contribution ${id} failed`, error), () => this.active && addon.data.alive));
    }
    /**
     * 注册一个列
     * @param key
     */
    getStorage() {
      return this.localStorage;
    }
    destroy() {
      if (!this.active) {
        return;
      }
      this.active = false;
      for (const timer of this.timers) {
        window.clearTimeout(timer);
      }
      this.timers.clear();
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch (error) {
          ztoolkit.log("Failed to clean up item-tree", error);
        }
      }
      this.stopRenderCellPatch?.();
      this.stopRenderCellPatch = undefined;
      this.patchRenderCell.length = 0;
    }
    async registerColumn(key, getData, renderCell) {
      if (!this.active || !addon.data.alive) {
        return false;
      }
      try {
        unregisterItemTreeColumnIfRegistered(Zotero.ItemTreeManager, `stylepersonal-${key}`);
      } catch (error) {
        ztoolkit.log("Failed to remove stale item-tree column", key, error);
      }
      const registered = Zotero.ItemTreeManager.registerColumn({
        dataKey: key,
        label: getString(`column-${key}`),
        zoteroPersist: ["width", "hidden", "sortDirection"],
        dataProvider: (item, dataKey) => {
          if (!item) {
            return "";
          }
          try {
            const data = getData(item);
            return `${data.sortIndex}
${JSON.stringify(data.data)}`;
          } catch (e) {
            ztoolkit.log(e);
            return "";
          }
        },
        renderCell: (index, data, column) => {
          const span = ztoolkit.UI.createElement(document, "span");
          span.style.pointerEvents = "auto";
          span.style.display = "flex";
          span.style.alignItems = "center";
          if (!column) {
            return span;
          }
          span.className = `cell ${column.className}`;
          span.style.textOverflow = "clip";
          if (!data) {
            return span;
          }
          try {
            data = JSON.parse(data.split("\n")[1]);
          } catch {
            ztoolkit.log("error", key, data);
            return span;
          }
          if (!data) {
            span.style.width = "100%";
            span.style.height = "36px";
            return span;
          }
          try {
            return renderCell(span, data, index);
          } catch (e) {
            ztoolkit.log(data, e);
            return span;
          }
        },
        pluginID: "stylepersonal"
      });
      if (!this.active || !addon.data.alive) {
        if (registered) {
          try {
            unregisterItemTreeColumnIfRegistered(Zotero.ItemTreeManager, registered);
          } catch {}
        }
        return false;
      }
      if (registered) {
        this.trackCleanup(() => {
          try {
            unregisterItemTreeColumnIfRegistered(Zotero.ItemTreeManager, registered);
          } catch (error) {
            ztoolkit.log("Failed to unregister item-tree column", registered, error);
          }
        });
      }
      return registered;
    }
    isSelectedRow(index) {
      const rowNode = document.querySelector(`#item-tree-main-default-row-${index}`) || document.querySelector(`#item-tree-main-row-${index}`);
      return rowNode?.classList.contains("selected");
    }
    getCachedPageNum(itemID) {
      const cache = this.cache.pdfPageNum;
      if (!Object.prototype.hasOwnProperty.call(cache, itemID)) {
        return undefined;
      }
      const index = this.pageNumCacheKeys.indexOf(itemID);
      if (index >= 0) {
        this.pageNumCacheKeys.splice(index, 1);
      }
      this.pageNumCacheKeys.push(itemID);
      return cache[itemID];
    }
    setCachedPageNum(itemID, pageNum) {
      const cache = this.cache.pdfPageNum;
      const index = this.pageNumCacheKeys.indexOf(itemID);
      if (index >= 0) {
        this.pageNumCacheKeys.splice(index, 1);
      }
      this.pageNumCacheKeys.push(itemID);
      cache[itemID] = pageNum;
      while (this.pageNumCacheKeys.length > 500) {
        const oldest = this.pageNumCacheKeys.shift();
        if (oldest !== undefined) {
          delete cache[oldest];
        }
      }
    }
    resolveItemRating(item) {
      const tags = item.getTags();
      return resolveRating(ztoolkit.ExtraField.getExtraField(item, "rate"), tags, this.getColoredLegacyRatingTagNames(item, tags), getPref("ratingColumn.storage"));
    }
    getColoredLegacyRatingTagNames(item, tags) {
      return new Set(tags.filter(({
        tag
      }) => isLegacyRatingTagName(tag)).filter(({
        tag
      }) => Zotero.Tags.getColor(item.libraryID, tag)).map(({
        tag
      }) => tag));
    }
    async dateAdded() {
      for (const dataKey of ["dateAdded", "dateModified"] as const) {
        this.addRenderCellPatch({
          key: dataKey,
          renderCell: (cellSpan, index) => {
            const item = requireItemsView().getRow(index).ref;
            const dateType = getPref(`${dataKey}Column.dateType`);
            const format = getPref(`${dataKey}Column.format`);
            const delatHour = getPref(`${dataKey}Column.deltaHour`) ?? "system";
            let dateText = "";
            const date = import_dayjs.default.utc(item[dataKey]);
            if (dateType == "absolute") {
              dateText = spDisplayDate<{format(pattern: string): string}>(import_dayjs.default, item[dataKey], delatHour).format(format);
            } else if (dateType == "relative") {
              dateText = date.fromNow();
            }
            if (cellSpan.classList.contains("first-column")) {
              cellSpan.lastChild.innerText = dateText;
            } else {
              cellSpan.textContent = dateText;
            }
            return cellSpan;
          }
        });
        this.patchSetting(dataKey, [{
          prefKey: `${dataKey}Column.dateType`,
          name: getString("ui-column-date-type"),
          type: "select",
          values: ["absolute", "relative"]
        }, {
          prefKey: `${dataKey}Column.format`,
          name: getString("ui-column-format"),
          type: "input"
        }, {
          prefKey: `${dataKey}Column.deltaHour`,
          name: getString("ui-column-time-zone"),
          type: "select",
          values: ["system", -12, -11, -10, -9.5, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 8.75, 9, 9.5, 10, 10.5, 11, 12, 12.75, 13, 14]
        }]);
      }
    }
    async title() {
      this.addRenderCellPatch({
        key: "title",
        renderCell: (cellSpan, index, itemRef) => {
          if (!isTitleColumnItem(itemRef)) {
            return cellSpan;
          }
          const item = itemRef;
          const titleSpan = cellSpan.querySelector("span.cell-text");
          if (!titleSpan) {
            return cellSpan;
          }
          const titleHTML = titleSpan.innerHTML;
          titleSpan.innerHTML = "";
          const translatedTitle = ztoolkit.ExtraField.getExtraField(item, "titleTranslation");
          ztoolkit.UI.appendElement({
            tag: "span",
            id: "title",
            attributes: {
              title: item.getDisplayTitle()
            },
            // 防止出现html错误导致的Zotero界面崩溃
            properties: getPref(`titleColumn.translate`) && translatedTitle ? {
              innerText: ztoolkit.ExtraField.getExtraField(item, "titleTranslation")
            } : {
              innerHTML: titleHTML.replace(/&(?![a-zA-Z]{2,8};)/g, "&amp;")
            }
          }, titleSpan);
          reconcileTitleCellDecorations(cellSpan, {
            showColoredTags: Boolean(getPref("titleColumn.tags")),
            showEmojiTags: Boolean(getPref("titleColumn.emojiTags")),
            rating: this.resolveItemRating(item),
            selectedStar: getPref("ratingColumn.selectedStar") || "⭐",
            tagsAfterTitle: Boolean(Zotero.Prefs.get("ui.tagsAfterTitle"))
          });
          let color = getPref(`titleColumn.color`);
          if (this.isSelectedRow(index)) {
            color = "#fff";
          }
          const opacity = getPref(`titleColumn.opacity`);
          if (Number(opacity) == 0) {
            return cellSpan;
          }
          const record = addon.api.storage.get(item, "readingTime");
          if (!record) {
            return cellSpan;
          }
          const values = [];
          for (let i = 0; i < record.page; i++) {
            values.push(parseFloat(record.data[i]) || 0);
          }
          if (values.length == 0) {
            return cellSpan;
          }
          titleSpan.style.position = "relative";
          titleSpan.style.width = "100%";
          titleSpan.style.zIndex = "1";
          const progressNode = drawOpacityProgress(values, color, opacity, 60);
          progressNode.style.top = "0";
          progressNode.style.zIndex = "-1";
          progressNode.style.position = "absolute";
          titleSpan.appendChild(progressNode);
          return cellSpan;
        }
      });
      this.patchSetting("title", [{
        prefKey: "titleColumn.color",
        name: getString("ui-color"),
        type: "input"
      }, {
        prefKey: "titleColumn.opacity",
        name: getString("ui-column-opacity"),
        type: "range",
        range: [0, 1, 0.01]
      }, {
        prefKey: "titleColumn.tags",
        name: getString("tags"),
        type: "boolean"
      }, {
        prefKey: "titleColumn.emojiTags",
        name: getString("ui-column-emoji"),
        type: "boolean"
      }, {
        prefKey: "titleColumn.translate",
        name: getString("ui-column-translate"),
        type: "boolean"
      }]);
      this.trackCleanup(registerShortcut("titleTranslate.shortcut", async e => {
        const key = "titleColumn.translate";
        setPref(key, !getPref(key));
        await requireItemsView().refreshAndMaintainSelection();
      }));
    }
    async readTime() {
      const key = "readTime";
      await this.registerColumn(key, item => {
        try {
          const record = addon.api.storage.get(item, "readingTime");
          const totalTime = Object.values(record.data).reduce((x, y) => Number(x) + Number(y));
          if (!totalTime) {
            return {
              sortIndex: 0,
              data: {
                sec: 0
              }
            };
          }
          return {
            sortIndex: parseInt(String(totalTime)),
            data: {
              sec: totalTime
            }
          };
        } catch {
          return {
            sortIndex: 0,
            data: {
              sec: 0
            }
          };
        }
      }, (span, data, index) => {
        span.style.display = "flex";
        span.style.flexDirection = "row";
        span.style.justifyContent = "space-between";
        const sec = data.sec;
        if (sec == 0) {
          return span;
        }
        const isProgress = getPref(`readTime.progress`);
        const isText = getPref(`readTime.text`);
        if (isProgress && sec > 0) {
          const progressNode = lineProgress(sec, parseFloat(getPref(`readTime.max`)), this.isSelectedRow(index) ? "#fff" : getPref(`readTime.color`), getPref(`readTime.opacity`));
          if (isText) {
            progressNode.style.marginRight = "0.5em";
          }
          span.appendChild(progressNode);
          progressNode.style.width = "auto";
          progressNode.style.flexGrow = "1";
        }
        if (isText) {
          span.appendChild(ztoolkit.UI.createElement(document, "span", {
            styles: {
              display: "inline-block",
              // width: "2em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            },
            properties: {
              innerText: sec < 0 ? "-" : describeTime(sec)
            }
          }));
        }
        return span;
      });
      this.patchSetting(key, [{
        prefKey: "readTime.color",
        name: getString("ui-color"),
        type: "input"
      }, {
        prefKey: "readTime.opacity",
        name: getString("ui-column-opacity"),
        type: "range",
        range: [0, 1, 0.01]
      }, {
        prefKey: "readTime.max",
        name: getString("ui-column-max"),
        type: "input"
      }, {
        prefKey: "readTime.progress",
        name: getString("ui-column-progress"),
        type: "boolean"
      }, {
        prefKey: "readTime.text",
        name: getString("ui-column-text"),
        type: "boolean"
      }]);
    }
    async tags() {
      const key = "tags";
      await this.registerColumn(key, item => {
        let coloredTags = getColoredTags(item);
        coloredTags = coloredTags.filter(i => !isStatusTagName(i.tag));
        return {
          sortIndex: coloredTags.length,
          data: coloredTags.length > 0 ? coloredTags : false
        };
      }, (span, data, index) => {
        span.style.position = "relative";
        span.style.display = "flex";
        span.style.alignItems = "center";
        span.style.height = "100%";
        const getTagSpan = (tag, color) => {
          const tagSpan = ztoolkit.UI.createElement(document, "span");
          tagSpan.style.position = "absolute";
          tagSpan.className = "tag-swatch";
          tagSpan.style.display = "inline-block";
          tagSpan.style.marginLeft = "0";
          if (isOnlyEmoji(tag)) {
            tagSpan.textContent = tag;
          } else {
            tagSpan.classList.add("colored");
            tagSpan.style.height = "100%";
            tagSpan.style.background = `url("chrome://zotero/skin/tag-crescent-border.svg") no-repeat center/contain;`;
            tagSpan.style.color = color;
          }
          return tagSpan;
        };
        const tags = data;
        const align = getPref(`tagsColumn.align`);
        let offset = 0;
        const margin = parseFloat(getPref(`tagsColumn.margin`));
        if (!tags) {
          return span;
        }
        tags.forEach(tagObj => {
          const tag = tagObj.tag;
          const color = tagObj.color;
          if (tag.startsWith("#")) {
            return;
          }
          if (isOnlyEmoji(tag)) {
            (0, import_runes.default)(tag).forEach(tag2 => {
              const tagSpan = getTagSpan(tag2, color);
              tagSpan.style[align] = `${offset + margin}em`;
              span.appendChild(tagSpan);
              offset += margin * 2 + 1;
            });
          } else {
            const tagSpan = getTagSpan(tag, color);
            tagSpan.style[align] = `${offset + 0.25}em`;
            span.appendChild(tagSpan);
            offset += margin + 1;
          }
        });
        return span;
      });
      this.patchSetting(key, [{
        prefKey: "tagsColumn.align",
        name: getString("ui-column-align"),
        type: "select",
        values: ["left", "right"]
      }, {
        prefKey: "tagsColumn.margin",
        name: getString("ui-column-margin"),
        type: "range",
        range: [0, 1, 0.01]
      }]);
      try {
        const refresh = () => {
          if (!this.active || !addon.data.alive) {
            return;
          }
          this.scheduleTimeout(async () => {
            await requireItemsView().refreshAndMaintainSelection();
          });
        };
        const originalSetColor = Zotero.Tags.setColor;
        const wrappedSetColor = async function (id, name, color, pos) {
          await originalSetColor.call(this, id, name, color, pos);
          refresh();
        };
        this.trackCleanup(replaceOwnedProperty(Zotero.Tags, "setColor", wrappedSetColor));
        const originalRemoveFromLibrary = Zotero.Tags.removeFromLibrary;
        const wrappedRemoveFromLibrary = async function (libraryID, tagIDs) {
          await originalRemoveFromLibrary.call(this, libraryID, tagIDs);
          refresh();
        };
        this.trackCleanup(replaceOwnedProperty(Zotero.Tags, "removeFromLibrary", wrappedRemoveFromLibrary));
      } catch (error) {
        ztoolkit.log("Failed to patch tag deletion refresh", error);
      }
    }
    async textTags() {
      const key = "textTags";
      await this.registerColumn(key, item => {
        const coloredTags = getColoredTags(item);
        let tags = item.getTags().filter(tag => coloredTags.map(tag2 => tag2.tag).indexOf(tag.tag) == -1);
        tags = [...coloredTags, ...tags.sort((a, b) => a.tag > b.tag ? 1 : -1)].filter(i => i.tag);
        return {
          sortIndex: tags.map(i => i.tag).join(" "),
          data: tags.length > 0 ? tags : false
        };
      }, (span, data, index) => {
        const margin = getPref(`${key}Column.margin`);
        const padding = getPref(`${key}Column.padding`);
        const getTagSpan = (tag, backgroundColor) => {
          const _backgroundColor = getPref(`${key}Column.backgroundColor`);
          let textColor = getPref(`${key}Column.textColor`);
          textColor = textColor == "auto" && this.isSelectedRow(index) ? "#fff" : textColor;
          backgroundColor = backgroundColor || _backgroundColor || "#fadec9";
          const c = new ColorRNA_default(backgroundColor);
          const [red, green, blue] = c.rgb();
          const hsl = c.HSL();
          hsl[2] = 40;
          const deepColor = c.HSL(hsl).getHex();
          const opacity = parseFloat(getPref(`${key}Column.opacity`));
          const tagSpan = ztoolkit.UI.createElement(document, "span", {
            namespace: "html",
            styles: {
              backgroundColor: `rgba(${red}, ${green}, ${blue}, ${opacity})`,
              padding: `0.05em ${padding}em`,
              color: textColor == "auto" ? deepColor : textColor,
              borderRadius: "3px",
              margin: `${margin}em`
            },
            properties: {
              innerText: tag
            }
          });
          return tagSpan;
        };
        const tags = data;
        if (!tags) {
          return span;
        }
        tags.forEach(tagObj => {
          const tag = tagObj.tag;
          let color = tagObj.color;
          const userColor = addon.api.storage.get({
            key: "Coloring"
          }, tag)?.color;
          const matchTag = Tags.getTagMatch(tag);
          if (userColor) {
            color = userColor;
          }
          if (matchTag) {
            const tagSpan = getTagSpan(matchTag, color);
            span.appendChild(tagSpan);
          }
        });
        return span;
      });
      this.patchSetting(key, [{
        prefKey: `textTagsColumn.match`,
        name: getString("ui-column-match"),
        type: "input"
      }, {
        prefKey: "textTagsColumn.textColor",
        name: getString("ui-column-text-color"),
        type: "input"
      }, {
        prefKey: "textTagsColumn.backgroundColor",
        name: getString("ui-column-background"),
        type: "input"
      }, {
        prefKey: "textTagsColumn.opacity",
        name: getString("ui-column-opacity"),
        type: "range",
        range: [0, 1, 0.01]
      }, {
        prefKey: "textTagsColumn.margin",
        name: getString("ui-column-margin"),
        type: "range",
        range: [0, 0.5, 0.001]
      }, {
        prefKey: "textTagsColumn.padding",
        name: getString("ui-column-padding"),
        type: "range",
        range: [0, 1, 0.001]
      }]);
    }
    async publicationTags() {
      await this.localStorage.lock.promise;
      const key = "publicationTags";
      await this.registerColumn(key, item => {
        const sortBy = getPref(`${key}Column.sortBy`).split(/,\s*/g);
        const maxRank = 9;
        const minRank = 0;
        const invalidIndex = sortBy.map(i => `${minRank}.000000`).join(".");
        const publicationTitle = getPublicationTitle(item);
        if (!publicationTitle) {
          return {
            sortIndex: invalidIndex,
            data: false
          };
        }
        const data = spGetJournalRanks(this.localStorage, publicationTitle);
        if (spGetAutomaticJournalRanks(this.localStorage, publicationTitle) === undefined && getPref("publicationTagsColumn.automaticUpdates") !== false) {
          if (this.publicationUpdateGate.tryStart(publicationTitle)) {
            this.scheduleTimeout(async () => {
              try {
                await updatePublicationTags(this.localStorage, publicationTitle, "automatic");
              } catch (e) {
                ztoolkit.log(e);
              } finally {
                this.publicationUpdateGate.finish(publicationTitle);
              }
            });
          }
        }
        if (data == undefined) {
          return {
            sortIndex: invalidIndex,
            data: false
          };
        }
        const s = sortBy.map(k => {
          const field = k.replace(/^-/, "");
          const fieldValue = String(data[field] ?? "");
          let info;
          if (!fieldValue) {
            return `${minRank}.000000`;
          }
          const _src = getPref(`${key}Column.source`) || "easyscholar";
          const _fi2 = _src === "garden" ? garden_default : easyscholar_default;
          if (_fi2[field]) {
            info = _fi2[field](typeof fieldValue === "number" ? String(fieldValue) : fieldValue);
          } else if (_src !== "garden") {
            try {
              info = easyscholar_default.custom(field, fieldValue);
            } catch {
              info = {
                rank: 1,
                key: k,
                value: fieldValue
              };
            }
          } else {
            info = {
              rank: 1,
              key: field,
              value: String(fieldValue)
            };
          }
          const isReverse = k.startsWith("-");
          info ||= { rank: 1, key: field, value: fieldValue };
          if (!Number.isFinite(info.rank)) info.rank = 1;
          const rank = isReverse ? info.rank : maxRank - info.rank;
          let value = 0;
          if (fieldValue.match(/\d/)) {
            value = parseInt(String(Number(fieldValue.replace(/[^\d.]/g, "")) * 1000));
            if (isReverse) {
              value = 100000 - value;
            }
          }
          const padded = String(value).slice(0, 6).padStart(6, "0");
          return `${rank}.${padded}`;
        }).join(".");
        return {
          sortIndex: s,
          data
        };
      }, (span, data, index) => {
        span.addEventListener("click", async () => {
          const item = ZoteroPane.getSelectedItems()[0];
          const publicationTitle = getPublicationTitle(item);
          if (!publicationTitle) {
            ztoolkit.log("No publicationTitle");
          } else {
            new ztoolkit.ProgressWindow(getString("column-publicationTags"), {
              closeTime: 3000
            }).createLine({
              text: publicationTitle,
              type: "default"
            }).show();
            await updatePublicationTags(this.localStorage, publicationTitle, "column-click");
            await requireItemsView().refreshAndMaintainSelection();
          }
        });
        if (Object.keys(data).length == 0) {
          return span;
        }
        const rankColors = getPref(`${key}Column.rankColors`).split(/,\s*/g);
        const defaultColor = getPref(`${key}Column.defaultColor`);
        const textColor = getPref(`${key}Column.textColor`);
        const opacity = getPref(`${key}Column.opacity`);
        const margin = getPref(`${key}Column.margin`);
        const padding = getPref(`${key}Column.padding`);
        const _source = getPref(`${key}Column.source`) || "easyscholar";
        const fields = getPref(`${key}Column.${_source === "garden" ? "gardenFields" : "fields"}`).split(/,\s*/g).filter(i => data[i]);
        const mapString = getPref(`${key}Column.map`);
        const mapArr: Array<[string | RegExp, string]> = mapString.split(/[,;]\s*/g).filter(s => s.trim().length).map((ss): [string | RegExp, string] => {
          const [s1, s2] = ss.split("=");
          const res = s1.match(/\/(.+)\/(\w*)/);
          if (res) {
            return [new RegExp(res[1], res[2]), s2];
          } else {
            return [s1, s2];
          }
        });
        const getMapString = s => {
          try {
            for (let i = 0; i < mapArr.length; i++) {
              if (typeof mapArr[i][0] == "string") {
                if (mapArr[i][0] == s) {
                  s = mapArr[i][1];
                }
              } else if ((mapArr[i][0] as RegExp).test(s)) {
                s = s.replace(mapArr[i][0], mapArr[i][1]);
                break;
              }
            }
            return s;
          } catch (e) {
            ztoolkit.log(e);
            return s;
          }
        };
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          const fieldValue = String(data[field] ?? "");
          let info;
          const _fi = _source === "garden" ? garden_default : easyscholar_default;
          if (_fi[field]) {
            info = _fi[field](typeof fieldValue === "number" ? String(fieldValue) : fieldValue);
          } else if (_source !== "garden") {
            try {
              info = easyscholar_default.custom(field, fieldValue);
            } catch {
              info = {
                rank: 1,
                key: field,
                value: fieldValue
              };
            }
          } else {
            info = {
              rank: 1,
              key: field,
              value: String(fieldValue)
            };
          }
          info ||= { rank: 1, key: field, value: fieldValue };
          if (!Number.isFinite(info.rank)) info.rank = 1;
          const rankIndex = info.rank - 1;
          const color = rankIndex >= rankColors.length ? rankColors.slice(-1)[0] : rankColors[rankIndex];
          const text = [... /* @__PURE__ */new Set([getMapString(info.key), getMapString(info.value)])].filter(i2 => i2.length > 0).join(" ");
          const c = new ColorRNA_default(color);
          const [red, green, blue] = c.rgb();
          const hsl = c.HSL();
          hsl[2] = 40;
          span.appendChild(ztoolkit.UI.createElement(document, "span", {
            styles: {
              backgroundColor: `rgba(${red}, ${green}, ${blue}, ${opacity})`,
              // color: textColor == "auto" ? `rgba(${red}, ${green}, ${blue}, 1)` : textColor,
              color: textColor == "auto" ? c.HSL(hsl).getHex() : textColor,
              padding: `0.05em ${padding}em`,
              borderRadius: "3px",
              margin: `${margin}em`
            },
            attributes: {
              title: (() => {
                const item = index >= 0 ? requireItemsView().getRow(index)?.ref : null;
                const manual = item && spGetManualJournalRecord(getPublicationTitle(item));
                return manual && Object.hasOwn(manual.fields, field) ? getString("ui-manual-journal-value") : "";
              })()
            },
            properties: {
              innerText: text
            }
          }));
        }
        if (!span.querySelector("span")) {
          span.style.height = "20px";
        }
        return span;
      });
      this.patchSetting(key, [{
        prefKey: `${key}Column.source`,
        name: getString("ui-provider"),
        type: "select",
        values: ["easyscholar", "garden"]
      }, {
        prefKey: `easyscholar.secretKey`,
        name: getString("ui-api-key", { args: { provider: "EasyScholar" } }),
        type: "text"
      }, {
        prefKey: `garden.apiKey`,
        name: getString("ui-api-key", { args: { provider: "Garden" } }),
        type: "text"
      }, {
        prefKey: `${key}Column.fields`,
        name: getString("ui-easyscholar-fields"),
        type: "input"
      }, {
        prefKey: `${key}Column.gardenFields`,
        name: getString("ui-garden-fields"),
        type: "input"
      }, {
        prefKey: `${key}Column.map`,
        name: getString("ui-column-map"),
        type: "input"
      }, {
        prefKey: `${key}Column.rankColors`,
        name: getString("ui-column-rank-colors"),
        type: "input"
      }, {
        prefKey: `${key}Column.defaultColor`,
        name: getString("ui-column-default-color"),
        type: "input"
      }, {
        prefKey: `${key}Column.textColor`,
        name: getString("ui-column-text-color"),
        type: "input"
      }, {
        prefKey: `${key}Column.sortBy`,
        name: getString("ui-column-sort-by"),
        type: "input"
      }, {
        prefKey: `${key}Column.opacity`,
        name: getString("ui-column-opacity"),
        type: "range",
        range: [0, 1, 0.01]
      }, {
        prefKey: `${key}Column.margin`,
        name: getString("ui-column-margin"),
        type: "range",
        range: [0, 0.5, 0.001]
      }, {
        prefKey: `${key}Column.padding`,
        name: getString("ui-column-padding"),
        type: "range",
        range: [0, 1, 0.001]
      }], 500, dialog => {
        const doc = dialog.window.document;
        const toggleKeyRows = source => {
          const esRow = doc.querySelector(`[data-bind="easyscholar.secretKey"]`)?.closest("hbox");
          const gardenRow = doc.querySelector(`[data-bind="garden.apiKey"]`)?.closest("hbox");
          const esFieldsRow = doc.querySelector(`[data-bind="${key}Column.fields"]`)?.closest("hbox");
          const gardenFieldsRow = doc.querySelector(`[data-bind="${key}Column.gardenFields"]`)?.closest("hbox");
          const isGarden = source === "garden";
          if (esRow) {
            esRow.style.display = isGarden ? "none" : "";
          }
          if (gardenRow) {
            gardenRow.style.display = isGarden ? "" : "none";
          }
          if (esFieldsRow) {
            esFieldsRow.style.display = isGarden ? "none" : "";
          }
          if (gardenFieldsRow) {
            gardenFieldsRow.style.display = isGarden ? "" : "none";
          }
        };
        const sourceSelect = doc.querySelector(`[data-bind="${key}Column.source"]`);
        if (sourceSelect) {
          toggleKeyRows(sourceSelect.value);
          sourceSelect.addEventListener("blur", () => toggleKeyRows(sourceSelect.value));
        }
      });
      this.patchItemBox(key, "", getPref(`publicationColumn.fields`).split(/,\s*/));
    }
    async IF() {
      const key = "IF";
      await this.registerColumn(key, item => {
        const field = getPref(`IFColumn.field`);
        const publicationTitle = getPublicationTitle(item);
        if (!publicationTitle) {
          return {
            sortIndex: "0",
            data: false
          };
        }
        const data = spGetJournalRanks(this.localStorage, publicationTitle);
        if (spGetAutomaticJournalRanks(this.localStorage, publicationTitle) === undefined && getPref("publicationTagsColumn.automaticUpdates") !== false) {
          this.scheduleTimeout(async () => {
            try {
              await updatePublicationTags(this.localStorage, publicationTitle, "automatic");
            } catch (e) {
              ztoolkit.log(e);
            }
          });
        }
        if (data == undefined || !data[field]) {
          return {
            sortIndex: "",
            data: false
          };
        }
        return {
          sortIndex: String(Number(Number(data[field]) * 100)),
          data: data[field]
        };
      }, (span, data, index) => {
        span.style.display = "flex";
        span.style.flexDirection = "row";
        span.style.justifyContent = "space-between";
        const IF = data;
        const isProgress = getPref(`IFColumn.progress`);
        const isText = getPref(`IFColumn.text`);
        const progressType = getPref(`IFColumn.progressType`);
        if (isProgress && IF > 0) {
          const progressNode = lineProgress(IF, parseFloat(getPref(`IFColumn.max`)), this.isSelectedRow(index) ? "#fff" : getPref(`IFColumn.color`), getPref(`IFColumn.opacity`), progressType);
          if (isText) {
            progressNode.style.marginRight = "0.5em";
          }
          span.appendChild(progressNode);
          progressNode.style.width = "auto";
          progressNode.style.flexGrow = "1";
        }
        if (isText) {
          span.appendChild(ztoolkit.UI.createElement(document, "span", {
            styles: {
              display: "inline-block",
              // width: "2em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            },
            properties: {
              innerText: IF
            }
          }));
        }
        return span;
      });
      this.patchSetting(key, [{
        prefKey: "IFColumn.field",
        name: getString("ui-field"),
        values: ["sciif", "sciif5", "综合影响因子", "复合影响因子"],
        type: "select"
      }, {
        prefKey: "IFColumn.color",
        name: getString("ui-color"),
        type: "input"
      }, {
        prefKey: "IFColumn.opacity",
        name: getString("ui-column-opacity"),
        type: "range",
        range: [0, 1, 0.01]
      }, {
        prefKey: "IFColumn.max",
        name: getString("ui-column-max"),
        type: "input"
      }, {
        prefKey: "IFColumn.progress",
        name: getString("ui-column-progress"),
        type: "boolean"
      }, {
        prefKey: "IFColumn.text",
        name: getString("ui-column-text"),
        type: "boolean"
      }, {
          prefKey: "IFColumn.progressType",
          name: getString("ui-column-style"),
        values: ["1", "2"],
        type: "select"
      }]);
    }
    async status() {
      const key = "status";
      await this.registerColumn(key, item => {
        const tag = getColoredTags(item).find(tag2 => isStatusTagName(tag2.tag));
        if (tag) {
          return {
            sortIndex: tag.tag,
            data: tag
          };
        } else {
          return {
            sortIndex: "",
            data: {
              tag: false,
              color: ""
            }
          };
        }
      }, (span, data, index) => {
        span.style.display = "inline-flex";
        span.style.height = "100%";
        span.style.alignItems = "center";
        const tag = data;
        const createTagNode = (tag2, isSelected = false) => {
          const c = new ColorRNA_default(tag2.color);
          const [red, green, blue] = c.rgb();
          const hsl = c.HSL();
          hsl[2] = 35;
          const deepColor = c.HSL(hsl).getHex();
          const computedStyle = window.getComputedStyle(document.querySelector("#zotero-pane"));
          const zoteroFontSize = computedStyle?.getPropertyValue("--zotero-font-size") || "1em";
          const statusNode = ztoolkit.UI.createElement(document, "div", {
            namespace: "html",
            tag: "div",
            children: [{
              tag: "div",
              classList: ["inner"],
              children: [{
                tag: "div",
                classList: ["circle"],
                styles: {
                  display: "flex",
                  alignItems: "center"
                },
                children: [{
                  tag: "div",
                  styles: {
                    marginRight: "5px",
                    borderRadius: "99px",
                    height: `calc(${zoteroFontSize} * .6)`,
                    width: `calc(${zoteroFontSize} * .6)`,
                    backgroundColor: isSelected ? "#fff" : tag2.color,
                    display: "inline-flex",
                    flexShrink: "0"
                  }
                }]
              }, {
                tag: "span",
                styles: {
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                },
                properties: {
                  innerText: tag2.tag.slice(1)
                }
              }]
            }]
          });
          statusNode.setAttribute("style", `
            display: inline-flex;
            align-items: center;
            flex-shrink: 1;
            min-width: 0px;
            max-width: 100%;
            height: calc(${zoteroFontSize} * 1.4);
            font-size: calc(${zoteroFontSize} * 1);
            line-height: 120%;
            border-radius: calc(${zoteroFontSize} * 1);
            padding-left: 7px;
            padding-right: 9px;
            color: ${isSelected ? "#fff" : deepColor};
            background: ${isSelected ? "rgba(255,255,255,.2)" : `rgba(${red}, ${green}, ${blue}, .23)`};
            margin: 0px;
            border: ${isSelected ? "1px solid rgba(255,255,255,.4)" : ""};
            pointer-events: auto;
          `);
          statusNode.querySelector(".inner")?.setAttribute("style", `
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-flex;
            align-items: center;
            height: 20px;
            line-height: 20px;
          `);
          return statusNode;
        };
        if (tag.tag) {
          const statusNode = createTagNode(tag, this.isSelectedRow(index));
          span.appendChild(statusNode);
        } else {
          span.style.display = "inline-block";
          span.style.width = "100%";
          span.style.height = "100%";
          span.style.pointerEvents = "auto";
        }
        span.addEventListener("click", async () => {
          const rect = span.getBoundingClientRect();
          const rowNode = document.querySelector(`#item-tree-main-row-${index}`) || document.querySelector(`#item-tree-main-default-row-${index}`);
          const _rect = rowNode.getBoundingClientRect();
          rect.y = _rect.y;
          const libraryID = getFirstSelectedLibraryID() ?? Zotero.Libraries.userLibraryID;
          let coloredTags = [];
          const colors = await Zotero.Tags.getColors(libraryID);
          for (const tagName of colors.keys()) {
            const tag2 = { ...colors.get(tagName), tag: tagName };
            coloredTags.push(tag2);
          }
          coloredTags = coloredTags.filter(tag2 => isStatusTagName(tag2.tag));
          if (tag.tag) {
            coloredTags = [...[tag], ...coloredTags.filter(i => i.tag != tag.tag)];
          }
          const children = [];
          for (const _ of coloredTags) {
            children.push({
              tag: "menuitem"
            });
          }
          const menupopup = buildMenuPopup({
            x: rect.left + 5 + window.screenX,
            y: rect.top + window.screenY + 6
          }, children);
          const menuitems = [...menupopup.querySelectorAll("menuitem")];
          for (let i = 0; i < menuitems.length; i++) {
            const menuitem = menuitems[i];
            try {
              if (Zotero.isWin) {
                menuitem.innerHTML = "";
                menuitem.style.padding = "5px";
                const tagNode = createTagNode(coloredTags[i]);
                tagNode.style.margin = "0";
                menuitem.appendChild(tagNode);
                tagNode.style.cursor = "pointer";
                tagNode.addEventListener("click", () => {
                  tagNode.parentNode.click();
                  menupopup.remove();
                });
              } else {
                menuitem.setAttribute("label", coloredTags[i].tag.slice(1));
              }
            } catch {
              menuitem.remove();
            }
            menuitem.addEventListener("command", async () => {
              const item = ZoteroPane.getSortedItems()[index];
              item.getTags().forEach(tag2 => {
                if (isStatusTagName(tag2.tag)) {
                  item.removeTag(tag2.tag);
                }
              });
              item.addTag(coloredTags[i].tag);
              await item.saveTx();
            });
          }
          if (menuitems.length > 0) {
            ztoolkit.UI.appendElement({
              tag: "menuseparator"
            }, menupopup);
          }
          ztoolkit.UI.appendElement({
            tag: "menuitem",
            attributes: {
              label: getString("ui-new")
            },
            listeners: [{
              type: "command",
              listener: () => {
                const tag2 = window.prompt(getString("ui-enter-status-name"));
                const color = window.prompt(getString("ui-enter-status-color"), "#6196bc");
                const item = ZoteroPane.getSelectedItems()[0];
                if (tag2 && color && color?.startsWith("#")) {
                  const tagName = "/" + tag2.trim();
                  item.addTag(tagName);
                  Zotero.Tags.setColor(item.libraryID, tagName, color, 12);
                  item.saveTx();
                } else {
                  window.alert(getString("ui-invalid-status"));
                }
              }
            }]
          }, menupopup);
        });
        return span;
      });
    }
    async rating() {
      const key = "rating";
      await this.registerColumn(key, item => {
        const rating = this.resolveItemRating(item).value;
        return {
          sortIndex: rating,
          data: {
            rate: rating,
            id: item.id
          }
        };
      }, (span, data, index) => {
        const isInItemBox = index == -1;
        if (!isInItemBox) {
          if (!this.isSelectedRow(index) && data.rate == 0) {
            return span;
          }
        }
        const isShowUnSelected = this.isSelectedRow(index) || isInItemBox;
        span.style.pointerEvents = "auto";
        const selectedStar = getPref("ratingColumn.selectedStar") || "⭐";
        const unselectedStar = getPref("ratingColumn.unselectedStar") || "🌙";
        for (let i = 0; i < 5; i++) {
          ztoolkit.UI.appendElement({
            tag: "span",
            classList: ["star"],
            styles: {
              display: "inlin-block",
              padding: `0 ${getPref("ratingColumn.padding")}px`,
              pointerEvents: isShowUnSelected ? "auto" : "none"
            },
            properties: {
              innerHTML: i < data.rate ? selectedStar : isShowUnSelected ? unselectedStar : ""
            },
            listeners: [{
              type: "click",
              listener: async () => {
                const item = await Zotero.Items.getAsync(data.id);
                if (!item) {
                  return;
                }
                const tags = item.getTags();
                const update = buildRatingStorageUpdate({
                  currentValue: data.rate,
                  selectedValue: i + 1,
                  storage: getPref("ratingColumn.storage"),
                  tags,
                  coloredTagNames: this.getColoredLegacyRatingTagNames(item, tags)
                });
                await ztoolkit.ExtraField.setExtraField(item, "rate", update.extraValue, {
                  save: false
                });
                update.legacyTagNamesToRemove.forEach(tagName => item.removeTag(tagName));
                if (update.legacyTagNameToAdd) {
                  item.addTag(update.legacyTagNameToAdd);
                }
                await item.saveTx();
              }
            }, {
              type: "mouseenter",
              listener: () => {
                const stars = span.querySelectorAll(".star");
                stars.forEach((s, index2) => {
                  s.innerHTML = index2 <= i ? selectedStar : unselectedStar;
                });
              }
            }, {
              type: "mouseleave",
              listener: () => {
                const stars = span.querySelectorAll(".star");
                stars.forEach((s, index2) => {
                  s.innerHTML = index2 < data.rate ? selectedStar : unselectedStar;
                });
              }
            }]
          }, span);
        }
        return span;
      });
      this.patchItemBox(key, getString("column-" + key), "itemType", "before");
      this.patchSetting(key, [{
        prefKey: `ratingColumn.selectedStar`,
        name: getString("ui-column-selected-star"),
        type: "input"
      }, {
        prefKey: `ratingColumn.unselectedStar`,
        name: getString("ui-column-unselected-star"),
        type: "input"
      }, {
        prefKey: `ratingColumn.padding`,
        name: getString("ui-column-padding"),
        type: "range",
        range: [0, 10, 0.1]
      }], 280);
    }
    async remark() {
      const key = "remark";
      await this.registerColumn(key, item => {
        let s = item && ztoolkit.ExtraField.getExtraField(item, "remark") || "";
        if (!s && item && item.isRegularItem()) {
          const noteItem = item.getNotes().map(id => Zotero.Items.get(id)).find(noteItem2 => noteItem2.getTags().find(i => i.tag == "remark"));
          if (noteItem) {
            s = noteItem.getNote().match(/<p>(.+?)<\/p>/)?.[1] || "";
          }
        }
        return {
          sortIndex: s,
          data: {
            text: s,
            id: item.id
          }
        };
      }, (span, data, index) => {
        span.style.pointerEvents = "auto";
        span.style.width = "100%";
        if (data.text == "") {
          span.style.height = "27px";
        }
        ztoolkit.UI.appendElement({
          tag: "span",
          classList: ["remark-span"],
          properties: {
            innerHTML: escapeExceptAllowedTags(data.text)
          },
          attributes: {
            title: data.text
          }
        }, span);
        const editableText = document.createXULElement("editable-text") as EditableText;
        editableText.setAttribute("fieldname", "extra");
        editableText.setAttribute("flex", "1");
        editableText.setAttribute("tight", Zotero.Prefs.get("extensions.zotero.uiDensity", true) ? "true" : "false");
        editableText.className = "remark-text";
        editableText.value = data.text;
        const params = {
          fieldName: "extra",
          libraryID: Zotero.Libraries.userLibraryID
        };
        const allValues = [];
        const id = "remark-autocomplete";
        editableText.addEventListener("input", async () => {
          ztoolkit.log(1);
          if (allValues.length == 0) {
            const s = new Zotero.Search();
            s.addCondition("extra", "contains", "remark:");
            const ids = await s.search();
            for (const id2 of ids) {
              const i = Zotero.Items.get(id2);
              if (!i) {
                continue;
              }
              const text = i.getField("extra").split("\n").find(i2 => i2.startsWith("remark:"));
              let value = text?.slice(8);
              if (value?.trim()) {
                value = text?.slice(8) || "";
                if (allValues.indexOf(value) == -1) {
                  allValues.push(value);
                }
              }
            }
          }
          let matchedValues = [];
          if (editableText.value.trim()) {
            matchedValues = allValues.filter(i => i?.toLowerCase().indexOf(editableText.value.toLowerCase()) >= 0);
          }
          ztoolkit.log(matchedValues);
          let container = document.querySelector("#" + id);
          if (matchedValues.length > 0) {
            if (!container) {
              const rect = editableText.getBoundingClientRect();
              container = ztoolkit.UI.appendElement({
                tag: "div",
                id,
                classList: ["style-autocomplete"],
                styles: {
                  display: "flex",
                  flexDirection: "column",
                  position: "fixed",
                  left: rect.left + "px",
                  top: rect.top + rect.height + "px",
                  width: rect.width + "px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  backgroundColor: "var(--material-background)",
                  border: "1px solid var(--material-mix-quarternary)",
                  borderRadius: "3px",
                  boxShadow: "-1px 10px 17px -7px rgba(0,0,0,0.4)"
                }
              }, document.documentElement);
            }
            container.querySelectorAll(".item").forEach(i => i.remove());
            for (const value of matchedValues) {
              ztoolkit.UI.appendElement({
                tag: "span",
                classList: ["item"],
                attributes: {
                  title: value
                },
                styles: {
                  padding: "3px"
                },
                properties: {
                  innerText: value
                },
                listeners: [{
                  type: "click",
                  listener: () => {
                    editableText.value = value;
                    container.remove();
                  }
                }]
              }, container);
            }
          } else {
            container?.remove();
          }
        });
        editableText.addEventListener("blur", () => {
          document.querySelector("#" + id)?.remove();
        });
        editableText.addEventListener("change", async () => {
          const item = Zotero.Items.get(data.id);
          if (!item) {
            return;
          }
          let text = item.getField("extra");
          if (text.indexOf("remark") >= 0) {
            text = text.split("\n").filter(s => !s.startsWith("remark")).join("\n");
          }
          item.setField("extra", `remark: ${editableText.value.replace(/^remark:\s*/, "")}
${text}`);
          await item.saveTx();
        });
        span.appendChild(editableText);
        return span;
      });
      this.patchItemBox(key, getString("column-" + key), "itemType", "before");
    }
    async creator() {
      if (!getPref(`function.creatorColumn.enable`)) {
        return;
      }
      const key = "firstCreator";
      this.addRenderCellPatch({
        key,
        renderCell: (cellSpan, index) => {
          try {
            const item = ZoteroPane.getSortedItems()[index];
            if (!item || !item.isRegularItem()) {
              return cellSpan;
            }
            const creators = item.getCreators();
            const firstCreator = item.firstCreator;
            const format = getPref(`creatorColumn.format`);
            const join = getPref(`creatorColumn.join`);
            const slices = getPref(`creatorColumn.slices`);
            let newCreators = [];
            try {
              slices.split(/,\s*/).forEach(slice => {
                newCreators = newCreators.concat(slice.indexOf(":") >= 0 ? creators.slice(...slice.split(":").filter(i => i.trim().length).map(i => Number(i))) : [creators.slice(Number(slice))[0]]);
              });
            } catch {
              return cellSpan;
            }
            const textArray = [];
            for (let i = 0; i < newCreators.length; i++) {
              textArray.push(format.replace(/\$\{firstName\}/g, newCreators?.[i]?.firstName || "").replace(/\$\{lastName\}/g, newCreators?.[i]?.lastName || "").replace(/\$\{firstCreator\}/g, firstCreator));
            }
            if (cellSpan.querySelector(".cell-text")) {
              cellSpan.querySelector(".cell-text").innerText = textArray.join(join);
            } else {
              cellSpan.innerText = textArray.join(join);
            }
            return cellSpan;
          } catch (e) {
            ztoolkit.log("error creator", e);
            return cellSpan;
          }
        }
      });
      this.patchSetting(key, [{
        prefKey: "creatorColumn.format",
        name: getString("ui-column-format"),
        type: "input"
      }, {
        prefKey: "creatorColumn.slices",
        name: getString("ui-column-slices"),
        type: "input"
      }, {
        prefKey: "creatorColumn.join",
        name: getString("ui-column-join"),
        type: "input"
      }]);
    }
    async publication() {
      const key = "publicationTitle";
      this.addRenderCellPatch({
        key,
        renderCell: (cellSpan, index) => {
          try {
            const item = ZoteroPane.getSortedItems()[index];
            cellSpan.innerText = getPublicationTitle(item);
          } catch (error) {
            ztoolkit.log("Failed to render publication title", error);
          }
          return cellSpan;
        }
      });
      this.patchSetting(key, [{
        prefKey: "publicationColumn.fields",
        name: getString("ui-column-fields"),
        type: "input"
      }]);
    }
    async annotation() {
      if (!getPref(`function.annotationColumn.enable`)) {
        return;
      }
      const key = "annotation";
      await this.registerColumn(key, item => {
        const pageNum = this.getCachedPageNum(item.id);
        if (pageNum) {
          if (pageNum == 0) {
            return {
              sortIndex: 0,
              data: false
            };
          } else {
            return {
              sortIndex: pageNum,
              data: {
                pageNum,
                id: item.id
              }
            };
          }
        } else {
          this.scheduleTimeout(async () => {
            if (!item || !item.isRegularItem()) {
              return;
            }
            const pdfItem = await item.getBestAttachment();
            if (!pdfItem) {
              this.setCachedPageNum(item.id, 0);
              return;
            }
            const pages = await Zotero.FullText.getPages(pdfItem.id);
            const pageNum2 = pages ? pages.total : 0;
            this.setCachedPageNum(item.id, pageNum2);
            if (!pageNum2 && pdfItem.getAnnotations().length > 0) {
              await Zotero.Fulltext.indexItems([pdfItem.id]);
            }
          }, 3000);
          return {
            sortIndex: 0,
            data: false
          };
        }
      }, (span, data, index) => {
        span.style.display = "inline-block";
        span.style.width = "100%";
        span.style.height = "70%";
        const annoSpan = ztoolkit.UI.appendElement({
          tag: "span",
          styles: {
            display: "flex",
            flexDirection: "row",
            height: "100%",
            width: "100%",
            justifyContent: "space-around",
            opacity: getPref(`${key}Column.opacity`)
          }
        }, span);
        const pageNum = data.pageNum;
        const item = Zotero.Items.get(data.id);
        this.scheduleTimeout(async () => {
          if (!item || !item.isRegularItem()) {
            return;
          }
          const pdfItem = await item.getBestAttachment();
          if (!pdfItem) return;
          const annoArr = pdfItem.getAnnotations().sort((a, b) => String(a.annotationSortIndex).localeCompare(String(b.annotationSortIndex)));
          for (let pageIndex = 0; pageIndex < pageNum; pageIndex++) {
            const getPos = anno2 => JSON.parse(anno2._annotationPosition);
            const getArea = anno2 => {
              try {
                const rects = getPos(anno2).rects;
                let s = 0;
                for (const rect of rects) {
                  s += (rect[2] - rect[0]) * (rect[3] - rect[1]);
                }
                return s;
              } catch {
                return 1;
              }
            };
            const anno = annoArr.filter(anno2 => getPos(anno2).pageIndex == pageIndex).sort((a, b) => getArea(b) - getArea(a))?.[0];
            ztoolkit.UI.appendElement({
              tag: "span",
              styles: {
                display: "inline-block",
                height: "100%",
                width: `${1 / pageNum * 100}%`,
                backgroundColor: anno?.annotationColor || "transparent"
              }
            }, annoSpan);
          }
        });
        return span;
      });
      this.patchSetting(key, [{
        prefKey: `${key}Column.opacity`,
        name: getString("ui-column-opacity"),
        type: "range",
        range: [0, 1, 0.01]
      }]);
    }
    /**
     * 右键一列弹出列设置窗口
     * @param colKey
     * @param args
     */
    patchSetting(colKey, args, width = 253, afterOpen?) {
      const _colKey = colKey;
      colKey = `stylepersonal-${colKey}`;
      let head;
      let active = true;
      let menuitem;
      const dialogCleanups = new Set<() => void>();
      const captureColumn = event => {
        head = event.target?.parentNode;
      };
      document.addEventListener("mousedown", captureColumn);
      const buildColumnSettings = () => {
        if (!active || !this.active || !head) {
          return;
        }
        if (!head.classList.contains(_colKey) && !head.classList.contains(colKey)) {
          return;
        }
        const menupopup = [...document.querySelectorAll("#zotero-column-picker")].slice(-1)[0];
        if (!menupopup) {
          return;
        }
        this.scheduleTimeout(async () => {
          if (!active) {
            return;
          }
          const ns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
          menuitem = document.createElementNS(ns, "menuitem");
          menuitem.setAttribute("label", getString("column-setting") + " (" + head.textContent + ")");
          menupopup.appendChild(menuitem);
          menuitem.addEventListener("command", async () => {
            if (!active || !this.active) {
              return;
            }
            let disposePickers = () => {};
            const dialogData: { loadCallback: () => void; unloadCallback: () => void; } & { _lastButtonId?: string; unloadLock?: { promise: Promise<void> } } = {
              loadCallback: () => {
                if (!active || !this.active) {
                  return;
                }
                const dialogStyle = dialog.window.document.createElement("style");
                dialogStyle.textContent = "html, body, body > vbox { background: var(--material-mix-quinary) !important; } body { margin: 0 !important; padding: 8px !important; }";
                dialog.window.document.head.append(dialogStyle);
                const cleanups = [];
                disposePickers = () => {
                  for (const cleanup of cleanups.splice(0).reverse()) {
                    cleanup();
                  }
                  dialogCleanups.delete(disposePickers);
                };
                dialogCleanups.add(disposePickers);
                for (const arg of args) {
                  if (!arg.fieldPicker) {
                    continue;
                  }
                  const input = dialog.window.document.querySelector(`[data-bind="${arg.prefKey}"]`);
                  if (input) {
                    cleanups.push(mountColumnFieldPicker(input, arg.fieldPicker));
                  }
                }
              },
              unloadCallback: () => {
                disposePickers();
                if (dialogData._lastButtonId == "set") {
                  for (const arg of args) {
                    setPref(`${arg.prefKey}`, dialogData[arg.prefKey]);
                  }
                  requireItemsView().refreshAndMaintainSelection();
                }
              }
            };
            for (const arg of args) {
              dialogData[arg.prefKey] = getPref(`${arg.prefKey}`);
            }
            const dialog = new ztoolkit.Dialog(args.length, 3).setDialogData(dialogData).addButton(getString("ui-apply"), "set").addButton(getString("ui-cancel"), "cancel");
            for (let i = 0; i < args.length; i++) {
              const arg = args[i];
              dialog.addCell(i, 0, {
                tag: "label",
                styles: {
                  textAlign: "right"
                },
                properties: {
                  innerText: arg.name
                }
              }, false);
              switch (arg.type) {
                case "boolean":
                  dialog.addCell(i, 1, {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      "data-bind": arg.prefKey,
                      "data-prop": "checked",
                      type: "checkbox"
                    }
                  });
                  break;
                case "select":
                  dialog.addCell(i, 1, {
                    tag: "select",
                    // namespace: "html",
                    styles: {
                      display: "inline-block",
                      width: "100%",
                      backgroundColor: "var(--material-background)"
                    },
                    attributes: {
                      flex: "1",
                      "data-bind": arg.prefKey,
                      "data-prop": "value"
                    },
                    children: arg.values.map(v => {
                      return {
                        tag: "option",
                        properties: {
                          value: v,
                          innerText: getPreferenceOptionLabel(v),
                          textContent: getPreferenceOptionLabel(v)
                        }
                      };
                    })
                  });
                  break;
                case "range":
                  dialog.addCell(i, 1, {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      "data-bind": arg.prefKey,
                      "data-prop": "value",
                      type: "range",
                      min: arg.range[0],
                      max: arg.range[1],
                      step: arg.range[2]
                    }
                  });
                  break;
                default:
                  dialog.addCell(i, 1, {
                    tag: "input",
                    namespace: "html",
                    attributes: {
                      "data-bind": arg.prefKey,
                      "data-prop": "value",
                      type: arg.type == "password" ? "password" : "text"
                    }
                  });
                  break;
              }
              dialog.addCell(i, 2, {
                tag: "button",
                styles: {
                  textAlign: "right",
                  backgroundImage: `url("chrome://${config.addonRef}/content/icons/undo.svg")`,
                  cursor: "pointer",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "14px",
                  fill: "currentColor",
                  appearance: "none",
                  borderRadius: "4px",
                  fontWeight: "400",
                  padding: "13px",
                  textDecoration: "none",
                  margin: "4px 8px",
                  fontSize: "1em",
                  backgroundColor: "var(--material-mix-quarternary)",
                  height: "18px",
                  width: "18px",
                  border: "1px solid rgba(0,0,0,0)",
                  opacity: ".7"
                },
                listeners: [{
                  type: "click",
                  listener: () => {
                    clearPref(`${arg.prefKey}`);
                    const value = getPref(`${arg.prefKey}`);
                    const inputNode = dialog.window.document.querySelector(`[data-bind="${arg.prefKey}"]`);
                    ztoolkit.log(inputNode, value);
                    inputNode[inputNode.getAttribute("data-prop")] = value;
                    inputNode.dispatchEvent(new dialog.window.Event("change", {
                      bubbles: true
                    }));
                  }
                }]
              }, false);
            }
            dialog.open(getString("column-setting") + " (" + head.textContent + ")", {
              width,
              height: args.length * 36 + 60 + (args.some(arg => arg.fieldPicker) ? 72 : 0),
              centerscreen: true,
              resizable: true
            });
            adjustDialogLayout(dialog);
            if (afterOpen) {
              this.scheduleTimeout(() => {
                const cleanup = afterOpen(dialog);
                if (typeof cleanup === "function") {
                  this.trackCleanup(cleanup);
                }
              }, 80);
            }
          });
        }, 1);
      };
      addon.data.patch._displayColumnPickerMenu.data.push(buildColumnSettings);
      return this.trackCleanup(() => {
        active = false;
        for (const cleanup of dialogCleanups) {
          cleanup();
        }
        document.removeEventListener("mousedown", captureColumn);
        menuitem?.remove();
        const callbacks = addon.data.patch._displayColumnPickerMenu.data;
        const index = callbacks.indexOf(buildColumnSettings);
        if (index >= 0) {
          callbacks.splice(index, 1);
        }
      });
    }
    /**
     * 渲染到信息面板
     * @param key
     * @param id
     */
    async patchItemBox(key, label, targetKey, targetPosition = "after") {
      const itemBoxPatches = new ItemBoxPatchRegistry(error => ztoolkit.log("Failed to clean up item-box patch", key, error));
      let active = true;
      function renderCellToItemBox(item, targetNode) {
        if (!active || !item || !targetNode || !addon.api.renderCell) {
          return;
        }
        const span = addon.api.renderCell(item, key);
        if (span.children?.length == 0 && span.innerText.length == 0) {
          return;
        }
        const rowSpan = ztoolkit.UI.insertElementBefore({
          namespace: "html",
          tag: "div",
          classList: ["meta-row"],
          styles: {
            alignItems: "center"
          },
          children: [{
            tag: "div",
            classList: ["meta-label"],
            styles: {
              paddingBottom: "3px"
            },
            attributes: {
              fieldname: key
            },
            children: [{
              tag: "label",
              classList: ["key"],
              properties: {
                innerText: label
              }
            }]
          }, {
            tag: "div",
            classList: ["meta-data"]
          }]
        }, targetPosition == "after" ? targetNode.nextElementSibling : targetNode);
        span.style.flexWrap = "wrap";
        rowSpan.querySelector(".meta-data")?.appendChild(span);
      }
      const registerItemBox = async (selectors, getItem) => {
        if (!active || !this.active || !addon.data.alive) {
          return;
        }
        itemBoxPatches.pruneDisconnected();
        const itemBox = document.querySelector(selectors);
        if (!itemBox) {
          return;
        }
        const callback = () => {
          if (!active || !this.active || !addon.data.alive) {
            return;
          }
          let div;
          if (Array.isArray(targetKey)) {
            div = targetKey.map(k => itemBox.querySelector(`.meta-row div[fieldname=${k}]`)).find(Boolean);
          } else {
            div = itemBox.querySelector(`.meta-row div[fieldname='${targetKey}']`);
          }
          if (div && !itemBox.querySelector(`.meta-row div[fieldname='${key}']`)) {
            renderCellToItemBox(getItem(), div.parentNode);
          }
        };
        if (!itemBoxPatches.has(itemBox)) {
          const originalRender = itemBox.render;
          const patchedRender = function (...args) {
            try {
              const result = originalRender.apply(this, args);
              callback();
              return result;
            } catch (error) {
              ztoolkit.log("Failed to render item-box field", key, error);
              throw error;
            }
          };
          const restoreRender = replaceOwnedProperty(itemBox, "render", patchedRender);
          itemBox[config.addonRef + key] = patchedRender;
          itemBoxPatches.add(itemBox, () => {
            restoreRender();
            if (itemBox[config.addonRef + key] === patchedRender) {
              delete itemBox[config.addonRef + key];
            }
            itemBox.querySelectorAll(`.meta-row div[fieldname='${key}']`).forEach(node => node.closest(".meta-row")?.remove());
          });
        }
        callback();
      };
      registerItemBox("info-box#zotero-editpane-info-box", () => ZoteroPane.getSelectedItems()[0]);
      const unregisterNotify = registerNotify(["tab"], async (event, type, ids, extraData) => {
        itemBoxPatches.pruneDisconnected();
        if (!active || !this.active || type != "tab") {
          return;
        }
        const isReaderEvent = extraData[ids?.[0]]?.type == "reader";
        if (event == "close" || isReaderEvent) {
          this.scheduleTimeout(() => {
            if (!active) {
              return;
            }
            itemBoxPatches.pruneDisconnected();
            if (!isReaderEvent) {
              return;
            }
            const item = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)?._item?.topLevelItem;
            return registerItemBox(`item-details#${Zotero_Tabs.selectedID}-context info-box`, () => item);
          }, 1000);
        }
      });
      return this.trackCleanup(() => {
        active = false;
        unregisterNotify();
        itemBoxPatches.clear();
        document.querySelectorAll(`.meta-row div[fieldname='${key}']`).forEach(node => node.closest(".meta-row")?.remove());
        if (key === "remark") {
          document.querySelector("#remark-autocomplete")?.remove();
        }
      });
    }
  };
  export async function registerColumnResizeFix(shouldContinue = () => true) {
    const itemsView = requireItemsView();
    while (shouldContinue() && addon.data.alive && !itemsView.tree) {
      await Zotero.Promise.delay(1000);
    }
    if (!shouldContinue() || !addon.data.alive || !itemsView.tree) {
      return;
    }
    const tree = itemsView.tree;
    const styleIDs = new Set<string>();
    const onResize = function (columnWidths, storePrefs = false) {
      const prefs = storePrefs ? this._getPrefs() : undefined;
      for (const [rawDataKey, requestedWidth] of Object.entries(columnWidths)) {
        const columnIndex = Number(rawDataKey);
        const dataKey = Number.isInteger(columnIndex) && this._columns[columnIndex] ? this._columns[columnIndex].dataKey : rawDataKey;
        const column = this._columns.find(candidate => candidate.dataKey === dataKey);
        if (!column) {
          continue;
        }
        const styleIndex = this._columnStyleMap[window.CSS.escape(dataKey)];
        const style2 = this._stylesheet.sheet.cssRules[styleIndex]?.style;
        if (!style2) {
          continue;
        }
        const columnPadding = column.iconLabel ? 0 : 16;
        let width = column.fixedWidth ? column.width : requestedWidth;
        if (storePrefs && !column.fixedWidth) {
          column.width = requestedWidth;
          prefs[dataKey] = this._getColumnPrefsToPersist(column);
        }
        const fixedWidth = column.fixedWidth && column.width || column.staticWidth;
        if (fixedWidth) {
          style2.setProperty("flex", "0 0", "important");
          style2.setProperty("max-width", `${width}px`, "important");
          style2.setProperty("min-width", `${width}px`, "important");
        } else {
          width -= columnPadding;
          style2.setProperty("flex-basis", `${width}px`);
        }
        const styleID = `${config.addonRef}-column-width-${dataKey}`;
        ztoolkit.UI.appendElement({
          id: styleID,
          namespace: "html",
          properties: {
            innerHTML: fixedWidth ? `
                .${dataKey}-item-tree-main-default {
                  flex: 0 0 !important;
                  max-width: ${width}px !important;
                  min-width: ${width}px !important;
                }
              ` : `
                .${dataKey}-item-tree-main-default {
                  flex-basis: ${width}px !important;
                }
              `
          },
          removeIfExists: true,
          tag: "style"
        }, document.documentElement);
        styleIDs.add(styleID);
      }
      if (storePrefs && prefs) {
        this._storePrefs(prefs);
      }
    };
    const restore = replaceOwnedProperty(tree._columns, "onResize", onResize);
    return () => {
      restore();
      for (const styleID of styleIDs) {
        document.getElementById(styleID)?.remove();
      }
      styleIDs.clear();
    };
  }
  export function describeTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m`;
    }
    if (seconds < 86400) {
      const hours2 = Math.floor(seconds / 3600);
      const minutes = Math.floor(seconds % 3600 / 60);
      return `${hours2}h ${minutes > 0 ? ` ${minutes}m` : ""}`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    return `${days}d ${hours > 0 ? ` ${hours}h` : ""}`;
  }
