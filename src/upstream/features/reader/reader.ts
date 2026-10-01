import { getString } from "../../utils/locale.ts";
import { config } from "../../config.ts";
import { removeElementsExcept } from "../../utils/dom.ts";
import { buildMenuPopup } from "../../platform/zotero/menu.ts";
import { reconcileReaderToolbarAfterInitialization } from "./readerToolbarLifecycle.ts";
import { getReaderInstances,getReaderOuterDocument,unregisterReaderEventListenersByPluginID } from "../../utils/reader.ts";
import { takeStaleOwnedEntries } from "./readerResourceLifecycle.ts";
import { registerNotify } from "../../platform/zotero/notifier.ts";
  // src/features/reader/reader.ts
  export function mergeAnnotations() {
    let active = true;
    const handler = event => {
      if (!active) {
        return;
      }
      const {
        reader,
        params,
        append
      } = event;
      append({
        label: getString("merge"),
        onCommand() {
          if (!active) {
            return;
          }
          const annoKeys = JSON.parse(JSON.stringify(params.ids));
          ztoolkit.log(annoKeys);
          const annoItems = annoKeys.map(key => Zotero.Items.getByLibraryAndKey(reader._item.libraryID, key));
          const mergedAnnoItem = annoItems[0];
          mergedAnnoItem.annotationText = annoItems.map(i => i.annotationText).join(" ");
          mergedAnnoItem.annotationComment = annoItems.map(i => i.annotationComment).join(" ");
          annoItems.slice(1).forEach(e => e.erase());
          annoItems.forEach(async e => {
            await e.saveTx();
          });
        }
      });
    };
    Zotero.Reader.registerEventListener("createAnnotationContextMenu", handler, config.addonID);
    return () => {
      if (!active) {
        return;
      }
      active = false;
      Zotero.Reader.unregisterEventListener("createAnnotationContextMenu", handler);
    };
  }
  export function registerAttachmentVersionSwitch() {
    const buttons = /* @__PURE__ */new Map();
    const pendingReaders = /* @__PURE__ */new WeakSet();
    const reconcileTimers = /* @__PURE__ */new Map();
    let active = true;
    const removeButtons = doc => {
      removeElementsExcept(doc.querySelectorAll("#pdf-version-button"));
      buttons.delete(doc);
    };
    const renderButton = (reader, doc) => {
      if (!active) {
        return false;
      }
      const id = "pdf-version-button";
      const toolbarEnd = doc.querySelector("#reader-ui .toolbar .end");
      if (!toolbarEnd) {
        return false;
      }
      const existing = buttons.get(doc);
      if (existing?.reader === reader && existing.button.isConnected && toolbarEnd.contains(existing.button)) {
        removeElementsExcept(doc.querySelectorAll(`#${id}`), existing.button);
        return true;
      }
      removeButtons(doc);
      let attItems = [];
      const button = ztoolkit.UI.appendElement({
        enableElementRecord: false,
        namespace: "html",
        tag: "button",
        id,
        classList: ["toolbar-button", "toolbar-dropdown-button", `${config.addonRef}-reader-button`],
        styles: {
          width: "fit-content",
          padding: "0 5px"
        },
        properties: {
          tabIndex: -1,
          title: getString("ui-feature-reader-attachmentVersionSwitch"),
          innerHTML: `<span id="number" style="margin-right: 3px;text-wrap: nowrap;overflow:hidden;text-overflow: ellipsis;">${getString("reader-attachment-versions", {
            args: {
              count: "-"
            }
          })}</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none"><path fill="currentColor" d="m0 2.707 4 4 4-4L7.293 2 4 5.293.707 2z"></path></svg>`
        },
        listeners: [{
          type: "click",
          listener: async () => {
            if (!active) {
              return;
            }
            await updateAttachmentItems();
            if (!active) {
              return;
            }
            const children = [];
            for (const attItem of attItems) {
              children.push({
                tag: "menuitem",
                attributes: {
                  label: attItem.getDisplayTitle(),
                  type: "checkbox",
                  checked: attItem.id == reader._item.id,
                  tooltiptext: attItem.attachmentReaderType + "\n" + attItem.getDisplayTitle()
                },
                listeners: [{
                  type: "command",
                  listener: async () => {
                    const index = Zotero_Tabs.selectedIndex;
                    Zotero_Tabs.close(Zotero_Tabs.selectedID);
                    await Zotero.Reader.open(attItem.id);
                    Zotero_Tabs.move(Zotero_Tabs.selectedID, index);
                  }
                }]
              });
            }
            buildMenuPopup({
              node: button
            }, children);
          }
        }]
      }, toolbarEnd);
      buttons.set(doc, {
        button,
        reader
      });
      const updateAttachmentItems = async () => {
        const toplevelItem = reader._item.parentItem;
        if (!toplevelItem) {
          return;
        }
        attItems = [];
        const ids = toplevelItem.getAttachments(false);
        for (const id2 of ids) {
          if (!active) {
            return;
          }
          const attItem = await Zotero.Items.getAsync(id2);
          if (!active) {
            return;
          }
          const exist = attItem && (attItem.isPDFAttachment() || attItem.isSnapshotAttachment()) && (await attItem.fileExists());
          if (exist) {
            attItems.push(attItem);
          }
        }
        if (!active) {
          return;
        }
        const span = button.querySelector("#number");
        if (!span) {
          return;
        }
        span.textContent = getString("reader-attachment-versions", {
          args: {
            count: attItems.length
          }
        });
      };
      updateAttachmentItems();
      return true;
    };
    const toolbarHandler = ({
      doc,
      reader
    }) => {
      renderButton(reader, doc);
    };
    const reconcileReader = reader => {
      if (!active || pendingReaders.has(reader)) {
        return;
      }
      pendingReaders.add(reader);
      reconcileReaderToolbarAfterInitialization(reader, () => active, getReaderOuterDocument, renderButton).finally(() => pendingReaders.delete(reader));
    };
    const reconcileReaders = () => {
      if (!active) {
        return;
      }
      const readers = getReaderInstances();
      try {
        const selectedReader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
        if (selectedReader && !readers.includes(selectedReader)) {
          readers.push(selectedReader);
        }
      } catch {}
      for (const [doc] of takeStaleOwnedEntries(buttons, readers, (_doc, entry) => entry.reader)) {
        try {
          removeButtons(doc);
        } catch {}
      }
      for (const reader of readers) {
        reconcileReader(reader);
      }
    };
    const scheduleReconcile = delay => {
      if (reconcileTimers.has(delay)) {
        return;
      }
      const timer = window.setTimeout(() => {
        reconcileTimers.delete(delay);
        reconcileReaders();
      }, delay);
      reconcileTimers.set(delay, timer);
    };
    unregisterReaderEventListenersByPluginID(config.addonRef);
    Zotero.Reader.registerEventListener("renderToolbar", toolbarHandler, config.addonID);
    const unregisterTabNotifier = registerNotify(["tab"], async () => {
      reconcileReaders();
      scheduleReconcile(100);
    });
    reconcileReaders();
    for (const delay of [100, 500, 1500]) {
      scheduleReconcile(delay);
    }
    return () => {
      active = false;
      unregisterTabNotifier();
      Zotero.Reader.unregisterEventListener("renderToolbar", toolbarHandler);
      for (const timer of reconcileTimers.values()) {
        window.clearTimeout(timer);
      }
      reconcileTimers.clear();
      for (const doc of buttons.keys()) {
        try {
          removeButtons(doc);
        } catch {}
      }
      buttons.clear();
    };
  }

