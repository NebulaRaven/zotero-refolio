import { getElements } from "../../utils/dom.ts";
  // src/features/collections/collectionItemCountDOM.ts
  export function createCollectionItemCountClassNames(addonRef) {
    return {
      count: `${addonRef}-collection-item-count`,
      owner: addonRef,
      spacer: `${addonRef}-collection-item-count-spacer`
    };
  }
  export function getDirectChildren(primary) {
    return getElements(primary.children);
  }
  export function isOwnedCollectionItemCountElement(element, classNames) {
    return element.classList.contains(classNames.owner);
  }
  export function findForeignNumericCount(primary, classNames) {
    return getDirectChildren(primary).find(element => {
      if (isOwnedCollectionItemCountElement(element, classNames)) {
        return false;
      }
      if (element.classList.contains("cell-text")) {
        return false;
      }
      return /^\d+$/.test((element.textContent || "").trim());
    });
  }
  export function removeOwnedCollectionItemCount(primary, classNames) {
    const removed = [];
    for (const element of getDirectChildren(primary)) {
      if (!isOwnedCollectionItemCountElement(element, classNames)) {
        continue;
      }
      element.remove();
      removed.push(element);
    }
    return removed;
  }
  export function removeOwnedCollectionItemCountIfConflicting(primary, classNames) {
    if (!findForeignNumericCount(primary, classNames)) {
      return false;
    }
    removeOwnedCollectionItemCount(primary, classNames);
    return true;
  }
  export function reconcileCollectionItemCount(primary, totalNumber, classNames) {
    if (findForeignNumericCount(primary, classNames)) {
      removeOwnedCollectionItemCount(primary, classNames);
      return {
        suppressedByForeignCount: true
      };
    }
    const children = getDirectChildren(primary);
    const owned = children.filter(element => isOwnedCollectionItemCountElement(element, classNames));
    let countNode = owned.find(element => element.classList.contains(classNames.count)) || owned.find(element => element.classList.contains("number"));
    let spacerNode = owned.find(element => element.classList.contains(classNames.spacer)) || owned.find(element => element !== countNode);
    for (const element of owned) {
      if (element === countNode || element === spacerNode) {
        continue;
      }
      element.remove();
    }
    const doc = primary.ownerDocument;
    if (!spacerNode) {
      spacerNode = doc.createElement("span");
    }
    if (!countNode) {
      countNode = doc.createElement("span");
    }
    spacerNode.classList.add(classNames.owner, classNames.spacer);
    spacerNode.classList.remove("number", classNames.count);
    spacerNode.textContent = "";
    spacerNode.style.display = "inline-block";
    spacerNode.style.flex = "1";
    countNode.classList.add(classNames.owner, classNames.count);
    countNode.classList.remove("number", classNames.spacer);
    countNode.textContent = String(totalNumber);
    countNode.style.flexShrink = "0";
    countNode.style.marginLeft = "1em";
    countNode.style.marginRight = "6px";
    primary.append(spacerNode, countNode);
    return {
      countNode,
      suppressedByForeignCount: false
    };
  }

