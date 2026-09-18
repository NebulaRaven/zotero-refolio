  // src/utils/weakRecordList.ts
  export var WeakRecordList = class _WeakRecordList extends Array {
    declare nextCompactLength: number;
    declare static MIN_COMPACT_LENGTH: number;
    declare length: number;

    constructor() {
      super(...arguments);
      this.nextCompactLength = _WeakRecordList.MIN_COMPACT_LENGTH;
    }
    static {
      this.MIN_COMPACT_LENGTH = 1024;
    }
    // Array methods such as `filter` must return plain arrays, not a new list
    // whose constructor would be called with a length argument.
    static get [Symbol.species]() {
      return Array;
    }
    push(...records) {
      const length = super.push(...records);
      if (length >= this.nextCompactLength) {
        this.compact();
      }
      return this.length;
    }
    compact() {
      let live = 0;
      for (let index = 0; index < this.length; index++) {
        const record = this[index];
        if (record?.deref() !== undefined) {
          this[live++] = record;
        }
      }
      this.length = live;
      this.nextCompactLength = Math.max(_WeakRecordList.MIN_COMPACT_LENGTH, live * 2);
      return live;
    }
  };
  export function installBoundedElementRecord(ui) {
    const owner = ui;
    if (owner.elementCache instanceof WeakRecordList) {
      return owner.elementCache;
    }
    const records = new WeakRecordList();
    for (const record of owner.elementCache ?? []) {
      records.push(record);
    }
    owner.elementCache = records;
    return records;
  }

