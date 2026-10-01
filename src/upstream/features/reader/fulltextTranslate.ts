interface MinerOptions { language?: string; page_range?: string; enable_table?: boolean; is_ocr?: boolean; enable_formula?: boolean; }
interface MinerResponse { code: number; msg?: string; data?: { err_msg?: string; task_id?: string; file_url?: string; state?: string; markdown_url?: string; }; }
interface MathFragment { latex: string; isBlock: boolean; base64?: string; }
import { LocalStorage } from "../../platform/persistence/storage.ts";
import { config } from "../../config.ts";
import { getString } from "../../utils/locale.ts";
import { buildMicrosoftTranslationRequest,parseMicrosoftTranslationResponse } from "./microsoftTranslation.ts";
  // src/features/reader/fulltextTranslate.ts
  export class FulltextTranslate {
    declare disposed: boolean;
    declare activeAbortControllers: Set<AbortController>;
    declare exitTimers: Set<number>;
    declare MINERU_BASE_URL: string;
    declare CONCURRENCY_LIMIT: number;
    declare mathCache: MathFragment[];
    declare cache: LocalStorage;
    declare progressElement: HTMLSpanElement;
    declare infoContainer: any;

    constructor() {
      this.disposed = false;
      this.activeAbortControllers = /* @__PURE__ */new Set();
      this.exitTimers = /* @__PURE__ */new Set();
      this.MINERU_BASE_URL = "https://mineru.net/api/v1/agent";
      this.CONCURRENCY_LIMIT = 8;
      this.mathCache = [];
      this.cache = new LocalStorage("paperSummary");
      ztoolkit.Prompt.register([{
        id: `${config.addonRef}-fulltext-translate`,
        name: getString("fulltext-translate"),
        label: "Refolio",
        callback: async prompt2 => {
          if (this.disposed) {
            return;
          }
          for (const controller2 of this.activeAbortControllers) {
            controller2.abort();
          }
          const controller = new AbortController();
          this.activeAbortControllers.add(controller);
          const {
            signal
          } = controller;
          this.progressElement = undefined;
          let attItem;
          try {
            if (Zotero_Tabs.selectedID == "zotero-pane") {
              const item2 = ZoteroPane.getSelectedItems()?.[0];
              attItem = await item2?.getBestAttachment();
            } else {
              attItem = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)._item;
            }
            this.ensureActive(signal);
            if (!attItem) {
              window.alert(getString("fulltext-translate-no-pdf"));
              return;
            }
            const item = attItem.parentItem;
            this.infoContainer = prompt2.createCommandsContainer();
            this.infoContainer.style.padding = "1em";
            this.infoContainer.style.display = "flex";
            this.infoContainer.style.flexDirection = "column";
            this.showInfo(getString("fulltext-processing", {
              args: {
                title: item.getField("title")
              }
            }));
            await this.process(attItem.id, signal);
          } catch (e) {
            if (this.disposed || signal.aborted) {
              return;
            }
            ztoolkit.log(e);
            this.showInfo(getString("fulltext-fatal-error", {
              args: {
                error: String(e.message || e)
              }
            }));
          } finally {
            this.activeAbortControllers.delete(controller);
          }
          if (this.disposed || signal.aborted) {
            return;
          }
          const timer = window.setTimeout(() => {
            this.exitTimers.delete(timer);
            if (this.disposed || signal.aborted) {
              return;
            }
            prompt2.exit();
          }, 3000);
          this.exitTimers.add(timer);
        }
      }, {
        id: `${config.addonRef}-fulltext-toggle-original`,
        name: getString("fulltext-translate-toggle-original"),
        label: "Refolio",
        when: () => {
          return Zotero_Tabs.selectedType == "reader" && Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)._item.getTags().some(i => i.tag == "全文翻译");
        },
        callback: async () => {
          if (this.disposed) {
            return;
          }
          const reader = await ztoolkit.Reader.getReader();
          if (this.disposed || !reader) {
            return;
          }
          const body = (reader?._internalReader._primaryView)._iframeWindow.document.querySelector("body");
          if (!body) {
            return;
          }
          if (body.getAttribute("original")) {
            body.removeAttribute("original");
          } else {
            body.setAttribute("original", "true");
          }
        }
      }]);
    }
    async destroy() {
      if (this.disposed) {
        return;
      }
      this.disposed = true;
      for (const controller of this.activeAbortControllers) {
        controller.abort();
      }
      this.activeAbortControllers.clear();
      for (const timer of this.exitTimers) {
        window.clearTimeout(timer);
      }
      this.exitTimers.clear();
      ztoolkit.Prompt.unregister(`${config.addonRef}-fulltext-translate`);
      ztoolkit.Prompt.unregister(`${config.addonRef}-fulltext-toggle-original`);
      await this.cache.dispose();
      this.infoContainer?.remove();
      this.progressElement?.remove();
      this.infoContainer = undefined;
      this.progressElement = undefined;
      this.mathCache = [];
    }
    ensureActive(signal) {
      if (this.disposed || signal?.aborted) {
        throw new Error("Fulltext translation was cancelled");
      }
    }
    isActive(signal) {
      return !this.disposed && !signal?.aborted;
    }
    async delay(milliseconds, signal) {
      this.ensureActive(signal);
      if (!signal) {
        await Zotero.Promise.delay(milliseconds);
        this.ensureActive(signal);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          cleanup();
          reject(new Error("Fulltext translation was cancelled"));
        };
        const cleanup = () => {
          window.clearTimeout(timer);
          signal.removeEventListener("abort", onAbort);
        };
        const timer = window.setTimeout(() => {
          cleanup();
          resolve();
        }, milliseconds);
        signal.addEventListener("abort", onAbort, {
          once: true
        });
        if (signal.aborted) {
          onAbort();
        }
      });
      this.ensureActive(signal);
    }
    showInfo(htmlString, callback?) {
      if (this.disposed || !this.infoContainer?.isConnected) {
        return;
      }
      ztoolkit.UI.appendElement({
        tag: "span",
        styles: {
          display: "block",
          margin: ".23em 0",
          wordBreak: "break-word"
        },
        properties: {
          innerHTML: htmlString
        },
        listeners: callback ? [{
          type: "click",
          listener: () => {
            callback();
          }
        }] : []
      }, this.infoContainer);
      this.infoContainer.scrollBy(0, this.infoContainer.scrollTopMax);
    }
    updateProgress(current, total, currentText, prefix = getString("fulltext-translation-progress")) {
      if (this.disposed || !this.infoContainer?.isConnected) {
        return;
      }
      if (!this.progressElement) {
        this.progressElement = document.createElement("span");
        this.progressElement.style.cssText = `
        display: block; margin: .5em 0; padding: .8em; 
        background: rgba(57, 134, 255, 0.1); border-radius: 0; 
        border: 1px solid rgba(57, 134, 255, 0.3); font-weight: bold;
      `;
        this.infoContainer.appendChild(this.progressElement);
      }
      const percent = total === 0 ? 0 : Math.round(current / total * 100);
      this.progressElement.innerHTML = `${prefix}: ${current} / ${total} (${percent}%)<br/>
      <span style="font-weight:normal; font-size: 0.85em; opacity: 0.8; margin-top: 0.5em; display: inline-block;">
        \u231B ${this.escapeHtml(currentText.substring(0, 80).replace(/\n/g, " "))}...
      </span>`;
      this.infoContainer.scrollBy(0, this.infoContainer.scrollTopMax);
    }
    async process(itemID, signal) {
      this.ensureActive(signal);
      const mdString = await this.pdf2md(itemID, signal);
      this.ensureActive(signal);
      if (!mdString || mdString.trim().length === 0) {
        throw new Error(getString("fulltext-empty-mineru-result"));
      }
      const htmlString = await this.md2html(mdString, signal);
      this.ensureActive(signal);
      await this.attachSnapshot(htmlString, itemID, signal);
    }
    async pdf2md(itemID, signal) {
      this.ensureActive(signal);
      await this.cache.lock.promise;
      this.ensureActive(signal);
      const pdfItem = await Zotero.Items.getAsync(itemID);
      this.ensureActive(signal);
      if (!pdfItem) {
        throw new Error(getString("fulltext-pdf-path-unavailable"));
      }
      const filepath = await pdfItem.getFilePathAsync();
      this.ensureActive(signal);
      if (!filepath) {
        throw new Error(getString("fulltext-pdf-path-unavailable"));
      }
      const mdString = this.cache.get(pdfItem, "mineru-md");
      if (mdString && typeof addon !== "undefined" && addon.data.env == "production") {
        this.showInfo(getString("fulltext-cache-hit"));
        return mdString;
      }
      let totalPages = 0;
      try {
        const text = await pdfItem.attachmentText;
        this.ensureActive(signal);
        if (typeof text === "string") {
          totalPages = text.split("\n\n").length;
          ztoolkit.log(`[Page Strategy] \u6210\u529F\u901A\u8FC7 attachmentText \u83B7\u53D6\u9875\u6570: ${totalPages}`);
        }
      } catch (e) {
        ztoolkit.log(`[Page Strategy] \u83B7\u53D6 attachmentText \u5931\u8D25: ${e}`);
      }
      if (!totalPages || totalPages <= 0) {
        this.showInfo(getString("fulltext-page-count-fallback"));
        totalPages = 20;
      }
      this.showInfo(getString("fulltext-page-count-found", {
        args: {
          count: totalPages
        }
      }));
      const ranges = [];
      for (let i = 1; i <= totalPages; i += 20) {
        const end = Math.min(i + 19, totalPages);
        if (i === end) {
          ranges.push(`${i}`);
        } else {
          ranges.push(`${i}-${end}`);
        }
      }
      let combinedMdString = "";
      for (const range of ranges) {
        this.ensureActive(signal);
        let mdResult = null;
        const retries = 5;
        for (let attempt = 1; attempt <= retries; attempt++) {
          this.ensureActive(signal);
          if (attempt === 1) {
            this.showInfo(getString("fulltext-submit-range", {
              args: {
                range
              }
            }));
          } else {
            this.showInfo(getString("fulltext-retry-range", {
              args: {
                range,
                attempt,
                retries
              }
            }));
          }
          mdResult = await this.parseByFile(filepath, {
            page_range: range
          }, signal);
          if (mdResult) {
            break;
          } else if (attempt < retries) {
            this.showInfo(getString("fulltext-retry-wait"));
            await this.delay(3000, signal);
          }
        }
        if (mdResult) {
          combinedMdString += mdResult + "\n\n";
        } else {
          this.showInfo(getString("fulltext-range-failed", {
            args: {
              range,
              retries
            }
          }));
          throw new Error(getString("fulltext-segment-parse-failed", {
            args: {
              range
            }
          }));
        }
      }
      this.ensureActive(signal);
      await this.cache.set(pdfItem, "mineru-md", combinedMdString);
      this.ensureActive(signal);
      this.showInfo(getString("fulltext-segments-complete"));
      return combinedMdString;
    }
    async parseByFile(filePath, options: MinerOptions = {}, signal) {
      this.ensureActive(signal);
      const {
        language = "en",
        page_range = null,
        enable_table = true,
        is_ocr = false,
        enable_formula = true
      } = options;
      const fileName = filePath.split(/[\\/]/).pop();
      const data = {
        file_name: fileName,
        language,
        enable_table,
        is_ocr,
        enable_formula, page_range: page_range || "1-20"
      };
      ztoolkit.log(`[MinerU Fetch Params] ${JSON.stringify(data)}`);
      const resp = await window.fetch(`${this.MINERU_BASE_URL}/parse/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        signal
      });
      this.ensureActive(signal);
      const result = await resp.json() as unknown as MinerResponse;
      if (result.code !== 0) {
        ztoolkit.log(`[MinerU API Reject] Code: ${result.code}, Msg: ${result.msg}, Err: ${result.data?.err_msg}`);
        this.showInfo(getString("fulltext-api-upload-rejected", {
          args: {
            range: data.page_range,
            error: result.msg || getString("unknown")
          }
        }));
        if (result.data && result.data.err_msg) {
          this.showInfo(getString("fulltext-error-detail", {
            args: {
              error: result.data.err_msg
            }
          }));
        }
        return null;
      }
      const taskId = result.data?.task_id;
      const fileUrl = result.data?.file_url;
      if (!taskId || !fileUrl) {
        ztoolkit.log("[MinerU API Reject] Missing task_id or file_url", result);
        this.showInfo(getString("fulltext-api-missing-task"));
        return null;
      }
      const buf = await IOUtils.read(filePath);
      this.ensureActive(signal);
      const bytes = new window.Uint8Array(buf);
      const putResp = await window.fetch(fileUrl, {
        method: "PUT",
        body: bytes,
        signal
      });
      this.ensureActive(signal);
      if (![200, 201].includes(putResp.status)) {
        ztoolkit.log(`[MinerU OSS ERROR] Upload failed with status: ${putResp.status}`);
        this.showInfo(getString("fulltext-oss-upload-failed", {
          args: {
            status: putResp.status
          }
        }));
        return null;
      }
      return await this.pollResult(taskId, data.page_range, undefined, undefined, signal);
    }
    async pollResult(taskId, range, timeout = 300000, interval = 3000, signal) {
      this.ensureActive(signal);
      if (!this.infoContainer?.isConnected) {
        throw new Error(getString("ui-error-translation-ui-unavailable"));
      }
      const start = Date.now();
      const statusElement = document.createElement("div");
      statusElement.style.cssText = `
      margin: 0.5em 0; font-size: 0.9em; padding: 0.8em; 
      background: rgba(0,0,0,0.03); border-radius: 0; 
      border-left: 4px solid #ccc; font-family: monospace;
    `;
      this.infoContainer.appendChild(statusElement);
      const stateLabels = {
        pending: getString("fulltext-state-pending"),
        running: getString("fulltext-state-running"),
        "waiting-file": getString("fulltext-state-waiting-file"),
        done: getString("fulltext-state-done"),
        failed: getString("fulltext-state-failed")
      };
      const updateBadge = (state, msg = "") => {
        if (!this.isActive(signal) || !statusElement.isConnected) {
          return;
        }
        let bg = "#f3f4f6";
        let color = "#4b5563";
        let border = "#ccc";
        if (state === "running" || state === "pending" || state === "waiting-file") {
          bg = "#fef08a";
          color = "#a16207";
          border = "#eab308";
        } else if (state === "done") {
          bg = "#dcfce7";
          color = "#15803d";
          border = "#22c55e";
        } else if (state === "failed") {
          bg = "#fee2e2";
          color = "#b91c1c";
          border = "#ef4444";
        }
        statusElement.style.borderLeftColor = border;
        statusElement.innerHTML = `
        <div style="margin-bottom: 4px; font-weight: bold;">${getString("fulltext-task-range", {
          args: {
            task: taskId.substring(0, 8),
            range: range || "-"
          }
        })}</div>
        <div>
          ${getString("fulltext-status")}: <span style="display:inline-block; padding: 2px 8px; border-radius: 0; background: ${bg}; color: ${color}; font-weight: bold; font-size: 0.85em;">${stateLabels[state] || state}</span>
          <span style="color:#666; margin-left:8px; font-family: sans-serif;">${msg}</span>
        </div>
      `;
        this.infoContainer.scrollBy(0, this.infoContainer.scrollTopMax);
      };
      updateBadge("pending", getString("fulltext-poll-initializing"));
      while (Date.now() - start < timeout) {
        this.ensureActive(signal);
        const resp = await window.fetch(`${this.MINERU_BASE_URL}/parse/${taskId}`, {
          signal
        });
        this.ensureActive(signal);
        const result = await resp.json() as unknown as MinerResponse;
        const state = result.data?.state;
        if (!state) {
          updateBadge("failed", getString("fulltext-api-missing-status"));
          return null;
        }
        if (state === "done") {
          const markdownUrl = result.data?.markdown_url;
          if (!markdownUrl) {
            updateBadge("failed", getString("fulltext-api-missing-markdown"));
            return null;
          }
          updateBadge(state, getString("fulltext-downloading-markdown"));
          const mdResp = await window.fetch(markdownUrl, {
            signal
          });
          this.ensureActive(signal);
          updateBadge(state, getString("fulltext-download-complete"));
          return await mdResp.text();
        }
        if (state === "failed") {
          const errMsg = result.data?.err_msg || getString("fulltext-unknown-internal-error");
          ztoolkit.log(`[MinerU Failed] Task: ${taskId} Error: ${errMsg}`);
          updateBadge(state, `<span style="color:#b91c1c">${this.escapeHtml(errMsg)}</span>`);
          return null;
        }
        updateBadge(state, getString("fulltext-elapsed", {
          args: {
            seconds: Math.floor((Date.now() - start) / 1000)
          }
        }));
        await this.delay(interval, signal);
      }
      this.ensureActive(signal);
      updateBadge("failed", getString("fulltext-poll-timeout"));
      return null;
    }
    async runConcurrentTasks(tasks, limit, signal) {
      this.ensureActive(signal);
      const results = new Array(tasks.length);
      let i = 0;
      const execute = async () => {
        while (i < tasks.length) {
          this.ensureActive(signal);
          const currentIndex = i++;
          try {
            results[currentIndex] = await tasks[currentIndex]();
            await this.delay(10, signal);
          } catch (e) {
            if (this.disposed || signal?.aborted) {
              throw e;
            }
            ztoolkit.log("[FulltextTranslate] Concurrent task failed", e);
          }
        }
      };
      const workers = Array.from({
        length: Math.min(limit, tasks.length)
      }, () => execute());
      await Promise.all(workers);
      return results;
    }
    protectMath(text) {
      let res = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
        this.mathCache.push({
          latex: p1,
          isBlock: true
        });
        return ` MTHZ${this.mathCache.length - 1}Z `;
      });
      res = res.replace(/\$([^$]+?)\$/g, (match, p1) => {
        this.mathCache.push({
          latex: p1,
          isBlock: false
        });
        return ` MTHZ${this.mathCache.length - 1}Z `;
      });
      return res;
    }
    async preloadMathSvgs(signal) {
      this.ensureActive(signal);
      if (this.mathCache.length === 0) {
        return;
      }
      this.progressElement = null;
      let completed = 0;
      const tasks = this.mathCache.map(item => async () => {
        this.ensureActive(signal);
        const prefix = item.isBlock ? "\\bg_white " : "\\bg_white \\inline ";
        const url = `https://latex.codecogs.com/svg.image?${encodeURIComponent(prefix + item.latex.trim())}`;
        try {
          const res = await window.fetch(url, {
            signal
          });
          this.ensureActive(signal);
          if (res.ok) {
            const svgText = await res.text();
            const match = svgText.match(/<svg[\s\S]*<\/svg>/i);
            if (match) {
              const cleanSvg = match[0];
              const b64 = window.btoa(unescape(encodeURIComponent(cleanSvg)));
              item.base64 = `data:image/svg+xml;base64,${b64}`;
            }
          }
        } catch (e) {}
        this.ensureActive(signal);
        completed++;
        this.updateProgress(completed, this.mathCache.length, item.latex, getString("fulltext-rendering-math"));
      });
      await this.runConcurrentTasks(tasks, 10, signal);
    }
    restoreAndRenderMath(text) {
      return text.replace(/MTHZ(\d+)Z/gi, (match, indexStr) => {
        const index = parseInt(indexStr);
        const item = this.mathCache[index];
        if (item && item.base64) {
          const style2 = item.isBlock ? `display: block; margin: 1em auto; max-width: 100%;` : `display: inline-block; vertical-align: middle; max-width: 100%;`;
          return `<img src="${item.base64}" style="${style2}" alt="${this.escapeHtml(getString("ui-formula"))}" />`;
        }
        if (item) {
          if (item.isBlock) {
            return `$$${item.latex}$$`;
          } else {
            return `$${item.latex}$`;
          }
        } else {
          return match;
        }
      });
    }
    async md2html(mdString, signal) {
      this.ensureActive(signal);
      let cleanedMdString = mdString.replace(/\n#{1,6}\s*(REFERENCES|References|参考文献)\b[\s\S]*/i, "");
      cleanedMdString = cleanedMdString.replace(/A\s*R\s*T\s*I\s*C\s*L\s*E\s*I\s*N\s*F\s*O/gi, "");
      const commentRegex = new RegExp("<!--[\\s\\S]*?-->", "g");
      cleanedMdString = cleanedMdString.replace(commentRegex, "");
      cleanedMdString = cleanedMdString.replace(/!\[.*?\]\(.*?\)/g, "");
      cleanedMdString = cleanedMdString.replace(/\\\*[a-zA-Zı]+\s/g, "");
      cleanedMdString = cleanedMdString.replace(/\\\*/g, "*");
      cleanedMdString = cleanedMdString.replace(/\n(#{1,6}\s)/g, "\n\n$1");
      const rawBlocks = cleanedMdString.split(/\n{2,}/).map(b => b.trim()).filter(b => b);
      const parsedBlocks = rawBlocks.map((b, idx) => ({
        id: idx,
        original: b,
        type: "normal"
      }));
      this.mathCache = [];
      let abstractIdx = -1;
      let abstractHeadingIdx = -1;
      let introIdx = -1;
      let keywordIdx = -1;
      for (let i = 0; i < parsedBlocks.length; i++) {
        this.ensureActive(signal);
        const b = parsedBlocks[i];
        const text = b.original;
        const noSpaceText = text.replace(/\s+/g, "").toLowerCase();
        b.originalProtected = this.protectMath(text);
        if (/^(ARTICLEINFO|抽象的|#+)$/i.test(noSpaceText) || /^#{1,6}\s*$/.test(text)) {
          b.type = "ignore";
          continue;
        }
        if (/^(Figure|Fig\.|图|Table|表)\s*\d+/i.test(text)) {
          b.type = "ignore";
          continue;
        }
        if (/^[a-zA-Z\s]{1,8}$/.test(text) && text.trim().length > 0) {
          b.type = "ignore";
          continue;
        }
        if (text.startsWith("$$") && text.endsWith("$$")) {
          b.type = "math";
          continue;
        }
        if (/<(table|tbody|thead|tr|td|th)\b[^>]*>/i.test(text)) {
          b.type = "table";
          b.originalProtected = b.originalProtected.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
          continue;
        }
        const hMatch = text.match(/^(#{1,6})\s+(.*)/);
        if (hMatch) {
          b.level = hMatch[1].length;
          b.type = `h${b.level}`;
          const noSpaceTitle = hMatch[2].replace(/\s+/g, "").toLowerCase();
          if (/^(abstract|摘要|抽象的?)$/.test(noSpaceTitle)) {
            abstractHeadingIdx = i;
            b.type = "ignore";
          } else if (/^(introduction|引言|导言|简介|一、简介|1\.引言)/i.test(noSpaceTitle) && introIdx === -1) {
            introIdx = i;
          }
          continue;
        }
        if (/^(keywords|关键词)/i.test(noSpaceText)) {
          b.type = "keywords";
          if (keywordIdx === -1) {
            keywordIdx = i;
          }
          continue;
        }
        if (b.type === "normal" && abstractIdx === -1) {
          if (/^(?:\*\*|_)?(?:A\s*b\s*s\s*t\s*r\s*a\s*c\s*t|摘要|抽象的?)(?:\*\*|_)?[\s:：.-]+(.+)/i.test(text)) {
            abstractIdx = i;
            ztoolkit.log(`[Abstract Strategy] \u7B56\u7565 1 \u547D\u4E2D (Inline \u6458\u8981\u5339\u914D) -> \u7D22\u5F15: ${i}`);
          }
        }
      }
      if (abstractIdx === -1 && abstractHeadingIdx !== -1) {
        for (let i = abstractHeadingIdx + 1; i < parsedBlocks.length; i++) {
          if (parsedBlocks[i].type === "normal" && parsedBlocks[i].original.length > 20) {
            abstractIdx = i;
            ztoolkit.log(`[Abstract Strategy] \u7B56\u7565 2 \u547D\u4E2D (Abstract \u6807\u9898\u540E\u7684\u9996\u4E2A\u6B63\u6587) -> \u7D22\u5F15: ${i}`);
            break;
          }
          if (parsedBlocks[i].type.startsWith("h")) {
            break;
          }
        }
      }
      if (abstractIdx === -1) {
        const limitBoundary = introIdx !== -1 ? introIdx : Math.min(parsedBlocks.length, 25);
        let maxLen = 0;
        for (let i = 0; i < limitBoundary; i++) {
          const b = parsedBlocks[i];
          if (b.type === "normal" && b.original.length > maxLen) {
            maxLen = b.original.length;
            abstractIdx = i;
          }
        }
        if (abstractIdx !== -1 && maxLen > 50) {
          ztoolkit.log(`[Abstract Strategy] \u7B56\u7565 3 \u547D\u4E2D (\u8FB9\u754C\u5185\u6700\u957F\u6BB5\u843D) -> \u7D22\u5F15: ${abstractIdx}, \u5B57\u7B26\u6570: ${maxLen}`);
        } else {
          ztoolkit.log(`[Abstract Strategy] \u6700\u7EC8\u672A\u627E\u5230\u5408\u9002\u7684\u6458\u8981\u5757\uFF01`);
        }
      }
      if (abstractIdx !== -1) {
        parsedBlocks[abstractIdx].type = "abstract";
      }
      await this.preloadMathSvgs(signal);
      const translatableBlocks = parsedBlocks.filter(b => b.type !== "math" && b.type !== "table" && b.type !== "ignore");
      let completedCount = 0;
      this.progressElement = null;
      const tasks = translatableBlocks.map(block => async () => {
        this.ensureActive(signal);
        let textToTranslate = block.originalProtected;
        if (block.type.startsWith("h")) {
          textToTranslate = textToTranslate.replace(/^(#{1,6})\s+/, "");
        }
        block.translated = await this.translateWithRetry(textToTranslate, 3, signal);
        this.ensureActive(signal);
        completedCount++;
        this.updateProgress(completedCount, translatableBlocks.length, textToTranslate, getString("fulltext-translating-text"));
        return block;
      });
      await this.runConcurrentTasks(tasks, this.CONCURRENCY_LIMIT, signal);
      let htmlString = `<div style="padding: 2em; padding-bottom: 0;">`;
      let bodyString = "";
      let isFirstH1 = true;
      for (const block of parsedBlocks) {
        this.ensureActive(signal);
        if (block.type === "ignore") {
          continue;
        }
        if (block.type === "table") {
          const safeTable = this.restoreAndRenderMath(block.originalProtected);
          bodyString += `
        <div style="overflow-x: auto; margin: 1em 0; padding: 1em; background: rgba(0,0,0,0.02); border: 1px dashed #ccc; border-radius: 0;">
          <style>
            .custom-html-table table { border-collapse: collapse; width: 100%; font-size: 0.85em; }
            .custom-html-table th, .custom-html-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .custom-html-table th { background-color: rgba(128, 188, 189, .2); }
          </style>
          <div class="custom-html-table">${safeTable}</div>
        </div>`;
          continue;
        }
        if (block.type === "math") {
          const cleanLatex = block.original.replace(/\$\$/g, "");
          bodyString += `<div style="text-align: center; margin: 1em 0; overflow-x: auto;">
          <img src="${this.mathCache.find(m => m.latex === cleanLatex)?.base64 || ""}" style="max-width: 100%;" />
        </div>`;
          continue;
        }
        const safeOriginal = this.restoreAndRenderMath(this.escapeHtml(block.originalProtected));
        const rawTranslated = block.translated || getString("fulltext-no-translation-result", {
          args: {
            text: block.originalProtected || ""
          }
        });
        const safeTranslated = this.restoreAndRenderMath(this.escapeHtml(rawTranslated));
        if (block.type.startsWith("h")) {
          const level = block.level;
          if (level === 1 && isFirstH1) {
            htmlString += `
            <h1 class="original-translated" style="margin-bottom: 0.2em;">${safeOriginal}</h1>
            <h1 class="original-translated" style="margin-top: 0.2em; color: #555;">${safeTranslated}</h1>
            <h1 class="translated">${safeTranslated}</h1>
            <hr style="opacity: .23; margin: 1em 0;"/>`;
            isFirstH1 = false;
          } else {
            bodyString += `
            <h${level} class="original-translated" style="margin-bottom: 0.2em;">${safeOriginal}</h${level}>
            <h${level} class="original-translated" style="margin-top: 0.2em; color: #555;">${safeTranslated}</h${level}>
            <h${level} class="translated">${safeTranslated}</h${level}>`;
          }
        } else if (block.type === "abstract") {
          const prefixRegex = /^(?:#*\s*)?(?:\*\*|_)?(?:A\s*b\s*s\s*t\s*r\s*a\s*c\s*t|摘要|抽象的?)(?:\*\*|_)?[\s:：.-]*/i;
          const cleanOrig = safeOriginal.replace(prefixRegex, "");
          const cleanTrans = safeTranslated.replace(prefixRegex, "");
          htmlString += `
          <div style="padding: 1em; background-color: rgba(128, 188, 189, .2); border-radius: 5px; border: 1px solid rgba(128, 188, 189, .7); text-align: justify; font-weight: normal; line-height: 1.5em; margin: .5em 0;">
            <div class="original-translated" style="margin-bottom: 0.8em;">
              <b style="color: rgba(255, 57, 57, 1);">${getString("fulltext-original-label")}</b>${cleanOrig}
            </div>
            <div class="original-translated">
              <b style="color: rgba(57, 134, 255, 1);">${getString("fulltext-translation-label")}</b>${cleanTrans}
            </div>
            <div class="translated">
              <b>${getString("fulltext-abstract-label")}</b>${cleanTrans}
            </div>
          </div>
        `;
        } else if (block.type === "keywords") {
          htmlString += `
          <div style="margin: .5em 0; font-style: italic;">
            <span class="original-translated" style="display: block;">${safeOriginal}</span>
            <span class="original-translated" style="display: block;">${safeTranslated}</span>
            <span class="translated" style="display: block;">${safeTranslated}</span>
          </div>
          <hr style="opacity: .23; margin: 1em 0;"/>`;
        } else {
          bodyString += `<span class="original-translated" style="display: block;text-indent: 2em; line-height: 1.5em; margin-top: .5em; border-left: .2em solid rgba(255, 57, 57, 1); padding-left: .5em; background-color: rgba(255, 57, 57, .02);">${safeOriginal}</span>`;
          bodyString += `<span class="original-translated" style="display: block;text-indent: 2em; line-height: 1.5em; margin-bottom: .5em; border-left: .2em solid rgba(57, 134, 255, 1); padding-left: .5em; background-color: rgba(57, 134, 255, .02);">${safeTranslated}</span>`;
          bodyString += `<span class="translated" style="display: block;text-indent: 2em; line-height: 1.5em; margin: .5em 0;">${safeTranslated}</span>`;
        }
      }
      htmlString += `</div><div style="padding: 2em; padding-top: 0;">${bodyString}</div>`;
      return `
    <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          body[original] .translated { display: none !important; }
          body:not([original]) .original-translated { display: none !important; }
        </style>
      </head>
      <body>
        ${htmlString}
      </body>
    </html>
    `;
    }
    escapeHtml(unsafe) {
      if (!unsafe) {
        return "";
      }
      return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    async attachSnapshot(htmlString, itemID, signal) {
      const pdfItem = await Zotero.Items.getAsync(itemID);
      this.ensureActive(signal);
      if (!pdfItem) {
        throw new Error(getString("fulltext-pdf-path-unavailable"));
      }
      const attItem = await Zotero.Attachments.importFromSnapshotContent({
        title: pdfItem.parentItem?.getField("title"),
        url: "https://github.com/MuiseDestiny/zotero-style",
        snapshotContent: htmlString,
        libraryID: pdfItem.libraryID,
        parentItemID: pdfItem.parentID
      });
      this.ensureActive(signal);
      attItem.addTag("全文翻译");
      Zotero.Reader.open(attItem.id);
    }
    async translateWithRetry(text, retries = 3, signal) {
      this.ensureActive(signal);
      if (!text || text.trim().length <= 2 || /^(MTHZ\d+Z|\s)+$/.test(text)) {
        return text;
      }
      for (let i = 0; i < retries; i++) {
        this.ensureActive(signal);
        try {
          const res = await this.translate(text, signal);
          this.ensureActive(signal);
          if (res && res.trim() !== "" && res !== getString("ui-translation-failed") && res !== getString("fulltext-translate-missing-plugin")) {
            return res;
          }
        } catch (e) {}
        await this.delay(1000 + Math.random() * 2000, signal);
      }
      return getString("fulltext-translation-failed-original", {
        args: {
          text
        }
      });
    }
    async translate(text, signal) {
      this.ensureActive(signal);
      const sl = Zotero.Prefs.get("ZoteroPDFTranslate.sourceLanguage") || "auto";
      const tl = Zotero.Prefs.get("ZoteroPDFTranslate.targetLanguage") || "zh-Hans";
      const translate = Zotero.PDFTranslate?.api?.translate;
      if (typeof translate !== "function") {
        return getString("fulltext-translate-missing-plugin");
      }
      try {
        const res = await translate.call(Zotero.PDFTranslate.api, text, {
          pluginID: config.addonID,
          langto: tl
        });
        this.ensureActive(signal);
        if (res.status == "success") {
          return res.result;
        }
      } catch (e) {}
      const request = buildMicrosoftTranslationRequest(text, sl, tl);
      const msRes = await Zotero.HTTP.request("POST", request.url, {
        body: request.body,
        headers: {
          "content-type": "application/json"
        },
        timeout: 30000,
        successCodes: false
      });
      this.ensureActive(signal);
      if (msRes.status == 200) {
        return parseMicrosoftTranslationResponse(msRes.responseText || msRes.response) || getString("ui-translation-failed");
      }
      return getString("ui-translation-failed");
    }
  };

