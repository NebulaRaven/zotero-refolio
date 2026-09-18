import { getPref } from "../../utils/prefs.ts";
import { registerShortcut } from "../../utils/base.ts";
import { shouldIgnoreSidebarShortcut } from "./sidebarShortcut.ts";
import { config } from "../../config.ts";
import { getString } from "../../utils/locale.ts";
import { getElements } from "../../utils/dom.ts";
  // src/features/reader/toggleSidebar.ts
  export class ToggleSidebar {
    declare cleanups: Array<() => void | Promise<void>>;
    declare destroyed: boolean;

    constructor() {
      this.cleanups = [];
      this.destroyed = false;
      this.init();
    }
    init() {
      this.registerButtons();
      this.registerShortcuts();
    }
    registerShortcuts() {
      this.cleanups.push(registerShortcut("toogleSidebar.left.shortcut", event => {
        if (!this.destroyed && !shouldIgnoreSidebarShortcut(event)) {
          this.toogleLeft();
        }
      }), registerShortcut("toogleSidebar.right.shortcut", event => {
        if (!this.destroyed && !shouldIgnoreSidebarShortcut(event)) {
          this.toogleRight();
        }
      }));
    }
    /**
     * 注册主界面左右按钮
     */
    registerButtons() {
      const hbox = document.querySelector("#zotero-items-toolbar");
      const firstChild = hbox?.firstElementChild;
      if (!firstChild) {
        return;
      }
      const leftKey = getPref(`toogleSidebar.left.shortcut`);
      const rightKey = getPref(`toogleSidebar.right.shortcut`);
      const buttonStyles = {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 28px",
        width: "28px",
        height: "28px",
        minWidth: "28px",
        margin: "0",
        padding: "0 4px",
        boxSizing: "border-box",
        MozContextProperties: "fill, stroke"
      };
      const buttonContainer = ztoolkit.UI.insertElementBefore({
        namespace: "xul",
        tag: "hbox",
        classList: ["zotero-style-toolbar-button"],
        attributes: {
          orient: "horizontal",
          align: "center"
        },
        // Establish layout before the packaged stylesheet loads later in startup.
        styles: {
          display: "flex",
          flexDirection: "row",
          flex: "0 0 auto",
          alignSelf: "center",
          width: "56px",
          height: "28px"
        }
      }, firstChild);
      const divider = ztoolkit.UI.insertElementBefore({
        tag: "div",
        classList: ["vertical-divider"]
      }, buttonContainer);
      ztoolkit.UI.appendElement({
        namespace: "xul",
        tag: "toolbarbutton",
        id: `${config.addonRef}-left`,
        classList: ["zotero-tb-button", "zotero-style-sidebar-button"],
        styles: buttonStyles,
        attributes: {
          tooltiptext: `${getString("toggleSidebar")} (${leftKey})`,
          type: "button"
        },
        children: [{
          namespace: "xul",
          tag: "image",
          classList: ["toolbarbutton-icon"],
          attributes: {
            src: `chrome://${config.addonRef}/content/icons/sidebar-toggle.svg`
          },
          styles: {
            width: "20px",
            height: "20px",
            flex: "0 0 20px",
            fill: "currentColor"
          }
        }],
        listeners: [{
          type: "command",
          listener: async () => {
            if (this.destroyed) {
              return;
            }
            this.toogleLeft();
          }
        }]
      }, buttonContainer);
      ztoolkit.UI.appendElement({
        namespace: "xul",
        tag: "toolbarbutton",
        id: `${config.addonRef}-right`,
        classList: ["zotero-tb-button", "zotero-style-sidebar-button"],
        styles: buttonStyles,
        attributes: {
          tooltiptext: `${getString("toggleSidebar")} (${rightKey})`,
          type: "button"
        },
        children: [{
          namespace: "xul",
          tag: "image",
          classList: ["toolbarbutton-icon"],
          attributes: {
            src: `chrome://${config.addonRef}/content/icons/sidebar-chevron.svg`
          },
          styles: {
            width: "20px",
            height: "20px",
            flex: "0 0 20px",
            stroke: "currentColor"
          }
        }],
        listeners: [{
          type: "command",
          listener: async () => {
            if (this.destroyed) {
              return;
            }
            this.toogleRight();
          }
        }]
      }, buttonContainer);
      this.cleanups.push(() => {
        buttonContainer?.remove();
        divider?.remove();
      });
    }
    destroy() {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        cleanup();
      }
    }
    toogleLeft() {
      if (Zotero_Tabs.selectedType === "library") {
        const splitter = document.querySelector("#zotero-collections-splitter");
        if (splitter.getAttribute("state") == "collapsed") {
          splitter.setAttribute("state", "");
        } else {
          splitter.setAttribute("state", "collapsed");
        }
      } else if (Zotero_Tabs.selectedType == "reader") {
        const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
        const readerWindow = reader?._iframeWindow;
        const sidebarToggle = readerWindow?.document.querySelector<HTMLElement>("#sidebarToggle");
        sidebarToggle?.click();
      } else if (Zotero_Tabs.selectedType == "note") {
        const frame = document.querySelector<HTMLIFrameElement>(`vbox#${Zotero_Tabs.selectedID} #editor-view`);
        getElements(frame.contentDocument?.querySelectorAll(".toolbar-button") || []).find(i => i.title == "Toggle left pane")?.click();
      }
    }
    toogleRight() {
      if (Zotero_Tabs.selectedType === "library") {
        const splitter = document.querySelector("#zotero-items-splitter");
        if (splitter.getAttribute("state") == "collapsed") {
          splitter.setAttribute("state", "");
          return;
        } else {
          splitter.setAttribute("state", "collapsed");
          return;
        }
      } else if (Zotero_Tabs.selectedType == "reader") {
        const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
        const readerWindow = reader?._iframeWindow;
        const node = readerWindow?.document.querySelector<HTMLElement>(".context-pane-toggle") || document.querySelector<HTMLElement>("#zotero-context-pane [data-action=\"toggle-pane\"]");
        node?.click();
      } else if (Zotero_Tabs.selectedType == "note") {
        const frame = document.querySelector<HTMLIFrameElement>(`vbox#${Zotero_Tabs.selectedID} #editor-view`);
        getElements(frame.contentDocument?.querySelectorAll(".toolbar-button") || []).find(i => i.title == "Toggle right pane")?.click();
      }
    }
  };

