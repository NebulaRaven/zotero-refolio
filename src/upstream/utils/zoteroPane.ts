  // src/utils/zoteroPane.ts
  export function isItemsViewTreeReady(view) {
    const host = view;
    return Boolean(host?.tree && !host._uninitialized);
  }
  export async function waitForItemsViewTree(getView, isActive, delay) {
    while (isActive()) {
      const view = getView();
      if (isItemsViewTreeReady(view) && view?._itemsPaneMessage == null) {
        return true;
      }
      await delay();
    }
    return false;
  }
  export var columnResetGuards = /* @__PURE__ */new WeakMap();
  export function installItemTreeColumnResetGuard(target) {
    const existing = columnResetGuards.get(target);
    if (existing) {
      return existing.acquire();
    }
    const prototype = target;
    const original = prototype._resetColumns;
    if (typeof original !== "function") {
      return () => {};
    }
    let owners = 0;
    let installed = true;
    const pending = new Set<() => void>();
    const guarded = function (...args) {
      if (!("_columnsId" in this) || typeof this.forceUpdate !== "function") {
        return original.apply(this, args);
      }
      this._columnsId = null;
      if (!installed || !isItemsViewTreeReady(this)) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        const finish = () => {
          pending.delete(finish);
          resolve();
        };
        const fail = error => {
          pending.delete(finish);
          reject(error);
        };
        pending.add(finish);
        try {
          this.forceUpdate(() => {
            if (!installed || !isItemsViewTreeReady(this)) {
              finish();
              return;
            }
            try {
              Promise.resolve(this.tree?._resetColumns?.()).then(finish, fail);
            } catch (error) {
              fail(error);
            }
          });
        } catch (error) {
          fail(error);
        }
      });
    };
    prototype._resetColumns = guarded;
    const acquire = () => {
      owners++;
      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        if (--owners > 0) {
          return;
        }
        installed = false;
        for (const finish of pending) {
          finish();
        }
        if (prototype._resetColumns === guarded) {
          prototype._resetColumns = original;
        }
        columnResetGuards.delete(target);
      };
    };
    columnResetGuards.set(target, {
      acquire
    });
    return acquire();
  }
  export async function resetItemsViewColumns(view, isActive) {
    if (!isActive() || !isItemsViewTreeReady(view)) {
      return false;
    }
    const host = view;
    await host._resetColumns?.();
    return isActive() && isItemsViewTreeReady(view);
  }
  export function requireItemsView() {
    const itemsView = ZoteroPane.itemsView;
    if (!itemsView) {
      throw new Error("Zotero items view is not initialized.");
    }
    return itemsView;
  }
  export function requireCollectionsView() {
    const collectionsView = ZoteroPane.collectionsView;
    if (!collectionsView) {
      throw new Error("Zotero collections view is not initialized.");
    }
    return collectionsView;
  }
  export async function waitForCollectionsViewReady(collectionsView) {
    if (typeof collectionsView.waitForLoad === "function") {
      await collectionsView.waitForLoad();
    }
  }
  export function invalidateCollectionsViewRow(collectionsView, row) {
    const tree = collectionsView.tree;
    if (!tree) {
      return;
    }
    if (typeof tree.invalidateRow === "function") {
      tree.invalidateRow(row);
      return;
    }
    tree.invalidate?.();
  }
  export function refreshCollectionsViewRenderer(collectionsView) {
    const invalidateTree = () => {
      const tree = collectionsView.tree;
      if (tree && typeof tree.invalidate === "function") {
        tree.invalidate();
      }
    };
    const updateTree = () => {
      const tree = collectionsView.tree;
      if (tree && typeof tree.forceUpdate === "function") {
        tree.forceUpdate(invalidateTree);
        return;
      }
      invalidateTree();
    };
    if (typeof collectionsView.forceUpdate === "function") {
      collectionsView.forceUpdate(updateTree);
      return;
    }
    updateTree();
  }

