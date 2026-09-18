import { LruCache } from "../../utils/lruCache.ts";
import { getPref } from "../../utils/prefs.ts";
import { isReadingProgressRecordingEnabled } from "../../platform/persistence/storage.ts";
  // src/features/reader/record.ts
  export class Record {
    declare maxHangTime: number;
    declare isActivated: boolean;
    declare destroyed: boolean;
    declare hangCount: number;
    declare lastLocation: { pageIndex: number; left: number; top: number; scale: number; };
    declare cache: LruCache;
    declare recordInterval: any;
    declare boundActivate: any;
    declare boundDeactivate: any;
    declare intervalID: number;
    private recording = false;
    private generation = 0;

    constructor() {
      // s
      this.maxHangTime = 60;
      // 状态标记
      this.isActivated = true;
      this.destroyed = false;
      this.hangCount = 0;
      // 上一次阅读的位置缓存
      this.lastLocation = {
        pageIndex: -1,
        left: -1,
        top: -1,
        scale: -1
      };
      this.cache = new LruCache(1);
      this.recordInterval = getPref("recordInterval") || 20;
      this.boundActivate = this.handleActivate.bind(this);
      this.boundDeactivate = this.handleDeactivate.bind(this);
      this.init();
    }
    init() {
      if (this.recordInterval <= 0) {
        return;
      }
      this.handleActivate();
      window.addEventListener("activate", this.boundActivate, true);
      window.addEventListener("deactivate", this.boundDeactivate, true);
      window.addEventListener("close", this.boundDeactivate, true);
    }
    /**
     * 销毁方法：在插件卸载或重载时必须调用
     */
    destroy() {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      this.stopTimer();
      window.removeEventListener("activate", this.boundActivate, true);
      window.removeEventListener("deactivate", this.boundDeactivate, true);
      window.removeEventListener("close", this.boundDeactivate, true);
      this.cache.clear();
    }
    // ==== 核心逻辑：定时器管理 ====
    startTimer() {
      if (this.destroyed || this.intervalID !== undefined) {
        return;
      }
      this.isActivated = true;
      this.intervalID = window.setInterval(async () => {
        if (this.recording) return;
        this.recording = true;
        try {
          await this.listeningReader();
        } catch (error) {
          ztoolkit.log("Reading progress recording failed", error);
        } finally { this.recording = false; }
      }, this.recordInterval * 1000);
    }
    stopTimer() {
      this.generation++;
      if (this.intervalID !== undefined) {
        window.clearInterval(this.intervalID);
        this.intervalID = undefined;
      }
      this.isActivated = false;
      this.hangCount = 0;
    }
    handleActivate() {
      this.startTimer();
    }
    handleDeactivate() {
      this.stopTimer();
    }
    // ==== 业务逻辑：记录阅读时间 ====
    async listeningReader() {
      if (this.destroyed || !this.isActivated || !isReadingProgressRecordingEnabled()) {
        return;
      }
      const generation = this.generation;
      const reader = await ztoolkit.Reader.getReader();
      if (this.destroyed || !this.isActivated || generation !== this.generation || !reader || reader !== this.getReader()) {
        return;
      }
      const item = reader._item.parentItem;
      if (this.destroyed || !this.isActivated || !item) {
        return;
      }
      const internalReader = reader._internalReader;
      const view = internalReader?._lastView;
      const currentLocation = view?._iframeWindow?.PDFViewerApplication?.pdfViewer?._location;
      if (!currentLocation) {
        return;
      }
      const pageIndex = currentLocation.pageNumber;
      const isSamePosition = pageIndex === this.lastLocation.pageIndex && currentLocation.left === this.lastLocation.left && currentLocation.top === this.lastLocation.top && currentLocation.scale === this.lastLocation.scale;
      if (isSamePosition) {
        this.hangCount++;
      } else {
        this.lastLocation = {
          pageIndex,
          left: currentLocation.left,
          top: currentLocation.top,
          scale: currentLocation.scale
        };
        this.hangCount = 0;
      }
      if (this.hangCount * this.recordInterval > this.maxHangTime) {
        return;
      }
      const totalPages = view._iframeWindow.PDFViewerApplication.pagesCount;
      const cacheKey = `readingTime-${item.key}`;
      let readingData = this.cache.get(cacheKey);
      if (!readingData) {
        const storage2 = addon.api.storage;
        if (!storage2) {
          return;
        }
        const storedData = await storage2.get(item, "readingTime");
        if (this.destroyed || !this.isActivated || generation !== this.generation || !isReadingProgressRecordingEnabled()) {
          return;
        }
        readingData = storedData ?? {
          page: totalPages,
          data: {}
        };
        this.cache.set(cacheKey, readingData);
      }
      if (this.destroyed || !this.isActivated || generation !== this.generation || !isReadingProgressRecordingEnabled()) {
        return;
      }
      const dataIndex = pageIndex - 1;
      const currentData = readingData.data;
      if (currentData[dataIndex]) {
        currentData[dataIndex] += this.recordInterval;
      } else {
        currentData[dataIndex] = this.recordInterval;
      }
      const storage = addon.api.storage;
      if (!storage || this.destroyed || !this.isActivated) {
        return;
      }
      await storage.set(item, "readingTime", readingData);
    }
    // ==== 辅助方法 ====
    getReader() {
      return Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
    }
    getItem() {
      const reader = this.getReader();
      if (reader) {
        return reader._item.parentItem;
      }
      return null;
    }
  };

