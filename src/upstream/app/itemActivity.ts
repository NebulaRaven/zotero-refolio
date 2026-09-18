import { getCurrentUTCTime,isEnabel } from "../utils/base.ts";
  // src/app/itemActivity.ts
  export async function handleItemActivity(event, type, ids, extraData) {
    if (type === "item") {
      addon.data.cache = {};
    }
    if (type !== "tab" || !isEnabel("updateItemDateModified")) {
      return;
    }
    const itemID = getNotifiedTabItemID(event, ids, extraData);
    if (!itemID) {
      return;
    }
    const item = Zotero.Items.get(itemID);
    if (!item) {
      return;
    }
    const timestamp = getCurrentUTCTime();
    const itemsToSave = item.topLevelItem === item ? [item] : [item, item.topLevelItem];
    for (const itemToSave of itemsToSave) {
      itemToSave.dateModified = timestamp;
      await itemToSave.saveTx({
        skipDateModifiedUpdate: true
      });
    }
  }
  export function getNotifiedTabItemID(event, ids, extraData) {
    if (event === "close") {
      const tabs = Zotero_Tabs;
      return tabs._history?.slice(-1)[0]?.[0]?.data?.itemID;
    }
    return extraData?.[ids[0]]?.itemID || Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)?._item?.id || undefined;
  }

