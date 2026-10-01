import { setPref } from "../../utils/prefs.ts";
import { getPref } from "../../utils/prefs.ts";
import { replaceOwnedProperty } from "../../utils/ownedResource.ts";
  // src/platform/persistence/storage.ts
  export var MAX_CACHED_NOTE_ITEMS = 500;
  export var READING_PROGRESS_RECORDING_PREF = "readingProgress.recordingEnabled";
  export function isReadingProgressRecordingEnabled(readPreference = getPref) {
    return readPreference(READING_PROGRESS_RECORDING_PREF) !== false;
  }
  export function shouldPersistStorageKey(key, readPreference = getPref) {
    return key !== "readingTime" || isReadingProgressRecordingEnabled(readPreference);
  }
  export class LocalStorage {
    declare disposed: boolean;
    declare writeVersion: number;
    declare lock: any;
    declare filename: any;
    declare cache: Record<string, any>;
    declare writeTimer: number;
    declare writePromise: Promise<void> | undefined;

    constructor(filename) {
      this.disposed = false;
      this.writeVersion = 0;
      this.lock = Zotero.Promise.defer();
      this.init(filename);
    }
    async init(filename) {
      let isExists = false;
      try {
        isExists = await IOUtils.exists(filename);
      } catch {
        isExists = false;
      }
      try {
        this.filename = isExists ? filename : PathUtils.joinRelative(Zotero.DataDirectory.dir, `${filename}.json`);
        const rawString = await Zotero.File.getContentsAsync(this.filename);
        this.cache = JSON.parse(rawString as string);
        ztoolkit.log(this.cache);
      } catch {
        this.cache = {};
      } finally {
        this.lock.resolve();
      }
    }
    get(item, key) {
      if (this.disposed || this.cache == undefined) {
        window.console.log("cache is undefined");
        return;
      }
      return (this.cache[item.key] ??= {})[key];
    }
    async set(item, key, value) {
      if (this.disposed || !shouldPersistStorageKey(key)) {
        return;
      }
      await this.lock.promise;
      if (this.disposed || !shouldPersistStorageKey(key)) {
        return;
      }
      (this.cache[item.key] ??= {})[key] = value;
      this.writeVersion += 1;
      if (this.writeTimer !== undefined) {
        window.clearTimeout(this.writeTimer);
      }
      this.writeTimer = window.setTimeout(() => {
        this.writeTimer = undefined;
        this.flush().catch(error => ztoolkit.log("Failed to persist Refolio storage", error));
      }, 0);
    }
    async dispose() {
      if (this.disposed) {
        return;
      }
      await this.lock.promise;
      if (this.disposed) {
        return;
      }
      this.disposed = true;
      if (this.writeTimer !== undefined) {
        window.clearTimeout(this.writeTimer);
        this.writeTimer = undefined;
      }
      await this.flush(true);
      this.cache = {};
    }
    flush(force = false): Promise<void> {
      if (this.writePromise) return this.writePromise;
      if (!force && this.disposed || this.writeVersion === 0) {
        return Promise.resolve();
      }
      this.writePromise = (async () => {
        while (this.writeVersion !== 0) {
          const version = this.writeVersion;
          await Zotero.File.putContentsAsync(this.filename, JSON.stringify(this.cache));
          if (this.writeVersion === version) this.writeVersion = 0;
        }
      })().finally(() => { this.writePromise = undefined; });
      return this.writePromise;
    }
  };
  export class AddonItem {
    declare title: string;
    declare prefKey: string;
    declare cache: Record<string, any>;
    declare cacheKeys: string[];
    declare pendingWrites: Map<any, any>;
    declare hiddenNotesUsers: number;
    declare disposed: boolean;
    declare item: any;
    declare restoreSearch: () => void;
    declare searchPatchState: { active: boolean; };

    constructor() {
      this.title = "Addon Item";
      this.prefKey = "Zotero.AddonItem.key";
      this.cache = {};
      this.cacheKeys = [];
      this.pendingWrites = /* @__PURE__ */new Map();
      this.hiddenNotesUsers = 0;
      this.disposed = false;
    }
    get isDisposed() {
      return this.disposed;
    }
    /**
     * 初始化插件所依赖条目
     * @returns
     */
    async init() {
      if (this.disposed) {
        return;
      }
      ztoolkit.log("******\n\n");
      ztoolkit.log(`${this.title} init is called`);
      let item;
      const addonItemKey = Zotero.Prefs.get(this.prefKey);
      if (addonItemKey) {
        item = await Zotero.Items.getByLibraryAndKeyAsync(1, String(addonItemKey));
        if (this.disposed) {
          return;
        }
        if (item) {
          this.item = item;
          ztoolkit.log("From prefKey");
          return;
        }
      }
      const s = new Zotero.Search();
      s.addCondition("title", "is", this.title);
      const ids = await s.search();
      if (this.disposed) {
        return;
      }
      const items = await Zotero.Items.getAsync(ids);
      if (this.disposed) {
        return;
      }
      ztoolkit.log(items);
      if (ids.length) {
        item = items[0];
        ztoolkit.log("From local");
      } else {
        item = new Zotero.Item("computerProgram");
        item.setField("title", this.title);
        await item.saveTx({
          skipSelect: true
        });
        if (this.disposed) {
          try {
            await item.eraseTx();
          } catch (error) {
            ztoolkit.log("Failed to remove a late add-on item", error);
          }
          return;
        }
        ztoolkit.log("From new");
      }
      Zotero.Prefs.set(this.prefKey, item.key);
      this.item = item;
    }
    /**
     * @param item 哪个item的数据
     * @param key 数据key
     * @param data 数据
     */
    async set(item, key, data) {
      if (this.disposed || !shouldPersistStorageKey(key)) {
        return;
      }
      this.pendingWrites ??= /* @__PURE__ */new Map();
      const previous = this.pendingWrites.get(item.key) ?? Promise.resolve();
      const write = previous.catch(() => {}).then(() => this.setNow(item, key, data));
      this.pendingWrites.set(item.key, write);
      try {
        await write;
      } finally {
        if (this.pendingWrites.get(item.key) === write) {
          this.pendingWrites.delete(item.key);
        }
      }
    }
    async setNow(item, key, data) {
      if (this.disposed || !shouldPersistStorageKey(key)) {
        return;
      }
      let noteItem = this.getNoteItem(item);
      if (!noteItem) {
        if (this.disposed || !shouldPersistStorageKey(key)) {
          return;
        }
        const noteData2 = {
          [key]: data
        };
        noteItem = await this.createNoteItem(`${item.key}
${JSON.stringify(noteData2)}`);
        if (this.disposed) {
          try {
            await noteItem.eraseTx();
          } catch (error) {
            ztoolkit.log("Failed to remove a late metadata note", error);
          }
          return;
        }
        this.cacheNoteItem(`getNoteItem-${item.key}`, noteItem);
        return;
      }
      if (this.disposed || !shouldPersistStorageKey(key)) {
        return;
      }
      const noteData = this.getNoteData(noteItem);
      noteData[key] = data;
      noteItem.setNote(`${item.key}
${JSON.stringify(noteData)}`);
      if (this.disposed) {
        return;
      }
      await noteItem.saveTx({
        skipSelect: true
      });
    }
    /**
     * @param item
     * @param key
     */
    get(item, key) {
      if (this.disposed || !item) {
        return;
      }
      let noteItem;
      try {
        noteItem = this.getNoteItem(item);
      } catch {}
      if (noteItem) {
        return this.getNoteData(noteItem)[key];
      }
    }
    /**
     * 获取笔记记录的数据
     * @param noteItem
     * @returns
     */
    getNoteData(noteItem) {
      try {
        return JSON.parse(noteItem.note.replace(/<.+?>/g, "").replace(/[^\n{]+/, ""));
      } catch {
        return {};
      }
    }
    /**
     * 创建一个空白笔记
     * @returns
     */
    async createNoteItem(note) {
      if (this.disposed) {
        throw new Error("Addon storage is disposed");
      }
      const noteItem = new Zotero.Item("note");
      noteItem.parentID = this.item.id;
      if (note !== undefined) {
        noteItem.setNote(note);
      }
      await noteItem.saveTx({
        skipSelect: true
      });
      return noteItem;
    }
    /**
     * item对应的笔记，根据item.key == noteItem._displayTitle寻找
     * @param item
     * @returns
     */
    getNoteItem(item) {
      if (!item) {
        return;
      }
      const key = item.key;
      const cacheKey = `getNoteItem-${key}`;
      const cachedNoteItem = this.getCachedNoteItem(cacheKey);
      if (cachedNoteItem) {
        return cachedNoteItem;
      }
      const ids = this.item.getNotes();
      let noteItem;
      for (const id of ids) {
        const idInfo = Zotero.Items.getLibraryAndKeyFromID(id);
        if (!idInfo) {
          continue;
        }
        const _noteItem = Zotero.Items.getByLibraryAndKey(idInfo.libraryID, idInfo.key);
        if (!_noteItem) {
          continue;
        }
        if (_noteItem._displayTitle.includes(key)) {
          noteItem = _noteItem;
          this.cacheNoteItem(cacheKey, noteItem);
          break;
        }
      }
      return noteItem;
    }
    hiddenNotes() {
      if (this.disposed) {
        return () => true;
      }
      this.hiddenNotesUsers += 1;
      if (!this.restoreSearch) {
        this.installHiddenNotesPatch();
      }
      let retained = true;
      return () => {
        if (!retained) {
          return this.hiddenNotesUsers === 0;
        }
        retained = false;
        this.hiddenNotesUsers = Math.max(0, this.hiddenNotesUsers - 1);
        if (this.hiddenNotesUsers > 0) {
          return false;
        }
        if (this.searchPatchState) {
          this.searchPatchState.active = false;
        }
        this.restoreSearch?.();
        this.restoreSearch = undefined;
        this.searchPatchState = undefined;
        return true;
      };
    }
    async dispose() {
      if (this.disposed) {
        return;
      }
      this.disposed = true;
      this.hiddenNotesUsers = 0;
      if (this.searchPatchState) {
        this.searchPatchState.active = false;
      }
      this.restoreSearch?.();
      this.restoreSearch = undefined;
      this.searchPatchState = undefined;
      await Promise.allSettled([...(this.pendingWrites?.values() ?? [])]);
      this.pendingWrites?.clear();
      this.cache = {};
      this.cacheKeys = [];
    }
    installHiddenNotesPatch() {
      const excludeKey = this.item.key;
      const search = Zotero.Search.prototype.search;
      const itemTitle = this.title;
      const patchState = this.searchPatchState = {
        active: true
      };
      const wrappedSearch = async function (asTempTable) {
        const result = await search.call(this, asTempTable);
        if (typeof result === "string") {
          return result;
        }
        const ids = result;
        if (!patchState.active) {
          return ids;
        }
        return ids.filter(id => {
          let parentID;
          try {
            const item = Zotero.Items.get(id);
            parentID = item ? item.parentID : undefined;
          } catch {
            return true;
          }
          if (!parentID) {
            return true;
          }
          const parentItem = Zotero.Items.get(parentID);
          if (!parentItem) {
            return true;
          }
          return parentItem.key != excludeKey && parentItem.getField("title") != itemTitle;
        });
      };
      this.restoreSearch = replaceOwnedProperty(Zotero.Search.prototype, "search", wrappedSearch);
    }
    getCachedNoteItem(cacheKey) {
      if (!Object.prototype.hasOwnProperty.call(this.cache, cacheKey)) {
        return undefined;
      }
      this.cacheKeys ??= [];
      const index = this.cacheKeys.indexOf(cacheKey);
      if (index >= 0) {
        this.cacheKeys.splice(index, 1);
      }
      this.cacheKeys.push(cacheKey);
      return this.cache[cacheKey];
    }
    cacheNoteItem(cacheKey, noteItem) {
      this.cacheKeys ??= [];
      const existingIndex = this.cacheKeys.indexOf(cacheKey);
      if (existingIndex >= 0) {
        this.cacheKeys.splice(existingIndex, 1);
      }
      this.cacheKeys.push(cacheKey);
      this.cache[cacheKey] = noteItem;
      while (this.cacheKeys.length > MAX_CACHED_NOTE_ITEMS) {
        const oldestKey = this.cacheKeys.shift();
        if (oldestKey !== undefined) {
          delete this.cache[oldestKey];
        }
      }
    }
  };
  export async function initStorage() {
    let storage;
    let releaseHiddenNotes;
    const storageIn = getPref(`storage.in`) || "note";
    const filename = getPref(`storage.filename`);
    if (storageIn == "file" && filename) {
      storage = new LocalStorage(getPref(`storage.filename`));
      await storage.lock.promise;
    } else {
      setPref(`storage.in`, "note");
      const existingAddonItem = Zotero._AddonItemGlobal;
      if (!(existingAddonItem instanceof AddonItem) || existingAddonItem.isDisposed) {
        const replacement = new AddonItem();
        if (existingAddonItem?.item) {
          replacement.item = existingAddonItem.item;
        }
        Zotero._AddonItemGlobal = replacement;
      }
      const addonItem = Zotero._AddonItemGlobal;
      if (!addonItem.item) {
        await addonItem.init();
      }
      storage = addonItem;
      releaseHiddenNotes = addonItem.hiddenNotes();
    }
    addon.api.storage = storage;
    let active = true;
    return async () => {
      if (!active) {
        return;
      }
      active = false;
      if (storage instanceof LocalStorage) {
        await storage.dispose();
        if (addon.api.storage === storage) {
          delete addon.api.storage;
        }
        return;
      }
      const isLastUser = releaseHiddenNotes?.() ?? true;
      if (!isLastUser) {
        return;
      }
      await storage.dispose();
      if (Zotero._AddonItemGlobal === storage) {
        Zotero._AddonItemGlobal = undefined;
      }
      if (addon.api.storage === storage) {
        delete addon.api.storage;
      }
    };
  }
