import { BasicTool } from "../vendor/index.js";
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
  export function getBrowserWindow() {
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
    return hiddenWindow;
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
/*! Bundled license information:

lucide/dist/esm/icons/app-window.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/book-open.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/compass.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/database.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/eye.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/folder-plus.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/highlighter.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/layers.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/link-2.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/menu.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/notebook-pen.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/panel-left.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/quote.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/settings-2.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/table-properties.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/icons/tags.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

lucide/dist/esm/lucide.mjs:
  (**
   * @license lucide v1.24.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/