  // src/utils/keyedTaskGate.ts
  export class KeyedTaskGate {
    declare activeKeys: Set<unknown>;

    constructor() {
      this.activeKeys = /* @__PURE__ */new Set();
    }
    tryStart(key) {
      if (this.activeKeys.has(key)) {
        return false;
      }
      this.activeKeys.add(key);
      return true;
    }
    finish(key) {
      this.activeKeys.delete(key);
    }
    clear() {
      this.activeKeys.clear();
    }
  };

