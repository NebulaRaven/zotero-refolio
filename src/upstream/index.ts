import { BasicTool } from "zotero-plugin-toolkit";
import { config } from "./config.ts";
import { BROWSER_GLOBAL_NAMES,resolveBrowserGlobal } from "./utils/browserGlobals.ts";
import { addon_default } from "./addon.ts";
  // src/index.ts
  export var basicTool2 = new BasicTool();
  export var zotero = basicTool2.getGlobal("Zotero");
  export var addonRegistry = zotero;
  if (!addonRegistry[config.addonInstance]) {
    _globalThis.Zotero = zotero;
    defineGlobal("window", getBrowserWindow);
    defineGlobal("document", () => getBrowserWindow().document);
    for (const name of BROWSER_GLOBAL_NAMES) {
      defineGlobal(name, () => resolveBrowserGlobal(getBrowserWindow(), name));
    }
    defineGlobal("ZoteroPane");
    defineGlobal("Zotero_Tabs");
    _globalThis.addon = new addon_default();
    defineGlobal("ztoolkit", () => {
      return _globalThis.addon.data.ztoolkit;
    });
    addonRegistry[config.addonInstance] = addon;
  }
  export function getBrowserWindow(): Window {
    try {
      const mainWindow = zotero.getMainWindow?.();
      if (mainWindow) {
        return mainWindow;
      }
    } catch {}
    const hiddenWindow = _globalThis.Services?.appShell?.hiddenDOMWindow;
    if (!hiddenWindow) {
      throw new Error("Browser global window is unavailable");
    }
    // The hidden window is a full DOM window at runtime; its XPCOM type leaves that out.
    return hiddenWindow as unknown as Window;
  }
  export function defineGlobal(name, getter?) {
    Object.defineProperty(_globalThis, name, {
      get() {
        if (getter) {
          return getter();
        } else {
          return basicTool2.getGlobal(name);
        }
      }
    });
  }
