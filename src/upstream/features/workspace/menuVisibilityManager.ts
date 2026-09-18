interface MenuEntry { key: string; label: string; displayLabel: string; depth: number; icon: string; parent: string; }
interface SavedMenu { el: HTMLElement; parent: HTMLElement; nextSibling: Node | null; attributes: Array<{ name: string; value: string | null }>; }
import { setPref } from "../../utils/prefs.ts";
import { config } from "../../config.ts";
import { getElements,getNodes } from "../../utils/dom.ts";
import { getString } from "../../utils/locale.ts";
import { replaceOwnedProperty } from "../../utils/ownedResource.ts";
  // src/features/workspace/menuVisibilityManager.ts
  export class MenuVisibilityManager {
    declare manageMenuId: string;
    declare menuCache: MenuEntry[];
    declare defaultMenuCache: MenuEntry[];
    declare hiddenLabelsCache: string[];
    declare menuOrderCache: Record<string, any>;
    declare elementKeyCache: WeakMap<WeakKey, any>;
    declare isEnforcing: boolean;
    declare hiddenElements: SavedMenu[];
    declare generatedElements: HTMLElement[];
    declare originalChildOrders: Map<any, any>;
    declare openingManageDialog: boolean;
    declare contextMenusRegistered: boolean;
    declare destroyed: boolean;
    declare prefKey: string;
    declare orderPrefKey: string;
    declare startupTimer: number;
    declare cleanupBuildHook: () => void;
    declare menuPopup: any;
    declare popupHiddenHandler: (event: any) => void;
    declare popupRestoreTimer: any;
    declare dialogHelper: any;

    constructor() {
      this.manageMenuId = "zotero-gpt-manage-menu";
      this.menuCache = [];
      this.defaultMenuCache = [];
      // captured once at first load, used for reset
      this.hiddenLabelsCache = [];
      this.menuOrderCache = {};
      this.elementKeyCache = /* @__PURE__ */new WeakMap();
      this.isEnforcing = false;
      this.hiddenElements = [];
      this.generatedElements = [];
      this.originalChildOrders = /* @__PURE__ */new Map();
      this.openingManageDialog = false;
      this.contextMenusRegistered = false;
      this.destroyed = false;
      this.prefKey = `${config.addonRef}.hiddenMenu`;
      this.orderPrefKey = `${config.addonRef}.menuOrder`;
      this.syncHiddenMenusFromPrefs();
      this.syncMenuOrderFromPrefs();
      this.startupTimer = window.setTimeout(() => {
        this.startupTimer = undefined;
        if (this.destroyed) {
          return;
        }
        this.registerContextMenus();
        this.applyBuildHook();
      }, 1500);
    }
    syncHiddenMenusFromPrefs() {
      try {
        const hiddenPref = Zotero.Prefs.get(this.prefKey);
        const parsed = JSON.parse(String(hiddenPref || "[]"));
        this.hiddenLabelsCache = Array.isArray(parsed) ? Array.from(new Set(parsed.filter(value => typeof value === "string"))) : [];
      } catch (e) {
        ztoolkit.log("Failed to parse hidden menus", e);
        this.hiddenLabelsCache = [];
      }
    }
    syncMenuOrderFromPrefs() {
      try {
        const orderPref = Zotero.Prefs.get(this.orderPrefKey);
        if (!orderPref) {
          this.menuOrderCache = {};
          return;
        }
        const parsed = JSON.parse(String(orderPref));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          this.menuOrderCache = {};
          return;
        }
        const map = {};
        for (const [parentKey, order] of Object.entries(parsed)) {
          if (!Array.isArray(order)) {
            continue;
          }
          map[parentKey] = Array.from(new Set(order.filter(value => typeof value === "string")));
        }
        this.menuOrderCache = map;
      } catch (e) {
        ztoolkit.log("Failed to parse menu order", e);
        this.menuOrderCache = {};
      }
    }
    getHiddenMenus() {
      return this.hiddenLabelsCache;
    }
    setHiddenMenus(hiddenList: string[]) {
      const normalized = Array.from(new Set(hiddenList.filter(Boolean)));
      Zotero.Prefs.set(this.prefKey, JSON.stringify(normalized));
      this.hiddenLabelsCache = normalized;
    }
    getMenuOrder() {
      if (!this.menuOrderCache || typeof this.menuOrderCache !== "object" || Array.isArray(this.menuOrderCache)) {
        this.menuOrderCache = {};
      }
      return this.menuOrderCache;
    }
    setMenuOrder(map: Record<string, string[]>) {
      const normalized = {};
      for (const [parentKey, order] of Object.entries(map)) {
        normalized[parentKey] = Array.from(new Set(order.filter(Boolean)));
      }
      Zotero.Prefs.set(this.orderPrefKey, JSON.stringify(normalized));
      this.menuOrderCache = normalized;
    }
    // Returns menuCache sorted by the saved OrderMap, preserving parent-child structure
    getSortedMenus() {
      const orderMap = this.getMenuOrder();
      if (!orderMap || Object.keys(orderMap).length === 0) {
        return this.menuCache;
      }
      const result = [];
      const addGroup = parentKey => {
        const items = this.menuCache.filter(m => m.parent === parentKey);
        const order = orderMap[parentKey];
        if (order && order.length > 0) {
          items.sort((a, b) => {
            const idxA = order.indexOf(a.key);
            const idxB = order.indexOf(b.key);
            if (idxA === -1 && idxB === -1) {
              return 0;
            }
            if (idxA === -1) {
              return 1;
            }
            if (idxB === -1) {
              return -1;
            }
            return idxA - idxB;
          });
        }
        for (const item of items) {
          result.push(item);
          addGroup(item.key);
        }
      };
      addGroup("_root");
      const added = new Set(result.map(m => m.key));
      this.menuCache.filter(m => !added.has(m.key)).forEach(m => result.push(m));
      return result;
    }
    getMenuLabel(el) {
      const label = el.getAttribute("label") || el.label;
      if (label) {
        return label.trim();
      }
      let directText = "";
      for (const node of getNodes(el.childNodes)) {
        if (node.nodeType === window.Node.TEXT_NODE) {
          directText += node.textContent;
        } else if (node.nodeType === window.Node.ELEMENT_NODE) {
          const tag = (node as Element).tagName.toLowerCase();
          if (tag !== "menupopup" && tag !== "menu") {
            directText += node.textContent;
          }
        }
      }
      if (directText.trim()) {
        return directText.trim();
      }
      const fallback = el.getAttribute("data-l10n-id") || el.id || "";
      if (fallback) {
        return fallback;
      } else {
        return "";
      }
    }
    getOriginalLabel(el) {
      if (el.hasAttribute("data-gpt-original-label")) {
        return el.getAttribute("data-gpt-original-label");
      }
      return this.getMenuLabel(el);
    }
    makeMenuKey(path) {
      return `path:${path.map(part => encodeURIComponent(part)).join("/")}`;
    }
    getMenuPath(el, root) {
      const label = this.getOriginalLabel(el);
      if (!label) {
        return [];
      }
      let current = el.parentElement;
      const path = [];
      while (current && current !== root) {
        if (current.tagName.toLowerCase() === "menu") {
          const parentLabel = this.getOriginalLabel(current);
          if (parentLabel) {
            path.unshift(parentLabel);
          }
        }
        current = current.parentElement;
      }
      path.push(label);
      return path;
    }
    getElementKey(el, root) {
      const cachedKey = this.elementKeyCache.get(el);
      if (cachedKey) {
        return cachedKey;
      }
      const path = this.getMenuPath(el, root);
      if (path.length > 0) {
        return this.makeMenuKey(path);
      } else {
        return "";
      }
    }
    getOrderIndex(order, el, root) {
      const key = this.getElementKey(el, root);
      const label = this.getOriginalLabel(el);
      const keyIndex = key ? order.indexOf(key) : -1;
      if (keyIndex !== -1) {
        return keyIndex;
      } else {
        return order.indexOf(label);
      }
    }
    orderIncludesElement(order, el, root) {
      return this.getOrderIndex(order, el, root) !== -1;
    }
    isHiddenMenu(hiddenMenus, key, label) {
      return hiddenMenus.has(key) || hiddenMenus.has(label);
    }
    captureAttributes(el, names) {
      return names.map(name => ({
        name,
        value: el.hasAttribute(name) ? el.getAttribute(name) : null
      }));
    }
    restoreAttributes(el, attributes) {
      for (const {
        name,
        value
      } of attributes) {
        if (value === null) {
          el.removeAttribute(name);
        } else {
          el.setAttribute(name, value);
        }
      }
    }
    normalizeHiddenMenusForCurrentCache() {
      const hiddenMenus = this.getHiddenMenus();
      const hiddenSet = new Set(hiddenMenus);
      let changed = false;
      for (const menu of this.menuCache) {
        if (!hiddenMenus.includes(menu.label)) {
          continue;
        }
        hiddenSet.add(menu.key);
        changed = true;
      }
      if (changed) {
        for (const menu of this.menuCache) {
          hiddenSet.delete(menu.label);
        }
      }
      if (changed) {
        this.setHiddenMenus(Array.from(hiddenSet));
      }
    }
    normalizeMenuOrderForCurrentCache() {
      const orderMap = this.getMenuOrder();
      if (!orderMap || Object.keys(orderMap).length === 0) {
        return;
      }
      const normalized = {};
      let changed = false;
      const addOrderValue = (order, value) => {
        if (!order.includes(value)) {
          order.push(value);
        }
      };
      const resolveParentKeys = parentKey => {
        if (parentKey === "_root" || parentKey.startsWith("path:")) {
          return [parentKey];
        }
        const matches = this.menuCache.filter(menu => menu.label === parentKey).map(menu => menu.key);
        if (matches.length > 0) {
          return matches;
        } else {
          return [parentKey];
        }
      };
      for (const [storedParentKey, storedOrder] of Object.entries(orderMap)) {
        const parentKeys = resolveParentKeys(storedParentKey);
        if (parentKeys.length !== 1 || parentKeys[0] !== storedParentKey) {
          changed = true;
        }
        for (const parentKey of parentKeys) {
          const nextOrder = normalized[parentKey] ?? [];
          for (const storedValue of storedOrder) {
            if (storedValue.startsWith("path:")) {
              addOrderValue(nextOrder, storedValue);
              continue;
            }
            const matchingChildren = this.menuCache.filter(menu => menu.parent === parentKey && menu.label === storedValue);
            if (matchingChildren.length === 0) {
              addOrderValue(nextOrder, storedValue);
            } else {
              changed = true;
              matchingChildren.forEach(menu => addOrderValue(nextOrder, menu.key));
            }
          }
          normalized[parentKey] = nextOrder;
        }
      }
      if (changed) {
        this.setMenuOrder(normalized);
      }
    }
    isNativelyHidden(el) {
      if (el.getAttribute("data-gpt-hidden") === "true") {
        return false;
      }
      const htmlEl = el;
      if (htmlEl.hidden || el.getAttribute("hidden") === "true" || el.getAttribute("hidden") === "hidden") {
        return true;
      }
      if (el.getAttribute("collapsed") === "true") {
        return true;
      }
      return false;
    }
    isNativelyUnavailable(el, root) {
      let current = el;
      while (current && current !== root) {
        const tag = current.tagName.toLowerCase();
        if ((tag === "menu" || tag === "menuitem") && this.isNativelyHidden(current)) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }
    restoreElements() {
      for (const generatedElement of this.generatedElements) {
        generatedElement.remove();
      }
      this.generatedElements = [];
      for (const hiddenElement of [...this.hiddenElements].reverse()) {
        this.restoreAttributes(hiddenElement.el, hiddenElement.attributes);
        if (hiddenElement.el.parentNode !== hiddenElement.parent) {
          const nextSibling = hiddenElement.nextSibling?.parentNode === hiddenElement.parent ? hiddenElement.nextSibling : null;
          hiddenElement.parent.insertBefore(hiddenElement.el, nextSibling);
        }
      }
      this.hiddenElements = [];
      for (const [parent, children] of this.originalChildOrders) {
        const availableChildren = children.filter(child => child.parentNode === parent);
        const originalChildren = new Set(availableChildren);
        for (let i = 0; i < availableChildren.length; i++) {
          const currentChildren = getNodes(parent.childNodes).filter(child => originalChildren.has(child));
          const current = currentChildren[i];
          if (current && current !== availableChildren[i]) {
            parent.insertBefore(availableChildren[i], current);
          }
        }
      }
      this.originalChildOrders.clear();
    }
    dispatchOriginalCommand(original) {
      const doCommand = original.doCommand;
      if (typeof doCommand === "function") {
        doCommand.call(original);
        return;
      }
      const view = original.ownerDocument.defaultView;
      const EventConstructor = view?.Event;
      if (!EventConstructor) {
        return;
      }
      original.dispatchEvent(new EventConstructor("command", {
        bubbles: true,
        cancelable: true
      }));
    }
    createMenuProxy(original, displayLabel) {
      const proxy = original.cloneNode(true);
      proxy.setAttribute("data-style-menu-proxy", "true");
      proxy.setAttribute("label", displayLabel);
      proxy.removeAttribute("data-l10n-id");
      proxy.removeAttribute("hidden");
      proxy.removeAttribute("collapsed");
      const originalElements = [original, ...getElements(original.querySelectorAll("*"))];
      const proxyElements = [proxy, ...getElements(proxy.querySelectorAll("*"))];
      proxyElements.forEach((proxyElement, index) => {
        proxyElement.removeAttribute("id");
        proxyElement.removeAttribute("hidden");
        proxyElement.removeAttribute("collapsed");
        if (proxyElement.tagName.toLowerCase() !== "menuitem") {
          return;
        }
        const originalElement = originalElements[index];
        if (!originalElement) {
          return;
        }
        proxyElement.removeAttribute("command");
        proxyElement.removeAttribute("oncommand");
        proxyElement.removeAttribute("onclick");
        proxyElement.addEventListener("command", event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.dispatchOriginalCommand(originalElement);
        });
      });
      return proxy;
    }
    enforceVisibility(popup) {
      if (this.isEnforcing) {
        return;
      }
      this.isEnforcing = true;
      try {
        this.restoreElements();
        this.buildMenuCache(popup);
        this.normalizeHiddenMenusForCurrentCache();
        this.normalizeMenuOrderForCurrentCache();
        this.applyMenuOrder(popup);
        const hiddenLabels = this.getHiddenMenus();
        const hiddenLabelSet = new Set(hiddenLabels);
        const itemNode = popup.querySelector(`#${this.manageMenuId}-item`);
        const menuNode = popup.querySelector(`#${this.manageMenuId}-menu`);
        if (!itemNode || !menuNode) {
          return;
        }
        const subPopup = menuNode.querySelector("menupopup");
        if (subPopup) {
          const candidates = getElements(popup.querySelectorAll("menuitem, menu")).filter(el => {
            if ((el.id || "").startsWith(this.manageMenuId)) {
              return false;
            }
            if (el.closest(`#${this.manageMenuId}-menu`)) {
              return false;
            }
            if (this.isNativelyUnavailable(el, popup)) {
              return false;
            }
            return true;
          }).map(el => ({
            el,
            label: this.getOriginalLabel(el),
            key: this.getElementKey(el, popup),
            displayLabel: this.getMenuPath(el, popup).join(" - ")
          })).filter(candidate => candidate.label && candidate.key && this.isHiddenMenu(hiddenLabelSet, candidate.key, candidate.label));
          const hiddenElements = new Set(candidates.map(candidate => candidate.el));
          const hasHiddenAncestor = el => {
            let ancestor = el.parentElement;
            while (ancestor && ancestor !== popup) {
              if (hiddenElements.has(ancestor)) {
                return true;
              }
              ancestor = ancestor.parentElement;
            }
            return false;
          };
          for (const {
            el,
            label,
            displayLabel
          } of candidates) {
            if (hasHiddenAncestor(el)) {
              continue;
            }
            const parent = el.parentElement;
            if (!parent) {
              continue;
            }
            const attributes = this.captureAttributes(el, ["hidden", "collapsed", "data-gpt-hidden"]);
            const proxy = this.createMenuProxy(el, displayLabel || label);
            subPopup.appendChild(proxy);
            this.generatedElements.push(proxy);
            const htmlEl = el;
            const nextSibling = el.nextSibling;
            if (!this.originalChildOrders.has(parent)) {
              this.originalChildOrders.set(parent, getNodes(parent.childNodes));
            }
            htmlEl.hidden = true;
            htmlEl.setAttribute("hidden", "true");
            htmlEl.setAttribute("data-gpt-hidden", "true");
            parent.removeChild(el);
            this.hiddenElements.push({
              el,
              parent,
              nextSibling,
              attributes
            });
          }
        }
        this.updateManageMenuState(popup);
      } finally {
        this.isEnforcing = false;
      }
    }
    updateManageMenuState(popup) {
      const hiddenMenus = new Set(this.getHiddenMenus());
      const count = this.menuCache.filter(menu => this.isHiddenMenu(hiddenMenus, menu.key, menu.label)).length;
      const itemNode = popup.querySelector(`#${this.manageMenuId}-item`);
      const menuNode = popup.querySelector(`#${this.manageMenuId}-menu`);
      if (!itemNode || !menuNode) {
        return;
      }
      if (count === 0) {
        itemNode.hidden = false;
        itemNode.removeAttribute("hidden");
        menuNode.hidden = true;
        menuNode.setAttribute("hidden", "true");
        return;
      }
      itemNode.hidden = true;
      itemNode.setAttribute("hidden", "true");
      menuNode.hidden = false;
      menuNode.removeAttribute("hidden");
      menuNode.setAttribute("label", getString("menu-visibility-hidden-count", {
        args: {
          count
        }
      }));
    }
    // Called only while the native popup is closed. Never move menu nodes while it is open.
    reorderChildren(parent, order, root) {
      const items = getElements(parent.children).filter(el => {
        const tag = el.tagName.toLowerCase();
        if (tag !== "menuitem" && tag !== "menu") {
          return false;
        }
        if ((el.id || "").startsWith(this.manageMenuId)) {
          return false;
        }
        return this.orderIncludesElement(order, el, root);
      });
      if (items.length < 2) {
        return;
      }
      const sorted = [...items].sort((a, b) => {
        const idxA = this.getOrderIndex(order, a, root);
        const idxB = this.getOrderIndex(order, b, root);
        return idxA - idxB;
      });
      if (items.every((el, i) => el === sorted[i])) {
        return;
      }
      if (!this.originalChildOrders.has(parent)) {
        this.originalChildOrders.set(parent, getNodes(parent.childNodes));
      }
      for (let i = 0; i < sorted.length; i++) {
        const currentItems = getElements(parent.children).filter(el => items.includes(el));
        const current = currentItems[i];
        if (current && current !== sorted[i]) {
          parent.insertBefore(sorted[i], current);
        }
      }
    }
    applyMenuOrder(popup) {
      const orderMap = this.getMenuOrder();
      if (!orderMap || Object.keys(orderMap).length === 0) {
        return;
      }
      const rootOrder = orderMap._root;
      if (rootOrder && rootOrder.length >= 2) {
        this.reorderChildren(popup, rootOrder, popup);
      }
      for (const [parentLabel, childOrder] of Object.entries(orderMap)) {
        if (parentLabel === "_root" || !childOrder || childOrder.length < 2) {
          continue;
        }
        const parentEl = getElements(popup.querySelectorAll("menu")).find(el => {
          if (el.closest(`#${this.manageMenuId}-menu`)) {
            return false;
          }
          return this.getElementKey(el, popup) === parentLabel || this.getOriginalLabel(el) === parentLabel;
        });
        if (!parentEl) {
          continue;
        }
        const subPopupEl = getElements(parentEl.children).find(c => c.tagName.toLowerCase() === "menupopup");
        if (!subPopupEl) {
          continue;
        }
        this.reorderChildren(subPopupEl, childOrder, popup);
      }
    }
    applyBuildHook() {
      const mainWindow = Zotero.getMainWindow();
      if (!mainWindow) {
        return;
      }
      const menuPopup = mainWindow.document.getElementById("zotero-itemmenu");
      if (!menuPopup) {
        return;
      }
      const zoteroPane = mainWindow.ZoteroPane;
      if (!zoteroPane || typeof zoteroPane.buildItemContextMenu !== "function") {
        return;
      }
      const original = zoteroPane.buildItemContextMenu;
      const patched = (...args) => {
        if (this.destroyed) {
          return original.apply(zoteroPane, args);
        }
        this.restoreElements();
        const result = original.apply(zoteroPane, args);
        if (result && typeof result.then === "function") {
          return result.then(value => {
            if (!this.destroyed) {
              this.enforceVisibility(menuPopup);
            }
            return value;
          });
        }
        this.enforceVisibility(menuPopup);
        return result;
      };
      this.cleanupBuildHook = replaceOwnedProperty(zoteroPane, "buildItemContextMenu", patched);
      this.menuPopup = menuPopup;
      this.popupHiddenHandler = event => {
        if (event.target !== menuPopup) {
          return;
        }
        if (this.popupRestoreTimer !== undefined) {
          mainWindow.clearTimeout(this.popupRestoreTimer);
        }
        this.popupRestoreTimer = mainWindow.setTimeout(() => {
          this.popupRestoreTimer = undefined;
          if (!this.destroyed) {
            this.restoreElements();
          }
        }, 0);
      };
      menuPopup.addEventListener("popuphidden", this.popupHiddenHandler);
    }
    destroy() {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      if (this.startupTimer !== undefined) {
        window.clearTimeout(this.startupTimer);
        this.startupTimer = undefined;
      }
      if (this.popupRestoreTimer !== undefined) {
        window.clearTimeout(this.popupRestoreTimer);
        this.popupRestoreTimer = undefined;
      }
      if (this.menuPopup && this.popupHiddenHandler) {
        this.menuPopup.removeEventListener("popuphidden", this.popupHiddenHandler);
      }
      this.popupHiddenHandler = undefined;
      this.dialogHelper?.window?.close?.();
      this.dialogHelper = undefined;
      this.cleanupBuildHook?.();
      this.cleanupBuildHook = undefined;
      this.restoreElements();
      ztoolkit.Menu.unregister(`${this.manageMenuId}-item`);
      ztoolkit.Menu.unregister(`${this.manageMenuId}-menu`);
      ztoolkit.Menu.unregister(`${this.manageMenuId}-manage-btn`);
      ztoolkit.Menu.unregister(`${this.manageMenuId}-disable-btn`);
      ztoolkit.Menu.unregister(`${this.manageMenuId}-separator`);
      this.contextMenusRegistered = false;
    }
    buildMenuCache(menuPopup) {
      const results = [];
      const seenKeys = /* @__PURE__ */new Set();
      this.elementKeyCache = /* @__PURE__ */new WeakMap();
      const getUniqueKey = path => {
        const baseKey = this.makeMenuKey(path);
        let key = baseKey;
        let duplicateIndex = 2;
        while (seenKeys.has(key)) {
          key = `${baseKey}~${duplicateIndex++}`;
        }
        seenKeys.add(key);
        return key;
      };
      const traverse = (node: Element, depth: number, currentPath: string[], parentKey: string) => {
        if (!node) {
          return;
        }
        for (const child of Array.from(node.children)) {
          if (child.id === `${this.manageMenuId}-item` || child.id === `${this.manageMenuId}-menu` || child.id === `${this.manageMenuId}-manage-btn` || child.id === `${this.manageMenuId}-separator`) {
            continue;
          }
          if (this.isNativelyHidden(child)) {
            continue;
          }
          const tag = child.tagName.toLowerCase();
          if (tag === "menuitem" || tag === "menu") {
            const label = this.getOriginalLabel(child);
            const path = label ? [...currentPath, label] : currentPath;
            const key = label ? getUniqueKey(path) : "";
            if (label && key) {
              this.elementKeyCache.set(child, key);
              results.push({
                key,
                label,
                displayLabel: path.join(" - "),
                depth,
                icon: child.getAttribute("image") || "",
                parent: parentKey
              });
            }
            traverse(child, depth + 1, path, key || parentKey);
          } else if (tag === "menupopup" || tag === "vbox") {
            traverse(child, depth, currentPath, parentKey);
          } else {
            traverse(child, depth, currentPath, parentKey);
          }
        }
      };
      traverse(menuPopup, 0, [], "_root");
      this.menuCache = results;
      if (this.defaultMenuCache.length === 0) {
        this.defaultMenuCache = [...results];
      }
    }
    async openManageDialog(useDefaultOrder = false) {
      if (this.destroyed || this.openingManageDialog) {
        return;
      }
      this.openingManageDialog = true;
      try {
        await this.openManageDialogImpl(useDefaultOrder);
      } finally {
        this.openingManageDialog = false;
      }
    }
    async openManageDialogImpl(useDefaultOrder = false) {
      if (this.destroyed) {
        return;
      }
      const hiddenMenus = new Set(this.getHiddenMenus());
      const allMenus = useDefaultOrder ? this.defaultMenuCache : this.getSortedMenus();
      if (allMenus.length === 0) {
        new ztoolkit.ProgressWindow("Refolio").createLine({
          text: getString("menu-visibility-load-first"),
          type: "fail"
        }).show().startCloseTimer(2500);
        return;
      }
      const HTML_NS = "http://www.w3.org/1999/xhtml";
      const buildRows = (doc, menus) => {
        const container = doc.getElementById("menu-rows-container");
        if (!container) {
          return;
        }
        container.innerHTML = "";
        container.style.position = "relative";
        const SVG_NS3 = "http://www.w3.org/2000/svg";
        const prevAc = container._dragAc;
        if (prevAc) {
          prevAc.abort();
        }
        const ac = new doc.defaultView.AbortController();
        container._dragAc = ac;
        const indicatorWrap = doc.createElementNS(HTML_NS, "div");
        indicatorWrap.style.cssText = "position:absolute; left:0; right:0; height:0; pointer-events:none; display:none; z-index:999;";
        const svg = doc.createElementNS(SVG_NS3, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "4");
        svg.style.overflow = "visible";
        const line = doc.createElementNS(SVG_NS3, "line");
        line.setAttribute("x1", "0");
        line.setAttribute("y1", "2");
        line.setAttribute("x2", "100%");
        line.setAttribute("y2", "2");
        line.setAttribute("stroke", "#0078d7");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-linecap", "round");
        svg.appendChild(line);
        indicatorWrap.appendChild(svg);
        container.appendChild(indicatorWrap);
        let dragSrcEl = null;
        let dragGroupEls = [];
        const showIndicator = (targetRow, isBottom) => {
          const rect = targetRow.getBoundingClientRect();
          const cRect = container.getBoundingClientRect();
          const y = (isBottom ? rect.bottom : rect.top) - cRect.top + container.scrollTop;
          indicatorWrap.style.top = `${y - 2}px`;
          indicatorWrap.style.display = "block";
          const depth = parseInt(dragSrcEl?.getAttribute("data-depth") || "0");
          line.setAttribute("x1", `${depth * 1.5}em`);
        };
        const hideIndicator = () => {
          indicatorWrap.style.display = "none";
        };
        const getGroupEls = srcRow => {
          const srcDepth = parseInt(srcRow.getAttribute("data-depth") || "0");
          const group = [];
          let sib = srcRow.nextElementSibling;
          while (sib) {
            if (!sib.hasAttribute("data-depth")) {
              break;
            }
            if (parseInt(sib.getAttribute("data-depth")) <= srcDepth) {
              break;
            }
            group.push(sib);
            sib = sib.nextElementSibling;
          }
          return group;
        };
        const doInsert = (toMove, targetRow, isBottom) => {
          if (isBottom) {
            let insertAfter = targetRow;
            const rowDepth = parseInt(targetRow.getAttribute("data-depth") || "0");
            let sib = targetRow.nextElementSibling;
            while (sib) {
              if (toMove.includes(sib)) {
                break;
              }
              if (!sib.hasAttribute("data-depth")) {
                break;
              }
              if (parseInt(sib.getAttribute("data-depth")) <= rowDepth) {
                break;
              }
              insertAfter = sib;
              sib = sib.nextElementSibling;
            }
            const ref = insertAfter.nextSibling;
            for (const el of toMove) {
              container.insertBefore(el, ref);
            }
          } else {
            for (const el of toMove) {
              container.insertBefore(el, targetRow);
            }
          }
        };
        const getLastSameGroupRow = () => {
          const rows = Array.from<Element>(container.children).filter(el => el.hasAttribute("data-depth"));
          const srcDepth = dragSrcEl?.getAttribute("data-depth");
          const srcParent = dragSrcEl?.getAttribute("data-parent");
          for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            if (row === dragSrcEl || dragGroupEls.includes(row)) {
              continue;
            }
            if (row.getAttribute("data-depth") !== srcDepth) {
              continue;
            }
            if (row.getAttribute("data-parent") !== srcParent) {
              continue;
            }
            return row;
          }
          return null;
        };
        menus.forEach(menu => {
          const row = doc.createElementNS(HTML_NS, "div");
          row.setAttribute("draggable", "true");
          row.setAttribute("data-key", menu.key);
          row.setAttribute("data-label", menu.label);
          row.setAttribute("data-depth", String(menu.depth));
          row.setAttribute("data-parent", menu.parent);
          row.style.cssText = `
          display: flex; align-items: center;
          margin: 0; margin-left: ${menu.depth * 1.5}em;
          padding: 1px 4px; cursor: grab;
        `;
          const handle = doc.createElementNS(HTML_NS, "span");
          handle.textContent = "⠿";
          handle.style.cssText = "margin-right: 3px; color: #bbb; font-size: 1.1em; user-select: none; flex-shrink: 0; cursor: grab;";
          const checkbox = doc.createElementNS(HTML_NS, "input");
          checkbox.type = "checkbox";
          checkbox.className = "menu-visibility-checkbox";
          checkbox.setAttribute("data-key", menu.key);
          checkbox.setAttribute("data-label", menu.label);
          checkbox.checked = !this.isHiddenMenu(hiddenMenus, menu.key, menu.label);
          checkbox.style.cssText = "flex-shrink: 0; cursor: pointer; margin-right: 4px;";
          row.appendChild(handle);
          row.appendChild(checkbox);
          if (menu.icon) {
            const img = doc.createElementNS(HTML_NS, "img");
            img.src = menu.icon;
            img.style.cssText = "width: 14px; height: 14px; margin-right: 4px; flex-shrink: 0; object-fit: contain;";
            row.appendChild(img);
          }
          const labelEl = doc.createElementNS(HTML_NS, "span");
          labelEl.style.cssText = "font-size: 1em; user-select: none;";
          labelEl.textContent = menu.displayLabel || menu.label;
          row.appendChild(labelEl);
          row.addEventListener("dragstart", e => {
            dragSrcEl = row;
            dragGroupEls = getGroupEls(row);
            window.setTimeout(() => {
              row.style.opacity = "0.4";
              dragGroupEls.forEach(el => el.style.opacity = "0.4");
            }, 0);
            e.dataTransfer?.setData("text/plain", "");
          });
          row.addEventListener("dragend", () => {
            row.style.opacity = "1";
            dragGroupEls.forEach(el => el.style.opacity = "1");
            dragGroupEls = [];
            hideIndicator();
            dragSrcEl = null;
          });
          row.addEventListener("dragover", e => {
            e.preventDefault();
            if (!dragSrcEl || row === dragSrcEl || dragGroupEls.includes(row)) {
              return;
            }
            if (dragSrcEl.getAttribute("data-depth") !== row.getAttribute("data-depth") || dragSrcEl.getAttribute("data-parent") !== row.getAttribute("data-parent")) {
              hideIndicator();
              return;
            }
            const rect = row.getBoundingClientRect();
            const isBottom = e.clientY > rect.top + rect.height / 2;
            if (isBottom) {
              const rowDepth = parseInt(row.getAttribute("data-depth") || "0");
              const rowParent = row.getAttribute("data-parent");
              let sib = row.nextElementSibling;
              while (sib && sib.hasAttribute("data-depth") && parseInt(sib.getAttribute("data-depth")) > rowDepth) {
                sib = sib.nextElementSibling;
              }
              const nextSameGroup = sib && sib.hasAttribute("data-depth") && sib.getAttribute("data-depth") === row.getAttribute("data-depth") && sib.getAttribute("data-parent") === rowParent && sib !== dragSrcEl && !dragGroupEls.includes(sib) ? sib : null;
              if (nextSameGroup) {
                showIndicator(nextSameGroup, false);
              } else {
                showIndicator(row, true);
              }
            } else {
              showIndicator(row, false);
            }
          });
          row.addEventListener("drop", e => {
            e.preventDefault();
            e.stopPropagation();
            if (!dragSrcEl || row === dragSrcEl || dragGroupEls.includes(row) || dragSrcEl.getAttribute("data-depth") !== row.getAttribute("data-depth") || dragSrcEl.getAttribute("data-parent") !== row.getAttribute("data-parent")) {
              hideIndicator();
              dragSrcEl = null;
              dragGroupEls = [];
              return;
            }
            const rect = row.getBoundingClientRect();
            const isBottom = e.clientY > rect.top + rect.height / 2;
            doInsert([dragSrcEl, ...dragGroupEls], row, isBottom);
            [dragSrcEl, ...dragGroupEls].forEach(el => el.style.opacity = "1");
            hideIndicator();
            dragSrcEl = null;
            dragGroupEls = [];
          });
          container.appendChild(row);
        });
        container.addEventListener("dragleave", e => {
          const rel = e.relatedTarget;
          if (!rel || !container.contains(rel)) {
            hideIndicator();
          }
        }, {
          signal: ac.signal
        });
        container.addEventListener("dragover", e => e.preventDefault(), {
          signal: ac.signal
        });
        container.addEventListener("drop", e => {
          e.preventDefault();
          if (dragSrcEl) {
            const toMove = [dragSrcEl, ...dragGroupEls];
            const lastSameGroupRow = getLastSameGroupRow();
            if (lastSameGroupRow) {
              doInsert(toMove, lastSameGroupRow, true);
            }
            toMove.forEach(el => el.style.opacity = "1");
          }
          hideIndicator();
          dragSrcEl = null;
          dragGroupEls = [];
        }, {
          signal: ac.signal
        });
      };
      const dialogData: { loadCallback: () => void; unloadCallback: () => void; } & { _lastButtonId?: string; unloadLock?: { promise: Promise<void> } } = {
        loadCallback: () => {},
        unloadCallback: () => {}
      };
      const dialogHelperRef = new ztoolkit.Dialog(1, 1).addCell(0, 0, {
        tag: "vbox",
        id: "menu-rows-container",
        styles: {
          maxHeight: "500px",
          overflowY: "auto",
          paddingRight: "1em"
        }
      }).addButton(getString("menu-visibility-reset-order"), "reset").addButton(getString("menu-visibility-save"), "save").addButton(getString("menu-visibility-cancel"), "cancel").setDialogData(dialogData);
      this.dialogHelper = dialogHelperRef;
      dialogData.unloadCallback = () => {
        const container = dialogHelperRef.window?.document?.getElementById("menu-rows-container");
        container?._dragAc?.abort();
        if (this.dialogHelper === dialogHelperRef) {
          this.dialogHelper = undefined;
        }
      };
      dialogData.loadCallback = () => {
        const win = dialogHelperRef?.window;
        if (!win) {
          return;
        }
        buildRows(win.document, allMenus);
      };
      dialogHelperRef.open(getString("menu-visibility-settings-title"));
      await dialogData.unloadLock.promise;
      if (this.destroyed) {
        return;
      }
      if (dialogData._lastButtonId === "reset") {
        await this.openManageDialogImpl(true);
        return;
      }
      if (dialogData._lastButtonId === "save") {
        const win = dialogHelperRef.window;
        const container = win.document.getElementById("menu-rows-container");
        const orderMap = {};
        if (container) {
          getElements(container.children).forEach(r => {
            const key = r.getAttribute("data-key");
            const parent = r.getAttribute("data-parent") || "_root";
            if (!key) {
              return;
            }
            if (!orderMap[parent]) {
              orderMap[parent] = [];
            }
            orderMap[parent].push(key);
          });
        }
        this.setMenuOrder(orderMap);
        const menuPopup = Zotero.getMainWindow()?.document.getElementById("zotero-itemmenu");
        if (menuPopup) {
          this.applyMenuOrder(menuPopup);
        }
        const checkboxes = Array.from<HTMLInputElement>(win.document.querySelectorAll("input.menu-visibility-checkbox"));
        const newHiddenSet = new Set(this.getHiddenMenus());
        checkboxes.forEach(chk => {
          const key = chk.getAttribute("data-key");
          const label = chk.getAttribute("data-label");
          if (!key) {
            return;
          }
          if (!chk.checked) {
            newHiddenSet.add(key);
          } else {
            newHiddenSet.delete(key);
            if (label) {
              newHiddenSet.delete(label);
            }
          }
        });
        this.setHiddenMenus(Array.from(newHiddenSet));
        new ztoolkit.ProgressWindow(getString("menu-visibility-settings-title")).createLine({
          text: getString("menu-visibility-saved"),
          type: "success"
        }).show().startCloseTimer(2000);
      }
    }
    registerContextMenus() {
      if (this.destroyed || this.contextMenusRegistered) {
        return;
      }
      this.contextMenusRegistered = true;
      const baseIcon = `chrome://${config.addonRef}/content/icons/hiddenMenu.png`;
      ztoolkit.Menu.register("item", {
        tag: "menuitem",
        id: `${this.manageMenuId}-item`,
        label: getString("menu-visibility-hide-with-ellipsis"),
        icon: baseIcon,
        commandListener: () => {
          this.openManageDialog().catch(error => ztoolkit.log("Menu visibility dialog failed", error));
        }
      });
      ztoolkit.Menu.register("item", {
        tag: "menu",
        id: `${this.manageMenuId}-menu`,
        label: getString("menu-visibility-hide"),
        icon: baseIcon,
        children: [{
          tag: "menuitem",
          id: `${this.manageMenuId}-manage-btn`,
          icon: baseIcon,
          label: getString("menu-visibility-manage"),
          commandListener: () => {
            this.openManageDialog().catch(error => ztoolkit.log("Menu visibility dialog failed", error));
          }
        }, {
          tag: "menuitem",
          id: `${this.manageMenuId}-disable-btn`,
          label: getString("menu-visibility-disable"),
          commandListener: () => {
            if (this.destroyed) {
              return;
            }
            setPref(`function.menuVisibility.enable`, false);
            new ztoolkit.ProgressWindow(getString("menu-visibility-disable")).createLine({
              text: getString("menu-visibility-disabled-success"),
              type: "success"
            }).show().startCloseTimer(3000);
          }
        }, {
          tag: "menuseparator",
          id: `${this.manageMenuId}-separator`
        }]
      });
    }
  };
