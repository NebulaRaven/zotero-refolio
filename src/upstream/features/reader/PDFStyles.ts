import { setPref,getPref } from "../../utils/prefs.ts";
import { config } from "../../config.ts";
import { registerNotify } from "../../platform/zotero/notifier.ts";
import { getReaderInstances,getReaderViewWindow } from "../../utils/reader.ts";
import { takeStaleOwnedEntries } from "./readerResourceLifecycle.ts";
import { getString } from "../../utils/locale.ts";
import { ownTemporaryMenuPopup } from "../../platform/zotero/menu.ts";
  // src/features/reader/PDFStyles.ts
  export class PDFStyles {
    declare active: boolean;
    declare readerResources: Map<any, any>;
    declare toolbarHandler: ({ reader }: { reader: any; }) => Promise<void>;
    declare unregisterTabNotifier: () => void;
    declare pruneTimer: number;

    constructor() {
      this.active = true;
      this.readerResources = /* @__PURE__ */new Map();
      this.toolbarHandler = async ({
        reader
      }) => {
        if (!this.active) {
          return;
        }
        this.pruneReaderResources();
        const resources = this.getReaderResources(reader);
        try {
          await this.insertButton(reader, resources);
          if (!this.isReaderResourceActive(reader, resources)) {
            return;
          }
          const documentElement =
          reader._internalReader?._primaryView?._iframeWindow?.document?.documentElement;
          if (documentElement) {
            this.addCSS(resources, documentElement, "fix-max-width", `
            .selection-popup {
              max-width: none !important;
            }
            `);
          }
        } catch (error) {
          if (this.active) {
            ztoolkit.log("PDF style toolbar setup failed", error);
          }
        }
      };
      Zotero.Reader.registerEventListener("renderToolbar", this.toolbarHandler, config.addonID);
      this.unregisterTabNotifier = registerNotify(["tab"], async () => {
        this.schedulePrune();
      });
    }
    destroy() {
      if (!this.active) {
        return;
      }
      this.active = false;
      this.unregisterTabNotifier();
      Zotero.Reader.unregisterEventListener("renderToolbar", this.toolbarHandler);
      if (this.pruneTimer !== undefined) {
        window.clearTimeout(this.pruneTimer);
        this.pruneTimer = undefined;
      }
      this.pruneReaderResources([]);
    }
    getReaderResources(reader) {
      let resources = this.readerResources.get(reader);
      if (!resources) {
        resources = {
          buttons: /* @__PURE__ */new Set(),
          menuPopupCleanups: /* @__PURE__ */new Set(),
          patchedWindows: /* @__PURE__ */new Set(),
          previousStyle: undefined,
          previousStyleCaptured: false,
          styleElements: /* @__PURE__ */new Set(),
          timers: /* @__PURE__ */new Set()
        };
        this.readerResources.set(reader, resources);
      }
      return resources;
    }
    isReaderResourceActive(reader, resources) {
      return this.active && this.readerResources.get(reader) === resources;
    }
    pruneReaderResources(liveReaders = getReaderInstances()) {
      const stale = takeStaleOwnedEntries(this.readerResources, liveReaders, reader => reader);
      for (const [reader, resources] of stale) {
        this.releaseReaderResources(reader, resources);
      }
    }
    schedulePrune() {
      if (!this.active || this.pruneTimer !== undefined) {
        return;
      }
      this.pruneTimer = window.setTimeout(() => {
        this.pruneTimer = undefined;
        this.pruneReaderResources();
      }, 100);
    }
    releaseReaderResources(reader, resources) {
      for (const cleanup of [...resources.menuPopupCleanups]) {
        try {
          cleanup();
        } catch {}
      }
      resources.menuPopupCleanups.clear();
      for (const timer of resources.timers) {
        window.clearTimeout(timer);
      }
      resources.timers.clear();
      for (const button of resources.buttons) {
        try {
          button.remove();
        } catch {}
      }
      resources.buttons.clear();
      for (const style2 of resources.styleElements) {
        try {
          style2.remove();
        } catch {}
      }
      resources.styleElements.clear();
      for (const win of resources.patchedWindows) {
        this.restoreColorPatch(win);
      }
      resources.patchedWindows.clear();
      if (!resources.previousStyleCaptured) {
        return;
      }
      try {
        if (resources.previousStyle === undefined) {
          delete reader.currentPDFStyle;
        } else {
          reader.currentPDFStyle = resources.previousStyle;
        }
      } catch {}
    }
    addCSS(resources, head, id, cssString) {
      if (!this.active) {
        return;
      }
      head.querySelectorAll(`#${id}`).forEach(element => {
        resources.styleElements.delete(element);
        element.remove();
      });
      if (cssString) {
        const style2 = ztoolkit.UI.appendElement({
          enableElementRecord: false,
          tag: "style",
          id,
          namespace: "html",
          properties: {
            innerHTML: cssString
          }
        }, head);
        resources.styleElements.add(style2);
      }
    }
    setColor(resources, win, color) {
      if (!this.active || !win) {
        return;
      }
      resources.patchedWindows.add(win);
      const serializedColor = JSON.stringify(color && (color.startsWith("#") || color.startsWith("rgb")) ? color : "");
      win.eval(`
      (() => {
        const proto = globalThis.CanvasRenderingContext2D?.prototype;
        if (!proto || typeof proto.fillRect !== "function") return;
        const marker = "__zoteroStylePDFStylesFillRect";
        const previous = proto[marker];
        if (previous && proto.fillRect === previous.wrapper) {
          previous.color = ${serializedColor};
          return;
        }
        const legacyOriginal = proto._fillRect;
        if (typeof legacyOriginal === "function" && proto.fillRect !== legacyOriginal) {
          proto.fillRect = legacyOriginal;
          delete proto._fillRect;
        }
        const state = { original: proto.fillRect, color: ${serializedColor} };
        state.wrapper = function(x, y, width, height) {
          try {
            if (state.color && this.canvas.getAttribute("role") == "presentation" && this.fillStyle == "#ffffff") {
              this.fillStyle = state.color;
            }
          } catch { /* Ignore unavailable legacy UI state. */ }
          return state.original.call(this, x, y, width, height);
        };
        proto[marker] = state;
        proto.fillRect = state.wrapper;
      })();
      `);
    }
    restoreColorPatch(win) {
      try {
        win.eval(`
        (() => {
          const proto = globalThis.CanvasRenderingContext2D?.prototype;
          const marker = "__zoteroStylePDFStylesFillRect";
          const state = proto?.[marker];
          if (!proto || !state) return;
          if (proto.fillRect === state.wrapper) proto.fillRect = state.original;
          delete proto[marker];
        })();
      `);
      } catch {}
    }
    refresh() {
      try {
        const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID) as _ZoteroTypes.ReaderInstance<'pdf'>;
        reader._internalReader._primaryView._iframeWindow.PDFViewerApplication.pdfViewer.refresh();
        reader._internalReader._secondaryView._iframeWindow.PDFViewerApplication.pdfViewer.refresh();
      } catch {}
    }
    addPDFStyle(cssObj, color) {
      if (!this.active) {
        return;
      }
      const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID) as _ZoteroTypes.ReaderInstance<'pdf'>;
      if (!reader) {
        return;
      }
      const resources = this.getReaderResources(reader);
      if (!resources.previousStyleCaptured) {
        resources.previousStyle = reader.currentPDFStyle;
        resources.previousStyleCaptured = true;
      }
      const currentPDFStyle = JSON.stringify({
        cssObj,
        color
      });
      if (reader.currentPDFStyle == currentPDFStyle) {
        return;
      }
      const win = reader?._iframeWindow?.wrappedJSObject;
      const heads = [...win.document.querySelectorAll("iframe")].map(iframe => iframe.contentDocument.head);
      if (heads.length == 2) {
        heads.forEach(head => this.addCSS(resources, head, cssObj.id, cssObj.cssString));
      } else {
        this.addCSS(resources, heads[0], cssObj.id, cssObj.cssString);
      }
      const win1 = reader?._internalReader?._primaryView?._iframeWindow;
      this.setColor(resources, win1, color);
      const win2 = reader?._internalReader?._secondaryView?._iframeWindow;
      this.setColor(resources, win2, color);
      this.refresh();
      reader.currentPDFStyle = currentPDFStyle;
    }
    /**
     * 插入操作按钮
     * @param reader
     */
    async insertButton(reader, resources) {
      if (!this.isReaderResourceActive(reader, resources)) {
        return;
      }
      const setPref2 = PDFStyles3 => {
        setPref(`PDFStyles`, JSON.stringify(PDFStyles3));
      };
      const getPref2 = () => {
        let PDFStyles3 = JSON.parse(String(getPref(`PDFStyles`) || "[]"));
        if (!PDFStyles3.find(i => i.color?.length > 0)) {
          PDFStyles3 = [{
            name: "☀️",
            selected: false,
            css: `
            canvas{filter: none !important; }
          `
          }, {
            name: "✨",
            selected: false,
            css: `
            canvas{filter: invert(84%) sepia(59%) saturate(210%) hue-rotate(185deg) brightness(93%) contrast(88%) !important; }
          `
          }, {
            name: "🌙",
            selected: false,
            css: `
            canvas{filter: brightness(0.91) grayscale(0.15) invert(0.95) sepia(0.65) hue-rotate(180deg) !important; }
          `
          }, {
            name: getString("pdf-style-beige"),
            selected: false,
            color: `#ede9e1`
          }, {
            name: getString("pdf-style-green"),
            selected: false,
            color: `#e8ede4`
          }, {
            name: getString("pdf-style-sage"),
            selected: false,
            color: `#c8edcc`
          }, {
            name: getString("pdf-style-sky-blue"),
            selected: false,
            color: `#dbe2f2`
          }, {
            name: getString("pdf-style-grass-green"),
            selected: false,
            color: `#e2eccd`
          }];
        }
        return PDFStyles3;
      };
      const addUpdatePref = async (index = -1) => {
        const updating = index >= 0;
        const PDFStyles3 = getPref2();
        const dialogData: { name: any; color: any; css: any; } & { _lastButtonId?: string; unloadLock?: { promise: Promise<void> } } = {
          name: PDFStyles3[index]?.name,
          color: PDFStyles3[index]?.color,
          css: PDFStyles3[index]?.css
        };
        const dialog = new ztoolkit.Dialog(3, 1).setDialogData(dialogData).addCell(0, 0, {
          tag: "input",
          id: "name",
          attributes: {
            "data-bind": "name",
            "data-prop": "value",
            type: "text",
            placeholder: getString("ui-name")
          },
          styles: {
            flex: "1",
            minWidth: "200px",
            maxHeight: "2em",
            height: "2em",
            margin: "5px 0"
          }
        }).addCell(1, 0, {
          tag: "input",
          id: "color",
          attributes: {
            "data-bind": "color",
            "data-prop": "value",
            type: "text",
            placeholder: getString("ui-color-code-example")
          },
          styles: {
            flex: "1",
            minWidth: "200px",
            maxHeight: "2em",
            height: "2em",
            margin: "5px 0"
          }
        }).addCell(2, 0, {
          tag: "input",
          id: "css",
          attributes: {
            "data-bind": "css",
            "data-prop": "value",
            type: "text",
            placeholder: getString("ui-css-code-example")
          },
          styles: {
            flex: "1",
            minWidth: "200px",
            maxHeight: "2em",
            height: "2em",
            margin: "5px 0"
          }
        }).addButton(getString(updating ? "ui-update" : "ui-add"), "addUpdate");
        if (updating) {
          dialog.addButton(getString("ui-remove"), "remove");
        }
        dialog.addButton(getString("ui-cancel"), "cancel");
        dialog.open(getString("ui-pdf-style"), {
          height: 200,
          width: 300,
          centerscreen: true,
          resizable: true
        });
        await dialogData.unloadLock?.promise;
        if (!this.isReaderResourceActive(reader, resources)) {
          return;
        }
        if (dialogData._lastButtonId == "addUpdate") {
          if (index >= 0) {
            PDFStyles3[index].name = dialogData.name;
            PDFStyles3[index].css = dialogData.css;
            PDFStyles3[index].color = dialogData.color;
            new ztoolkit.ProgressWindow(config.addonName).createLine({
              text: getString("ui-update"),
              type: "success"
            }).show();
          } else {
            PDFStyles3.push({
              name: dialogData.name,
              css: dialogData.css,
              color: dialogData.color,
              selected: false
            });
            new ztoolkit.ProgressWindow(config.addonName).createLine({
              text: getString("ui-add"),
              type: "success"
            }).show();
          }
        }
        if (dialogData._lastButtonId == "remove") {
          PDFStyles3.splice(index, 1);
          new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: getString("ui-remove"),
            type: "success"
          }).show();
        }
        setPref2(PDFStyles3);
        const PDFStyle2 = PDFStyles3.find(e => e.selected);
        if (PDFStyle2) {
          this.addPDFStyle({
            id: "pdf-css",
            cssString: PDFStyle2.css,
            replace: true
          }, PDFStyle2.color);
        }
      };
      let readerWin;
      let viewerWin;
      while (this.isReaderResourceActive(reader, resources) && !(readerWin = reader?._iframeWindow?.wrappedJSObject)) {
        await Zotero.Promise.delay(10);
      }
      while (this.isReaderResourceActive(reader, resources) && !(viewerWin = getReaderViewWindow(reader?._internalReader?._primaryView))) {
        await Zotero.Promise.delay(10);
      }
      if (!this.isReaderResourceActive(reader, resources) || !readerWin || !viewerWin) {
        return;
      }
      const PDFStyles2 = getPref2();
      const PDFStyle = PDFStyles2.find(e => e.selected);
      if (PDFStyle) {
        this.addPDFStyle({
          id: "pdf-css",
          cssString: PDFStyle.css,
          replace: true
        }, PDFStyle.color);
      }
      if (readerWin.document.querySelector(".center.tools .pdf-styles")) {
        return;
      }
      const button = ztoolkit.UI.appendElement({
        enableElementRecord: false,
        tag: "div",
        classList: ["toolbar-button", "toolbar-dropdown-button", "pdf-styles"],
        attributes: {
          title: getString("ui-select-pdf-style")
        },
        properties: {
          innerHTML: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="rgba(239, 74, 74)"><path d="M881.777778 765.155556c-76.8-5.688889-150.755556-34.133333-210.488889-85.333334-116.622222 25.6-227.555556 62.577778-338.488889 108.088889-88.177778 156.444444-170.666667 236.088889-241.777778 236.088889-14.222222 0-31.288889-2.844444-42.666666-11.377778C17.066667 998.4 0 967.111111 0 935.822222c0-25.6 5.688889-96.711111 275.911111-213.333333 62.577778-113.777778 110.933333-230.4 150.755556-352.711111-34.133333-68.266667-108.088889-236.088889-56.888889-321.422222C386.844444 17.066667 420.977778 0 457.955556 2.844444c28.444444 0 56.888889 14.222222 73.955555 36.977778 36.977778 51.2 34.133333 159.288889-14.222222 318.577778 45.511111 85.333333 105.244444 162.133333 176.355555 227.555556 59.733333-11.377778 119.466667-19.911111 179.2-19.911112 133.688889 2.844444 153.6 65.422222 150.755556 102.4 0 96.711111-93.866667 96.711111-142.222222 96.711112zM85.333333 941.511111l8.533334-2.844444c39.822222-14.222222 71.111111-42.666667 93.866666-79.644445-42.666667 17.066667-76.8 45.511111-102.4 82.488889z m378.311111-853.333333H455.111111c-2.844444 0-8.533333 0-11.377778 2.844444-11.377778 48.355556-2.844444 99.555556 17.066667 145.066667 17.066667-48.355556 17.066667-99.555556 2.844444-147.911111z m19.911112 412.444444l-2.844445 5.688889-2.844444-2.844444c-25.6 65.422222-54.044444 130.844444-85.333334 193.422222l5.688889-2.844445v5.688889c62.577778-22.755556 130.844444-42.666667 193.422222-56.888889l-2.844444-2.844444h8.533333c-42.666667-42.666667-82.488889-91.022222-113.777777-139.377778z m386.844444 150.755556c-25.6 0-48.355556 0-73.955556 5.688889 28.444444 14.222222 56.888889 19.911111 85.333334 22.755555 19.911111 2.844444 39.822222 0 56.888889-5.688889 0-8.533333-11.377778-22.755556-68.266667-22.755555z"></path></svg><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none"><path fill="currentColor" d="m0 2.707 4 4 4-4L7.293 2 4 5.293.707 2z"></path></svg>`
        }
      }, readerWin.document.querySelector(".center.tools"));
      resources.buttons.add(button);
      button.addEventListener("click", () => {
        if (!this.isReaderResourceActive(reader, resources)) {
          return;
        }
        const PDFStyles3 = getPref2();
        const menupopup = ztoolkit.UI.appendElement({
          enableElementRecord: false,
          tag: "menupopup",
          id: "pdf-style-menupopup",
          namespace: "xul",
          children: []
        }, document.querySelector("#browser"));
        const popupTimers = new Set<number>();
        const closePopup = ownTemporaryMenuPopup(menupopup, () => {
          for (const timer of popupTimers) {
            window.clearTimeout(timer);
            resources.timers.delete(timer);
          }
          popupTimers.clear();
          resources.menuPopupCleanups.delete(closePopup);
        });
        resources.menuPopupCleanups.add(closePopup);
        for (const PDFStyle2 of PDFStyles3) {
          const menuitem = ztoolkit.UI.appendElement({
            enableElementRecord: false,
            tag: "menuitem",
            attributes: {
              label: PDFStyle2.name
            },
            styles: {
              backgroundColor: PDFStyle2.selected ? "#0078d7" : "",
              color: PDFStyle2.selected ? "#fff" : ""
            }
          }, menupopup);
          menuitem.addEventListener("command", () => {
            if (!this.isReaderResourceActive(reader, resources)) {
              return;
            }
            PDFStyle2.selected = !PDFStyle2.selected;
            if (PDFStyle2.selected) {
              this.addPDFStyle({
                id: "pdf-css",
                cssString: PDFStyle2.css,
                replace: false
              }, PDFStyle2.color);
              menuitem.classList.add("selected");
              PDFStyles3.forEach(e => e.selected = false);
              PDFStyle2.selected = true;
            } else {
              this.addPDFStyle({
                id: "pdf-css",
                cssString: "",
                replace: true
              }, "");
              menuitem.classList.remove("selected");
            }
            setPref2(PDFStyles3);
          });
          let timer;
          menuitem.addEventListener("mousedown", () => {
            if (timer !== undefined) {
              window.clearTimeout(timer);
              resources.timers.delete(timer);
              popupTimers.delete(timer);
            }
            timer = window.setTimeout(() => {
              resources.timers.delete(timer);
              popupTimers.delete(timer);
              timer = undefined;
              if (!this.isReaderResourceActive(reader, resources)) {
                return;
              }
              addUpdatePref(PDFStyles3.indexOf(PDFStyle2));
            }, 1000);
            resources.timers.add(timer);
            popupTimers.add(timer);
          });
          menuitem.addEventListener("mouseup", () => {
            if (timer !== undefined) {
              window.clearTimeout(timer);
              resources.timers.delete(timer);
              popupTimers.delete(timer);
              timer = undefined;
            }
          });
        }
        const addButton = ztoolkit.UI.appendElement({
          enableElementRecord: false,
          tag: "menuitem",
          attributes: {
            label: "🎨"
          }
        }, menupopup);
        addButton.addEventListener("command", () => {
          if (!this.isReaderResourceActive(reader, resources)) {
            return;
          }
          addUpdatePref();
        });
        try {
          menupopup.openPopup(button, "after_start", 0, 0, false, false);
        } catch (error) {
          closePopup();
          throw error;
        }
      });
    }
  };

