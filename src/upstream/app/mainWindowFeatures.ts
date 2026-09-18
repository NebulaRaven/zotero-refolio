import { addColorNameTag,isEnabel } from "../utils/base.ts";
import { patchTabMenu } from "../features/tabs/tabMenu.ts";
import { registerTLDRPane } from "../features/reader/TLDR.ts";
import { startAnnotationColorsFeature } from "../features/annotations/annotationColors.ts";
import { mergeAnnotations,registerAttachmentVersionSwitch } from "../features/reader/reader.ts";
import { PDFStyles } from "../features/reader/PDFStyles.ts";
import { ToggleSidebar } from "../features/reader/toggleSidebar.ts";
import { AddTags,initTags } from "../features/tags/tags.ts";
import { GraphView } from "../features/collections/graphView.ts";
import { registerAllButtons } from "../features/workspace/buttons.ts";
import { registerNotify } from "../platform/zotero/notifier.ts";
import { handleItemActivity } from "./itemActivity.ts";
import { patchAll } from "../platform/zotero/patches.ts";
import { MenuVisibilityManager } from "../features/workspace/menuVisibilityManager.ts";
import { initStorage } from "../platform/persistence/storage.ts";
import { startDeferredItemTree } from "../features/item-tree/itemTreeLifecycle.ts";
import { ItemTree } from "../features/item-tree/itemTree-57.ts";
import { reportFeatureFailure } from "../../app/hooks.ts";
import { getPref } from "../utils/prefs.ts";
import { Record } from "../features/reader/record.ts";
import { PrefsManager } from "../features/preferences/prefsManager.ts";
import { addStyle } from "../features/workspace/style.ts";
import { ViewManager } from "../features/item-tree/viewManager.ts";
import { initCollectionTree } from "../features/collections/collectionTree.ts";
import { registerAllCommands } from "../features/workspace/prompt.ts";
import { FulltextTranslate } from "../features/reader/fulltextTranslate.ts";
  // src/app/mainWindowFeatures.ts
  export var enabled = key => () => Boolean(isEnabel(key));
  export function createImmediateFeatures() {
    return [{
      id: "tab-menu",
      isEnabled: enabled("tabMenu"),
      start: () => patchTabMenu()
    }, {
      id: "tldr-pane",
      isEnabled: enabled("tldr"),
      start: ({
        window: window2
      }) => registerTLDRPane(window2)
    }, {
      id: "annotation-colors",
      isEnabled: enabled("annotationColors"),
      start: () => startAnnotationColorsFeature()
    }, {
      id: "merge-annotations",
      isEnabled: enabled("reader.mergeAnnotations"),
      start: () => mergeAnnotations()
    }, {
      id: "pdf-styles",
      isEnabled: enabled("PDFStyles"),
      start: () => {
        const pdfStyles = new PDFStyles();
        return () => pdfStyles.destroy();
      }
    }, {
      id: "attachment-version-switch",
      isEnabled: enabled("reader.attachmentVersionSwitch"),
      start: () => registerAttachmentVersionSwitch()
    }, {
      id: "annotation-color-tags",
      start: () => addColorNameTag()
    }, {
      id: "sidebar-toggle",
      isEnabled: enabled("toogleSidebar"),
      start: () => {
        const feature = new ToggleSidebar();
        return () => feature.destroy();
      }
    }];
  }
  export function createStandardFeatures() {
    return [{
      id: "add-tags",
      isEnabled: enabled("addTags"),
      start: () => {
        const addTags = new AddTags();
        return () => addTags.destroy();
      }
    }, {
      id: "graph-view",
      isEnabled: enabled("graphView"),
      start: () => {
        const graphView = new GraphView();
        return () => graphView.destroy();
      }
    }, {
      id: "toolbar-buttons",
      start: () => registerAllButtons()
    }, {
      id: "item-activity",
      start: () => registerNotify(["tab", "item"], handleItemActivity)
    }, {
      id: "zotero-patches",
      start: () => patchAll()
    }, {
      id: "menu-visibility",
      isEnabled: enabled("menuVisibility"),
      start: () => {
        const feature = new MenuVisibilityManager();
        return () => feature.destroy();
      }
    }, {
      id: "storage",
      start: () => initStorage()
    }, {
      id: "item-tree",
      start: context => startDeferredItemTree(context, new ItemTree(), reportFeatureFailure)
    }, {
      id: "reading-time-recorder",
      isEnabled: () => Boolean(getPref("readingProgress.recordingEnabled")),
      start: ({
        addon: addon2
      }) => {
        const record = new Record();
        addon2.api.record = record;
        return () => {
          record.destroy();
          delete addon2.api.record;
        };
      }
    }, {
      id: "preference-manager",
      isEnabled: enabled("prefsManager"),
      start: () => {
        const feature = new PrefsManager();
        return () => feature.destroy();
      }
    }, {
      id: "custom-style",
      start: ({
        window: window2
      }) => addStyle(window2.document)
    }];
  }
  export function createFinalFeatures(shutdownSignal) {
    return [{
      id: "nested-tags",
      isEnabled: enabled("tags"),
      start: () => initTags(shutdownSignal)
    }, {
      id: "view-manager",
      isEnabled: enabled("viewManager"),
      start: () => {
        const viewManager = new ViewManager();
        return () => viewManager.destroy();
      }
    }, {
      id: "collection-tree",
      start: () => initCollectionTree()
    }, {
      id: "commands",
      isEnabled: enabled("commands"),
      start: () => registerAllCommands()
    }, {
      id: "fulltext-translate",
      isEnabled: enabled("fulltextTranslate"),
      start: () => {
        const feature = new FulltextTranslate();
        return () => feature.destroy();
      }
    }];
  }
