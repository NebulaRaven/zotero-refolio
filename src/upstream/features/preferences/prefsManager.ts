import type { PreferenceRow } from '../../../types/ui.ts';
import { config } from "../../config.ts";
import { getString } from "../../utils/locale.ts";
import { getElements } from "../../utils/dom.ts";
  // src/features/preferences/prefsManager.ts
  export class PrefsManager {
    declare menuID: string;
    declare destroyed: boolean;
    declare dialogHelper: any;
    declare hasMenu: boolean;

    constructor({ menu = true }: { menu?: boolean } = {}) {
      this.menuID = `${config.addonRef}-preference-manager`;
      this.destroyed = false;
      this.hasMenu = menu;
      if (menu) this.registerButton();
    }
    registerButton() {
      ztoolkit.Menu.register("menuTools", {
        tag: "menuitem",
        id: this.menuID,
        label: getString("preference-manager"),
        icon: `chrome://${config.addonRef}/content/icons/refolio.svg`,
        commandListener: () => {
          if (this.destroyed) {
            return;
          }
          this.buildPopup().catch(error => ztoolkit.log("Preference manager failed", error));
        }
      });
    }
    destroy() {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      if (this.hasMenu) ztoolkit.Menu.unregister(this.menuID);
      this.dialogHelper?.window?.close?.();
      this.dialogHelper = undefined;
    }
    async buildPopup() {
      const getCurrentPrefs = () => {
        const prefs = {};
        for (const row of getElements(vbox.querySelectorAll("#top #left .row"))) {
          if (!row.querySelector("input").checked) {
            continue;
          }
          const prefix = row.getAttribute("path");
          prefs[prefix] = {};
          const pluginID = prefix.split(".").slice(-1)[0];
          for (const row2 of getElements<PreferenceRow>(vbox.querySelectorAll(`#top #${pluginID} .row`))) {
            const suffix = row2.getAttribute("path");
            const checkbox = row2.querySelector("input");
            if (!checkbox.checked || checkbox.getAttribute("disabled")) {
              continue;
            }
            prefs[prefix][suffix] = row2.value;
          }
        }
        return prefs;
      };
      const savePrefsAsJson = async (mark = "", isReveal = false) => {
        const prefs = await getCurrentPrefs();
        const filepath = PathUtils.joinRelative(Zotero.getTempDirectory().path, String((/* @__PURE__ */new Date()).getTime()) + "-" + mark + ".json");
        await Zotero.File.putContentsAsync(filepath, JSON.stringify(prefs));
        if (isReveal) {
          Zotero.File.reveal(filepath);
        }
      };
      const getAllPrefs = async () => {
        const {
          AddonManager
        } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
        const addons = (await AddonManager.getActiveAddons()).addons;
        const plugin2prefID = {
          "zoterotag@polygon.org": "actionsTags",
          "zoteropdftranslate@polygon.org": "ZoteroPDFTranslate"
        };
        const prefs = {};
        for (const addon2 of addons) {
          const pluginID = plugin2prefID[addon2.id] || addon2.id.split("@")?.[0];
          if (!pluginID) {
            continue;
          }
          let prefix = `extensions.zotero.${pluginID}`;
          let branch = Services.prefs.getBranch(prefix);
          let suffixArr = branch.getChildList("");
          if (suffixArr.length == 0) {
            prefix = `extensions.${pluginID}`;
            branch = Services.prefs.getBranch(prefix);
            suffixArr = branch.getChildList("");
          }
          suffixArr = suffixArr.filter(key => branch.prefHasUserValue(key));
          if (suffixArr.length == 0) {
            continue;
          }
          prefs[prefix] = {};
          for (const suffix of suffixArr) {
            prefs[prefix][suffix] = Zotero.Prefs.get(prefix + suffix, true);
          }
        }
        return prefs;
      };
      const importFromPrefs = async prefs => {
        vbox.querySelectorAll("#top #left .row")?.forEach(e => e.remove());
        vbox.querySelectorAll("#top #right div")?.forEach(e => e.remove());
        for (const prefix in prefs) {
          const pluginID = prefix.split(".").slice(-1)[0];
          const addRow = (parent, key, value, path, change = () => {}, activate = () => {}) => {
            const row = ztoolkit.UI.appendElement({
              tag: "div",
              classList: ["row"],
              id: pluginID,
              attributes: {
                path
              },
              properties: {
                value
              },
              styles: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                padding: ".25em",
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
                  tag: "input",
                  namespace: "html",
                  id: pluginID,
                  attributes: {
                    type: "checkbox"
                    // checked: "true"
                  },
                  properties: {
                    checked: true
                  },
                  styles: {
                    marginRight: ".5em"
                  },
                  listeners: [{
                    type: "change",
                    listener: change
                  }, {
                    type: "click",
                    listener: event => {
                      if (event.shiftKey) {
                        [...parent.querySelectorAll(`.row input`)].forEach(e => e.click());
                      }
                    }
                  }]
                }, {
                  tag: "span",
                  properties: {
                    innerText: key
                  }
                }]
              }, {
                tag: "span",
                styles: {
                  opacity: ".5",
                  margin: "0 .5em",
                  "-webkit-line-clamp": "1",
                  "-webkit-box-orient": "vertical",
                  display: "-webkit-box",
                  overflow: "hidden",
                  maxWidth: "200px"
                },
                properties: {
                  innerText: value
                },
                listeners: [{
                  type: "click",
                  listener: function () {
                    this.style["-webkit-line-clamp"] = "";
                  }
                }]
              }],
              listeners: [{
                type: "click",
                listener: activate
              }]
            }, parent);
          };
          addRow(leftContainer, pluginID, Object.values(prefs[prefix]).length, prefix, () => {
            const checkbox = leftContainer.querySelector(`.row#${pluginID} input`);
            if (checkbox.checked) {
              rightNode.querySelector(`#${pluginID}`)?.querySelectorAll("input").forEach(i => i.removeAttribute("disabled"));
            } else {
              rightNode.querySelector(`#${pluginID}`)?.querySelectorAll("input").forEach(i => i.setAttribute("disabled", "true"));
            }
          }, () => {
            leftContainer.querySelectorAll(`.row`)?.forEach(i => i.classList.remove("selected"));
            leftContainer.querySelector(`.row#${pluginID}`)?.classList.add("selected");
            rightNode.childNodes.forEach(node => {
              if (node.id == pluginID) {
                node.style.display = "flex";
              } else {
                node.style.display = "none";
              }
            });
          });
          const rightContiner = ztoolkit.UI.appendElement({
            tag: "div",
            id: pluginID,
            styles: {
              display: "none",
              height: "500px",
              flexDirection: "column",
              overflowY: "scroll"
            }
          }, rightNode);
          for (const suffix in prefs[prefix]) {
            addRow(rightContiner, suffix.slice(1), String(prefs[prefix][suffix]) || "", suffix);
          }
        }
      };
      const dialogHelper = new ztoolkit.Dialog(1, 1).addCell(0, 0, {
        tag: "div",
        styles: {
          display: "flex",
          flexDirection: "column",
          // height: "530px",
          minWidth: "600px"
        },
        children: [{
          tag: "div",
          id: "top",
          styles: {
            display: "flex",
            flexDirection: "row",
            flexGrow: "1"
          },
          children: [{
            tag: "div",
            id: "left",
            styles: {
              border: "var(--material-border-quarternary)",
              // backgroundColor: "#fff",
              width: "30%",
              height: "500px",
              display: "flex",
              flexDirection: "column",
              overflowY: "scroll",
              overflowX: "hidden"
            }
          }, {
            tag: "div",
            id: "right",
            styles: {
              width: "70%",
              height: "500px",
              border: "var(--material-border-quarternary)",
              borderLeft: "none"
            }
          }]
        }, {
          tag: "div",
          id: "bottom",
          styles: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            marginTop: "5px",
            marginBottom: "5px",
            padding: "3px"
          },
          children: [{
            tag: "button",
            id: "import",
            properties: {
              innerText: getString("prefs-import")
            },
            listeners: [{
              type: "click",
              listener: async () => {
                const importButton = vbox.querySelector("#bottom #import");
                const applyButton = vbox.querySelector("#bottom #apply");
                if (importButton.textContent == getString("prefs-import")) {
                  const fp = new window.FilePicker();
                  fp.init(window, getString("ui-select-file"), fp.modeOpen);
                  fp.displayDirectory = Zotero.getTempDirectory().path;
                  fp.appendFilter(getString("ui-json-files"), "*.json");
                  if ((await fp.show()) != fp.returnOK) {
                    return false;
                  }
                  const filepath = PathUtils.normalize(fp.file);
                  if (filepath) {
                    const prefs = JSON.parse(await Zotero.File.getContentsAsync(filepath) as string);
                                vbox.querySelector("#bottom #import").innerText = getString("prefs-undo-import");
                    await importFromPrefs(prefs);
                    applyButton.removeAttribute("disabled");
                  }
                  dialogHelper.window.focus();
                } else {
                  vbox.querySelector("#bottom #import").innerText = getString("prefs-import");
                  await importFromPrefs(await getAllPrefs());
                  applyButton.setAttribute("disabled", "true");
                }
              }
            }]
          }, {
            tag: "button",
            id: "apply",
            properties: {
              innerText: getString("apply")
            },
            attributes: {
              disabled: "true"
            },
            listeners: [{
              type: "click",
              listener: async () => {
                const prefs = getCurrentPrefs();
                        for (const prefix in prefs) {
                  for (const suffix in prefs[prefix]) {
                    Zotero.Prefs.set(prefix + suffix, prefs[prefix][suffix], true);
                  }
                }
              }
            }]
          }, {
            tag: "button",
            id: "help",
            properties: {
              innerText: getString("prefs-help")
            },
            listeners: [{
              type: "click",
              listener: async () => {
                new ztoolkit.ProgressWindow(getString("prefs-help"), {
                  closeTime: -1
                }).createLine({
                  text: getString("prefs-help-tip-1"),
                  type: "default"
                }).createLine({
                  text: getString("prefs-help-tip-2"),
                  type: "default"
                }).createLine({
                  text: getString("prefs-help-tip-3"),
                  type: "default"
                }).show();
              }
            }]
          }, {
            tag: "button",
            properties: {
              innerText: getString("prefs-export")
            },
            listeners: [{
              type: "click",
              listener: async () => {
                await savePrefsAsJson("export", true);
                new ztoolkit.ProgressWindow(getString("prefs-export")).createLine({
                  text: getString("prefs-export-tip-rename"),
                  type: "default"
                }).createLine({
                  text: getString("prefs-export-tip-auto-clean"),
                  type: "default"
                }).show();
              }
            }]
          }]
        }]
      }).open(getString("preference-manager"), {
        centerscreen: true,
        resizable: false,
        fitContent: true
      });
      this.dialogHelper = dialogHelper;
      const dialogWindow = dialogHelper.window;
      dialogWindow?.addEventListener("unload", () => {
        if (this.dialogHelper === dialogHelper) {
          this.dialogHelper = undefined;
        }
      }, {
        once: true
      });
      while (!this.destroyed && dialogHelper.window && !dialogHelper.window.document?.querySelector("vbox")) {
        await Zotero.Promise.delay(100);
      }
      if (this.destroyed || !dialogHelper.window) {
        return;
      }
      ztoolkit.UI.appendElement({
        tag: "style",
        namespace: "html",
        properties: {
          innerHTML: `
          .row:hover { background-color: var(--fill-quinary, rgba(128, 128, 128, .08)); }
          .row.selected { background-color: color-mix(in srgb, var(--accent-blue, #4072e5) 20%, transparent); }
        `
        }
      }, dialogHelper.window.document.documentElement);
      const vbox = dialogHelper.window.document.querySelector("vbox");
      const leftContainer = vbox.querySelector("#top #left");
      const rightNode = vbox.querySelector("#top #right");
      if (this.destroyed) {
        return;
      }
      await importFromPrefs(await getAllPrefs());
      if (this.destroyed) {
        return;
      }
      await savePrefsAsJson("backup", false);
    }
  };

  // Opened from the settings page, where the Tools menu entry may not exist yet.
  export function spOpenPrefsManager() {
    const manager = new PrefsManager({ menu: false });
    manager.buildPopup().catch(error => ztoolkit.log("Preference manager failed", error));
    return manager;
  }
