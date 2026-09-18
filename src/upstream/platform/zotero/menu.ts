import { config } from "../../config.ts";
  // src/platform/zotero/menu.ts
  export function ownTemporaryMenuPopup(menupopup, onRelease = () => {}) {
    let active = true;
    const removeWhenHidden = event => {
      if (event.target === menupopup) {
        release();
      }
    };
    const release = () => {
      if (!active) {
        return;
      }
      active = false;
      menupopup.removeEventListener("popuphidden", removeWhenHidden);
      try {
        onRelease();
      } finally {
        menupopup.remove();
      }
    };
    menupopup.addEventListener("popuphidden", removeWhenHidden);
    return release;
  }
  export function buildMenuPopup(position, children) {
    const popupID = config.addonRef + "-menupopup";
    document.querySelectorAll(`#${popupID}`).forEach(existing => existing.remove());
    const menupopup = ztoolkit.UI.appendElement({
      namespace: "xul",
      tag: "menupopup",
      id: popupID,
      children
    }, document.querySelector("popupset"));
    const releasePopup = ownTemporaryMenuPopup(menupopup);
    try {
      if (position.node) {
        menupopup.openPopup(position.node, "after_start");
      } else {
        menupopup.openPopupAtScreen(position.x, position.y, true);
      }
    } catch (error) {
      releasePopup();
      throw error;
    }
    const winRect = document.documentElement.getBoundingClientRect();
    const nodeRect = menupopup.getBoundingClientRect();
    if (nodeRect.bottom > winRect.bottom) {
      menupopup.style.top = "";
      menupopup.style.bottom = "0px";
    }
    return menupopup;
  }

