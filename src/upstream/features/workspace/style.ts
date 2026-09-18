import { config } from "../../config.ts";
import { isEnabel } from "../../utils/base.ts";
import { syncStyleElement } from "./styleElement.ts";
import { getReaderInstances,getReaderOuterDocument } from "../../utils/reader.ts";
  // src/features/workspace/style.ts
  export var CUSTOM_STYLE_ID = `${config.addonRef}-custom-style`;
  export var PACKAGED_STYLE_ID = `${config.addonRef}-packaged-style`;
  export var TAG_COLOR_STYLE_ID = `${config.addonRef}-tag-color-style`;
  export var CUSTOM_STYLE_ENABLE_PREF = `${config.addonRef}.function.styleEditor.enable`;
  export var CUSTOM_STYLE_VALUE_PREF = `${config.addonRef}.styleEditor.value`;
  export function readCustomStyle() {
    if (!isEnabel("styleEditor")) {
      return undefined;
    }
    const value = Zotero.Prefs.get(CUSTOM_STYLE_VALUE_PREF);
    if (typeof value === "string") {
      return value;
    } else {
      return undefined;
    }
  }
  export function addStyle(mainDocument = document) {
    mainDocument.getElementById(PACKAGED_STYLE_ID)?.remove();
    const styles = ztoolkit.UI.createElement(mainDocument, "link", {
      id: PACKAGED_STYLE_ID,
      properties: {
        type: "text/css",
        rel: "stylesheet",
        href: `chrome://${config.addonRef}/content/zoteroPane.css`
      }
    });
    mainDocument.documentElement.appendChild(styles);
    let active = true;
    const syncDocument = (doc, css = readCustomStyle()) => {
      try {
        syncStyleElement(doc, CUSTOM_STYLE_ID, css);
      } catch {}
    };
    const syncActiveDocument = doc => {
      if (!active) {
        return;
      }
      syncDocument(doc);
    };
    const syncReader = async reader => {
      try {
        await reader._initPromise;
      } catch {
        return;
      }
      if (!active) {
        return;
      }
      const doc = getReaderOuterDocument(reader);
      if (doc) {
        syncActiveDocument(doc);
      }
    };
    const syncReaders = () => {
      for (const reader of getReaderInstances()) {
        syncReader(reader);
      }
    };
    const syncAllDocuments = () => {
      const css = readCustomStyle();
      syncDocument(mainDocument, css);
      syncReaders();
    };
    const toolbarHandler = ({
      doc
    }) => {
      syncActiveDocument(doc);
    };
    Zotero.Reader.registerEventListener("renderToolbar", toolbarHandler, config.addonID);
    const prefObservers = [Zotero.Prefs.registerObserver(CUSTOM_STYLE_ENABLE_PREF, syncAllDocuments), Zotero.Prefs.registerObserver(CUSTOM_STYLE_VALUE_PREF, syncAllDocuments)];
    syncAllDocuments();
    let cssString = ``;
    for (const color of [...Zotero.Tags.getColors(1)].map(i => i[1].color)) {
      cssString += `
      .colored.tag-selector-item[data-color="${color.toLowerCase()}"]:not(.emoji)::before {
        background-color: ${color};
      }
      .colored.selected.tag-selector-item[data-color="${color.toLowerCase()}"]:not(.emoji) {
        background-color: ${color};
      }
    `;
    }
    syncStyleElement(mainDocument, TAG_COLOR_STYLE_ID, cssString);
    return () => {
      active = false;
      Zotero.Reader.unregisterEventListener("renderToolbar", toolbarHandler);
      for (const observer of prefObservers) {
        Zotero.Prefs.unregisterObserver(observer);
      }
      syncStyleElement(mainDocument, CUSTOM_STYLE_ID, undefined);
      for (const reader of getReaderInstances()) {
        try {
          const doc = getReaderOuterDocument(reader);
          if (doc) {
            syncStyleElement(doc, CUSTOM_STYLE_ID, undefined);
          }
        } catch {}
      }
      mainDocument.getElementById(PACKAGED_STYLE_ID)?.remove();
      mainDocument.getElementById(TAG_COLOR_STYLE_ID)?.remove();
    };
  }

