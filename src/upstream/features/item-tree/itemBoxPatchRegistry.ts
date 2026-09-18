  // src/features/item-tree/itemBoxPatchRegistry.ts
  export class ItemBoxPatchRegistry {
    declare onCleanupError: (error: unknown) => void;
    declare cleanups: Map<any, any>;

    constructor(onCleanupError: (error: unknown) => void = () => {}) {
      this.onCleanupError = onCleanupError;
      this.cleanups = /* @__PURE__ */new Map();
    }
    has(itemBox) {
      return this.cleanups.has(itemBox);
    }
    add(itemBox, cleanup) {
      this.cleanups.set(itemBox, cleanup);
    }
    pruneDisconnected() {
      for (const [itemBox, cleanup] of this.cleanups) {
        let connected = false;
        try {
          connected = itemBox.isConnected;
        } catch {}
        if (!connected) {
          this.release(itemBox, cleanup);
        }
      }
    }
    clear() {
      for (const [itemBox, cleanup] of this.cleanups) {
        this.release(itemBox, cleanup);
      }
    }
    release(itemBox, cleanup) {
      if (!this.cleanups.delete(itemBox)) {
        return;
      }
      try {
        cleanup();
      } catch (error) {
        this.onCleanupError(error);
      }
    }
  };

