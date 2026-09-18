import { config } from "../../config.ts";
import { isItemsViewTreeReady,requireItemsView,resetItemsViewColumns,waitForItemsViewTree } from "../../utils/zoteroPane.ts";
import { adjustDialogLayout,listenShortcut,registerShortcut } from "../../utils/base.ts";
import { buildViewGroupPrefs,parseViewGroups,resolveViewGroupDataKeys,selectViewGroupPrefs } from "./viewGroupLogic.ts";
import { appendOwnedEntry,replaceOwnedProperty } from "../../utils/ownedResource.ts";
import { getString } from "../../utils/locale.ts";
import { getElements } from "../../utils/dom.ts";
  // src/features/item-tree/viewManager.ts
  export class ViewManager {
    declare active: boolean;
    declare cleanups: Array<() => void | Promise<void>>;
    declare timers: Set<number>;
    declare prefKey: string;
    declare opacityTimer: number;
    declare switchContainer: any;
    declare spacer: any;

    constructor() {
      this.active = true;
      this.cleanups = [];
      this.timers = /* @__PURE__ */new Set();
      this.prefKey = `${config.addonRef}.viewGroups`;
      this.init().catch(error => {
        if (this.active) {
          ztoolkit.log("Failed to initialize view manager", error);
        }
      });
    }
    async init() {
      if (!(await waitForItemsViewTree(() => ZoteroPane.itemsView, () => this.active, () => Zotero.Promise.delay(100)))) {
        return;
      }
      if (!this.active) {
        return;
      }
      this.buildToolbarUI();
      this.buildRightMenu();
      this.registerShortcuts();
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
      this.opacityTimer = undefined;
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch (error) {
          ztoolkit.log("Failed to clean up view manager", error);
        }
      }
      this.switchContainer?.remove();
      if (this.spacer?.parentNode) {
        this.spacer.parentNode.removeChild(this.spacer);
      }
    }
    registerShortcuts() {
      const columnsViews = this.getViewGroups();
      for (const columnsView of columnsViews) {
        if (columnsView.shortcut) {
          this.cleanups.push(registerShortcut(columnsView.shortcut, () => {
            this.switchViewGroup(columnsView);
          }, "key"));
        }
      }
    }
    getViewGroups() {
      try {
        const value = JSON.parse(String(Zotero.Prefs.get(this.prefKey) || "[]"));
        return parseViewGroups(value);
      } catch (error) {
        ztoolkit.log("Failed to parse saved Style view groups", error);
        return [];
      }
    }
    getColumnModel() {
      const itemsView = requireItemsView();
      const tree = itemsView.tree;
      const columnModel = tree?._columns;
      if (!columnModel) {
        throw new Error("Zotero item-tree columns are not initialized.");
      }
      const columnsFromMethod = typeof columnModel.getAsArray === "function" ? columnModel.getAsArray() : undefined;
      const columns = (Array.isArray(columnsFromMethod) ? columnsFromMethod : columnModel._columns) ?? [];
      const getPrefs = typeof itemsView._getColumnPrefs === "function" ? () => itemsView._getColumnPrefs() : typeof columnModel._getPrefs === "function" ? () => columnModel._getPrefs() : () => ({});
      const storePrefs = typeof itemsView._storeColumnPrefs === "function" ? prefs => itemsView._storeColumnPrefs(prefs) : typeof columnModel._storePrefs === "function" ? prefs => columnModel._storePrefs(prefs) : () => {
        throw new Error("Zotero item-tree column storage is unavailable.");
      };
      return {
        columns,
        getPrefs,
        storePrefs,
        resize: typeof columnModel.onResize === "function" ? (widths, storePrefs2 = false) => columnModel.onResize(widths, storePrefs2) : undefined
      };
    }
    async switchViewGroup(viewGroup) {
      if (!this.active || !isItemsViewTreeReady(ZoteroPane.itemsView)) {
        return;
      }
      try {
        ztoolkit.log("switch to", viewGroup.dataKeys);
        const itemsView = requireItemsView();
        const model = this.getColumnModel();
        const prefs = buildViewGroupPrefs(viewGroup, model.columns, model.getPrefs());
        for (const column of model.columns) {
          const setting = prefs[column.dataKey];
          if (!setting) {
            continue;
          }
          column.hidden = Boolean(setting.hidden);
          if (typeof setting.ordinal === "number") {
            column.ordinal = setting.ordinal;
          }
          if (setting.width !== undefined) {
            column.width = setting.width;
          }
        }
        const widths = Object.fromEntries(model.columns.filter(column => !column.hidden && typeof column.width === "number" && Number.isFinite(column.width)).map(column => [column.dataKey, column.width]));
        model.resize?.(widths, false);
        model.storePrefs(prefs);
        const isCurrent = () => this.active && ZoteroPane.itemsView === itemsView;
        if (!(await resetItemsViewColumns(itemsView, isCurrent)) || !isCurrent()) {
          return;
        }
        await itemsView.refreshAndMaintainSelection?.();
      } catch (error) {
        ztoolkit.log("Failed to switch Style view group", error);
      }
    }
    getCurrentDataKeys() {
      const dataKeys = this.getColumnModel().columns.filter(i => !i.hidden).map(i => i.dataKey);
      return dataKeys;
    }
    isCurrent(viewGroup) {
      const allKeys = this.getColumnModel().columns.map(column => column.dataKey);
      return this.isSame(this.getCurrentDataKeys(), resolveViewGroupDataKeys(viewGroup.dataKeys, allKeys));
    }
    isSame(a, b) {
      return JSON.stringify(a) == JSON.stringify(b);
    }
    updateToolbarUI(timeout, currentIndex = -1) {
      if (!this.active || !this.switchContainer) {
        return;
      }
      if (this.opacityTimer !== undefined) {
        window.clearTimeout(this.opacityTimer);
        this.timers.delete(this.opacityTimer);
        this.opacityTimer = undefined;
      }
      const switchContainer = this.switchContainer;
      const viewGroups = this.getViewGroups();
      if (currentIndex != -1 && switchContainer.querySelector("span")) {
        switchContainer.querySelectorAll("span")[currentIndex].click();
      } else {
        switchContainer.querySelectorAll("span").forEach(e => e.remove());
        for (let i = 0; i < viewGroups.length; i++) {
          const viewGroup = viewGroups[i];
          const r = 0.7;
          const color = {
            active: "#FF597B",
            default: "#F9B5D0"
          };
          const optionNode = ztoolkit.UI.createElement(document, "span", {
            styles: {
              display: "inline-block",
              borderRadius: "1em",
              width: `${r}em`,
              height: `${r}em`,
              backgroundColor: currentIndex == i || currentIndex == -1 && this.isCurrent(viewGroup) ? color.active : color.default,
              transition: "background-color .23s linear",
              opacity: "0.7",
              cursor: "pointer",
              margin: " 0 .3em"
            },
            properties: {
              title: [viewGroup.name, viewGroup.content, viewGroup.shortcut].filter(Boolean).join("\n")
            },
            listeners: [{
              type: "click",
              listener: () => {
                this.switchViewGroup(viewGroup);
                optionNode.parentNode?.childNodes.forEach(e => e.style.backgroundColor = color.default);
                optionNode.style.backgroundColor = color.active;
              }
            }]
          });
          switchContainer.appendChild(optionNode);
        }
      }
      switchContainer.style.opacity = "1";
      if (timeout > 0) {
        this.opacityTimer = this.schedule(() => {
          switchContainer.style.opacity = "0";
        }, timeout);
      }
    }
    buildToolbarUI() {
      const toolbar = document.querySelector("#zotero-items-toolbar");
      const handleMouseEnter = () => {
        if (!this.active || !addon?.data?.alive) {
          return;
        }
        this.updateToolbarUI(-1);
      };
      const handleMouseLeave = () => {
        if (!this.active || !addon?.data?.alive) {
          return;
        }
        switchContainer.style.opacity = "0";
      };
      const switchContainer = this.switchContainer = toolbar.insertBefore(ztoolkit.UI.createElement(document, "div", {
        styles: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          opacity: "0",
          transition: "opacity .23s linear"
        }
      }), toolbar.querySelector("#zotero-tb-search-spinner"));
      this.cleanups.push(replaceOwnedProperty(toolbar, "onmouseenter", handleMouseEnter), replaceOwnedProperty(toolbar, "onmouseleave", handleMouseLeave));
      this.spacer = toolbar.insertBefore(ztoolkit.UI.createElement(document, "spacer", {
        namespace: "xul",
        attributes: {
          flex: "1"
        }
      }), toolbar.querySelector("#zotero-tb-search-spinner"));
    }
    buildRightMenu() {
      const buildMenu = () => {
        this.schedule(() => {
          const sort = columnsViews2 => {
            return columnsViews2.sort((a, b) => Number(a.position) - Number(b.position));
          };
          const addUpdateView = (columnsView, updating = false) => {
            const dialogData: { name: any; position: any; content: any; shortcut: any; recordCurrentView: boolean; loadCallback: () => void; unloadCallback: () => void; } & { _lastButtonId?: string; unloadLock?: { promise: Promise<void> } } = {
              name: columnsView.name || "",
              position: columnsView.position || "",
              content: columnsView.content || "",
              shortcut: columnsView.shortcut || "",
              recordCurrentView: !updating || this.isCurrent(columnsView),
              loadCallback: () => {
                listenShortcut(dialog.window.document.querySelector("#shortcut-input"), () => {});
              },
              unloadCallback: () => {
                if (dialogData._lastButtonId == "addUpdate") {
                  const name = dialogData.name;
                  const position = dialogData.position;
                  const content = dialogData.content;
                  const shortcut = dialogData.shortcut;
                  const dataKeys = dialogData.recordCurrentView ? this.getCurrentDataKeys() : columnsView.dataKeys;
                  const prefs = selectViewGroupPrefs(this.getColumnModel().getPrefs(), dataKeys, columnsView.prefs, updating, Boolean(dialogData.recordCurrentView));
                  if (name) {
                    columnsViews.push({
                      name,
                      position,
                      content,
                      dataKeys,
                      prefs,
                      shortcut
                    });
                    columnsViews = sort(columnsViews);
                    Zotero.Prefs.set(this.prefKey, JSON.stringify(columnsViews));
                    this.updateToolbarUI(1000);
                  }
                }
              }
            };
            const dialog = new ztoolkit.Dialog(5, 2).setDialogData(dialogData).addButton(getString(updating ? "ui-update" : "ui-add"), "addUpdate").addButton(getString("ui-cancel"), "cancel").addCell(0, 0, {
              tag: "label",
              properties: {
                innerText: getString("ui-name")
              },
              styles: {
                width: "4em",
                textAlign: "right"
              }
            }, false).addCell(0, 1, {
              tag: "input",
              attributes: {
                "data-bind": "name",
                "data-prop": "value",
                type: "text"
              }
            }).addCell(1, 0, {
              tag: "label",
              properties: {
                innerText: getString("ui-position")
              },
              styles: {
                width: "4em",
                textAlign: "right"
              }
            }, false).addCell(1, 1, {
              tag: "input",
              attributes: {
                "data-bind": "position",
                "data-prop": "value",
                type: "text"
              }
            }).addCell(2, 0, {
              tag: "label",
              properties: {
                innerText: getString("ui-content")
              },
              styles: {
                width: "4em",
                textAlign: "right"
              }
            }, false).addCell(2, 1, {
              tag: "input",
              attributes: {
                "data-bind": "content",
                "data-prop": "value",
                type: "text"
              }
            }).addCell(3, 0, {
              tag: "label",
              properties: {
                innerText: getString("ui-shortcut")
              },
              styles: {
                width: "4em",
                textAlign: "right"
              }
            }, false).addCell(3, 1, {
              tag: "input",
              id: "shortcut-input",
              attributes: {
                "data-bind": "shortcut",
                "data-prop": "value",
                type: "text"
              }
            }).addCell(4, 1, {
              tag: "input",
              namespace: "html",
              id: "record-current-view",
              attributes: {
                "data-bind": "recordCurrentView",
                "data-prop": "checked",
                type: "checkbox",
                ...(!updating ? {
                  disabled: "true"
                } : {})
              }
            }).addCell(4, 0, {
              tag: "label",
              properties: {
                innerText: getString("ui-current")
              }
            }, false).open(getString(updating ? "ui-edit-view" : "column-view-add"), {
              width: 300,
              height: 240,
              centerscreen: true,
              resizable: true
            });
            adjustDialogLayout(dialog);
          };
          const addButton = async (disabled = false) => {
            if (document.querySelector("#add-save-item")) {
              return;
            }
            const saveMenuItem = document.createElementNS(ns, "menuitem");
            saveMenuItem.setAttribute("label", getString("column-view-add"));
            saveMenuItem.setAttribute("id", "add-save-item");
            if (disabled) {
              saveMenuItem.setAttribute("disabled", "true");
            }
            saveMenuItem.addEventListener("command", async () => {
              addUpdateView({
                name: "",
                position: "",
                content: "",
                dataKeys: []
              });
            });
            colViewPopup.appendChild(saveMenuItem);
          };
          const ns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
          const menupopup = getElements(document.querySelectorAll("#zotero-column-picker")).at(-1);
          if (!menupopup) {
            return;
          }
          const sep = document.createElementNS(ns, "menuseparator");
          menupopup.appendChild(sep);
          const colViewPrimaryMenu = document.createElementNS(ns, "menu");
          colViewPrimaryMenu.setAttribute("label", getString("column-view-group"));
          colViewPrimaryMenu.setAttribute("anonid", "column-view-group");
          const colViewPopup = document.createElementNS(ns, "menupopup");
          colViewPopup.setAttribute("anonid", "column-view-group-popup");
          colViewPrimaryMenu.appendChild(colViewPopup);
          let columnsViews = this.getViewGroups();
          columnsViews = sort(columnsViews);
          let isAdded = false;
          for (const columnsView of columnsViews) {
            isAdded = isAdded || this.isCurrent(columnsView);
            ztoolkit.UI.appendElement({
              namespace: "xul",
              tag: "menu",
              attributes: {
                label: columnsView.name
                // type: "checkbox",
                // checked: "true"
              },
              styles: {
                fontWeight: this.isCurrent(columnsView) ? "bold" : "normal"
              },
              children: [{
                tag: "menupopup",
                children: [{
                  namespace: "xul",
                  tag: "menuitem",
                  attributes: {
                    label: getString("apply")
                  },
                  listeners: [{
                    type: "command",
                    listener: () => {
                      this.switchViewGroup(columnsView);
                    }
                  }]
                }, {
                  namespace: "xul",
                  tag: "menuitem",
                  attributes: {
                    label: getString("update")
                  },
                  listeners: [{
                    type: "command",
                    listener: () => {
                      columnsViews = columnsViews.filter(e => {
                        return !this.isSame(e.dataKeys, columnsView.dataKeys);
                      });
                      addUpdateView(columnsView, true);
                    }
                  }]
                }, {
                  namespace: "xul",
                  tag: "menuitem",
                  attributes: {
                    label: getString("remove")
                  },
                  listeners: [{
                    type: "command",
                    listener: () => {
                      if (!window.confirm(getString("ui-remove-view-confirm", { args: { name: columnsView.name } }))) {
                        return;
                      }
                      columnsViews = columnsViews.filter(e => {
                        return !this.isSame(e.dataKeys, columnsView.dataKeys);
                      });
                      Zotero.Prefs.set(this.prefKey, JSON.stringify(columnsViews));
                      if (!colViewPopup.querySelector("menuitem[checked=true]")) {
                        addButton();
                      }
                      this.updateToolbarUI(1000);
                    }
                  }]
                }]
              }]
            }, colViewPopup);
          }
          addButton(isAdded);
          menupopup.appendChild(colViewPrimaryMenu);
        }, 2);
      };
      this.cleanups.push(appendOwnedEntry(addon.data.patch._displayColumnPickerMenu.data, buildMenu));
    }
    schedule(callback, delay) {
      if (!this.active) {
        return undefined;
      }
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        if (!this.active) {
          return;
        }
        Promise.resolve(callback()).catch(error => {
          ztoolkit.log("Failed to run view manager task", error);
        });
      }, delay);
      this.timers.add(timer);
      return timer;
    }
  };

