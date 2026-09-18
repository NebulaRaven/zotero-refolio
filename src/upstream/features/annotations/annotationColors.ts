import { config } from "../../config.ts";
import { findAnnotationColorName,isAnnotationColorLocalizationID,parseAnnotationColorNames } from "./annotationColorNames.ts";
import { executeReaderOuterScript,getReaderInstances,getReaderOuterDocument,setReaderToolColors } from "../../utils/reader.ts";
import { buildAnnotationColorBridgeCleanupSource,buildAnnotationColorBridgeSource } from "./annotationColorBridge.ts";
import { getElements } from "../../utils/dom.ts";
  // src/features/annotations/annotationColors.ts
  export var COLORS_PREF = `${config.addonRef}.annotationColors`;
  export var COLORS_ENABLE_PREF = `${config.addonRef}.function.annotationColors.enable`;
  export var SHOW_NAMES_PREF = `${config.addonRef}.function.showAnnotationColorName.enable`;
  export var NAME_DIRECTION_PREF = `${config.addonRef}.annotationColorNameDirection`;
  export function readAnnotationColors() {
    return parseAnnotationColorNames(Zotero.Prefs.get(COLORS_PREF));
  }
  export function executeBridgeSource(reader, source) {
    try {
      executeReaderOuterScript(reader, source);
    } catch (error) {
      if (String(error).includes("Permission denied to pass object")) {
        return;
      }
      ztoolkit.log("[AnnotationColors] Reader integration failed", error);
    }
  }
  export function modifyAnnotationColors(reader) {
    if (!Zotero.Prefs.get(COLORS_ENABLE_PREF)) {
      executeBridgeSource(reader, buildAnnotationColorBridgeCleanupSource());
      return;
    }
    const colors = readAnnotationColors();
    if (colors[0]) {
      setReaderToolColors(reader, colors[0][1]);
    }
    executeBridgeSource(reader, buildAnnotationColorBridgeSource(colors));
    const doc = getReaderOuterDocument(reader);
    if (doc) {
      refreshRenderedColorNames(doc);
    }
  }
  export function getButtonColor(button) {
    return button.querySelector("svg path[fill^=\"#\"], svg rect[fill^=\"#\"]")?.getAttribute("fill") ?? undefined;
  }
  export function resetVisibleColorNameStyles(button) {
    Object.assign(button.style, {
      alignItems: "",
      alignSelf: "",
      boxSizing: "",
      display: "",
      flex: "",
      flexDirection: "",
      gap: "",
      height: "",
      justifyContent: "",
      maxWidth: "",
      minWidth: "",
      padding: "",
      width: ""
    });
  }
  export function applyAnnotationColorNamesToDocument(doc, colors, options) {
    const selectionButtons = getElements(doc.querySelectorAll(".selection-popup .colors button"));
    const selectionDisplayNames = selectionButtons.map((button, index) => {
      const configuredName = findAnnotationColorName(colors, getButtonColor(button)) ?? colors[index]?.[0];
      if (!configuredName) {
        return undefined;
      }
      if (isAnnotationColorLocalizationID(configuredName)) {
        return button.title;
      } else {
        return configuredName;
      }
    });
    const constrainSelectionButtons = options.showSelectionNames && selectionDisplayNames.some(Boolean);
    for (let index = 0; index < selectionButtons.length; index += 1) {
      const button = selectionButtons[index];
      const displayName = selectionDisplayNames[index];
      button.querySelector(".color-name")?.remove();
      resetVisibleColorNameStyles(button);
      if (displayName) {
        button.title = displayName;
        button.setAttribute("aria-label", displayName);
      }
      if (!constrainSelectionButtons) {
        continue;
      }
      Object.assign(button.style, {
        alignItems: "center",
        // Reader's color row centers variable-height buttons by default. Keep
        // the color swatches on one baseline when vertical labels have lengths
        // that differ.
        alignSelf: options.direction === "vertical" ? "flex-start" : "",
        boxSizing: "border-box",
        display: "inline-flex",
        flex: "1 1 0",
        flexDirection: options.direction === "horizontal" ? "row" : "column",
        gap: options.direction === "horizontal" ? "5px" : "4px",
        height: "auto",
        justifyContent: "center",
        maxWidth: "100%",
        minWidth: "0",
        padding: "3px",
        width: "auto"
      });
      if (!displayName) {
        continue;
      }
      const name = doc.createElement("span");
      name.className = "color-name";
      Object.assign(name.style, {
        display: "inline-block",
        lineHeight: "1.1",
        margin: "0",
        maxWidth: "100%",
        minWidth: "0",
        overflowWrap: "anywhere",
        textOrientation: options.direction === "vertical" ? "upright" : "mixed",
        writingMode: options.direction === "vertical" ? "vertical-rl" : "horizontal-tb"
      });
      name.textContent = displayName;
      button.append(name);
    }
    for (const button of getElements(doc.querySelectorAll("#selector .colors button.color"))) {
      const configuredName = findAnnotationColorName(colors, getButtonColor(button));
      if (!configuredName) {
        continue;
      }
      const displayName = isAnnotationColorLocalizationID(configuredName) ? button.title : configuredName;
      if (!displayName) {
        continue;
      }
      button.title = displayName;
      button.setAttribute("aria-label", displayName);
    }
  }
  export function refreshRenderedColorNames(doc) {
    const direction = Zotero.Prefs.get(NAME_DIRECTION_PREF) === "vertical" ? "vertical" : "horizontal";
    applyAnnotationColorNamesToDocument(doc, readAnnotationColors(), {
      showSelectionNames: Boolean(Zotero.Prefs.get(SHOW_NAMES_PREF)),
      direction
    });
  }
  export function registerAnnotationColors() {
    let active = true;
    const syncReader = async reader => {
      try {
        await reader._initPromise;
      } catch {
        return;
      }
      if (active) {
        modifyAnnotationColors(reader);
      }
    };
    const syncReaders = () => {
      for (const reader of getReaderInstances()) {
        syncReader(reader);
      }
    };
    const toolbarHandler = ({
      reader
    }) => {
      syncReader(reader);
    };
    Zotero.Reader.registerEventListener("renderToolbar", toolbarHandler, config.addonID);
    const prefObserver = Zotero.Prefs.registerObserver(COLORS_PREF, syncReaders);
    syncReaders();
    return () => {
      active = false;
      Zotero.Reader.unregisterEventListener("renderToolbar", toolbarHandler);
      Zotero.Prefs.unregisterObserver(prefObserver);
      for (const reader of getReaderInstances()) {
        executeBridgeSource(reader, buildAnnotationColorBridgeCleanupSource());
      }
    };
  }
  export function showAnnotationColorName() {
    const selectionHandler = ({
      doc
    }) => {
      refreshRenderedColorNames(doc);
    };
    const sidebarHandler = ({
      doc
    }) => {
      refreshRenderedColorNames(doc);
    };
    Zotero.Reader.registerEventListener("renderTextSelectionPopup", selectionHandler, config.addonID);
    Zotero.Reader.registerEventListener("renderSidebarAnnotationHeader", sidebarHandler, config.addonID);
    return () => {
      Zotero.Reader.unregisterEventListener("renderTextSelectionPopup", selectionHandler);
      Zotero.Reader.unregisterEventListener("renderSidebarAnnotationHeader", sidebarHandler);
    };
  }
  export function startAnnotationColorsFeature() {
    const cleanupColors = registerAnnotationColors();
    const cleanupNames = showAnnotationColorName();
    return () => {
      cleanupNames();
      cleanupColors();
    };
  }

