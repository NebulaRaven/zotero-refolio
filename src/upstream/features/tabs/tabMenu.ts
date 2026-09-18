import type { TabPopup } from '../../../types/ui.ts';
import { getElements } from "../../utils/dom.ts";
import { getString } from "../../utils/locale.ts";
  // src/features/tabs/tabMenu.ts
  export var STYLE_TAB_MENU_ATTR = "data-stylepersonal-tab-menu";
  export function patchTabMenu() {
    const container = document.querySelector<TabPopup>("#tab-bar-container");
    if (!container || container._tabMenuBound) {
      return () => {};
    }
    let active = true;
    const onContextMenu = async e => {
      if (!active) {
        return;
      }
      const tabID = e.target?.parentNode?.dataset.id;
      const itemID = Zotero_Tabs._tabs.find(i => i.id == tabID)?.data.itemID;
      if (itemID) {
        callAfterShowTabMenu(itemID, () => active);
      }
    };
    container._tabMenuBound = onContextMenu;
    container.addEventListener("contextmenu", onContextMenu);
    return () => {
      if (!active) {
        return;
      }
      active = false;
      container.removeEventListener("contextmenu", onContextMenu);
      if (container._tabMenuBound === onContextMenu) {
        delete container._tabMenuBound;
      }
    };
  }
  export async function callAfterShowTabMenu(itemID, isActive = () => true) {
    let t3 = 0;
    const getMenuPopup = () => {
      return getElements<TabPopup>(document.querySelectorAll("popupset menupopup")).find(i => i.state == "open");
    };
    while (isActive() && !getMenuPopup() && t3 < 10) {
      await Zotero.Promise.delay(10);
      t3 += 10 / 1000;
    }
    if (!isActive()) {
      return;
    }
    const menupopup = getMenuPopup();
    if (!menupopup || !menupopup.isConnected || !isActive()) {
      return;
    }
    const isMenuCurrent = () => isActive() && menupopup.isConnected && menupopup.state !== "closed";
    menupopup.querySelectorAll(`[${STYLE_TAB_MENU_ATTR}]`).forEach(element => element.remove());
    if (!isMenuCurrent()) {
      return;
    }
    ztoolkit.log(menupopup);
    ztoolkit.UI.appendElement({
      namespace: "xul",
      tag: "menuseparator",
      attributes: {
        [STYLE_TAB_MENU_ATTR]: "true"
      }
    }, menupopup);
    ztoolkit.UI.appendElement({
      namespace: "xul",
      tag: "menuitem",
      attributes: {
        label: getString("show-in-file-explorer"),
        [STYLE_TAB_MENU_ATTR]: "true"
      },
      listeners: [{
        type: "command",
        listener: async () => {
          if (!isActive()) {
            return;
          }
          await ZoteroPane.showItemsInFilesystem([await Zotero.Items.getAsync(itemID)]);
        }
      }]
    }, menupopup);
    if (addon.api.tabManager) {
      const menu = ztoolkit.UI.appendElement({
        tag: "menu",
        namespace: "xul",
        attributes: {
          label: getString("assign-to-tab-group"),
          [STYLE_TAB_MENU_ATTR]: "true"
        },
        children: [{
          namespace: "xul",
          tag: "menupopup"
        }]
      }, menupopup);
      const tabGroups = await addon.api.tabManager.getTabGroups();
      if (!isMenuCurrent() || !menu.isConnected) {
        return;
      }
      tabGroups.forEach(tg => {
        let isExist = false;
        if (tg.itemIDs.indexOf(itemID) >= 0) {
          isExist = true;
        }
        ztoolkit.UI.appendElement({
          tag: "menuitem",
          attributes: {
            label: tg.name,
            type: "checkbox",
            checked: isExist
          },
          listeners: [{
            type: "command",
            listener: async () => {
              if (!isActive()) {
                return;
              }
              if (isExist) {
                tg.itemIDs = tg.itemIDs.filter(i => i != itemID);
              } else {
                tg.itemIDs.push(itemID);
              }
              await addon.api.tabManager.setTabGroups(tabGroups);
            }
          }]
        }, menu.querySelector("menupopup"));
      });
    }
  }

