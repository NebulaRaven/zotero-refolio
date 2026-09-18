import { config } from "../../config.ts";
import { isEnabel } from "../../utils/base.ts";
  // src/features/workspace/buttons.ts
  export function registerDayNightButton() {
    const prefKey = "browser.theme.toolbar-theme";
    const isDark = () => Zotero.Prefs.get(prefKey, true) == 0;
    let active = true;
    const button = ztoolkit.UI.insertElementBefore({
      namespace: "xul",
      tag: "toolbarbutton",
      id: "dark-light-button",
      styles: {
        height: "28px",
        width: "28px",
        margin: "5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        pointerEvents: "auto !important",
        marginRight: "10px",
        borderRadius: "50%"
      },
      children: [{
        namespace: "xul",
        tag: "image",
        classList: ["toolbarbutton-icon"],
        styles: {
          listStyleImage: `url(chrome://${config.addonRef}/content/icons/${isDark() ? "light" : "dark"}.svg)`,
          fill: "currentColor"
        },
        attributes: {
          type: "panel"
        }
      }, {
        namespace: "xul",
        tag: "label",
        classList: ["toolbarbutton-text"],
        attributes: {
          crop: "right",
          flex: "1"
        }
      }],
      listeners: [{
        type: "click",
        listener: () => {
          Zotero.Prefs.set(prefKey, isDark() ? 1 : 0, true);
          updateImage();
        }
      }]
    }, document.querySelector("#tab-bar-container .tab-bar-inner-container .pinned-tabs"));
    const updateImage = () => {
      if (!active) {
        return;
      }
      const image = button.querySelector("image");
      image?.style.setProperty("list-style-image", `url(chrome://${config.addonRef}/content/icons/${isDark() ? "light" : "dark"}.svg)`);
    };
    updateImage();
    const observer = Zotero.Prefs.registerObserver(prefKey, () => {
      updateImage();
    }, true);
    return () => {
      if (!active) {
        return;
      }
      active = false;
      try {
        Zotero.Prefs.unregisterObserver(observer);
      } catch {}
      try {
        button.remove();
      } catch {}
    };
  }
  export function registerAllButtons() {
    if (isEnabel("darkLightButton")) {
      return registerDayNightButton();
    } else {
      return () => {};
    }
  }

