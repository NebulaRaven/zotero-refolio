  // src/utils/lruCache.ts
  export class LruCache {
    declare capacity: any;
    declare values: Map<any, any>;

    constructor(capacity) {
      this.capacity = capacity;
      this.values = /* @__PURE__ */new Map();
      if (!Number.isInteger(capacity) || capacity < 1) {
        throw new Error("LRU cache capacity must be a positive integer.");
      }
    }
    get(key) {
      if (!this.values.has(key)) {
        return undefined;
      }
      const value = this.values.get(key);
      this.values.delete(key);
      this.values.set(key, value);
      return value;
    }
    set(key, value) {
      this.values.delete(key);
      this.values.set(key, value);
      while (this.values.size > this.capacity) {
        const oldest = this.values.keys().next();
        if (oldest.done) {
          break;
        }
        this.values.delete(oldest.value);
      }
    }
    clear() {
      this.values.clear();
    }
    get size() {
      return this.values.size;
    }
  };

