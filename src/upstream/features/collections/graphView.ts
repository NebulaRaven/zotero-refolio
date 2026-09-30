import { getString,getErrorMessage } from "../../utils/locale.ts";
import type { GraphData } from '../../../core/models.ts';
import { setPref } from "../../utils/prefs.ts";
import { getPref } from "../../utils/prefs.ts";
import { requireItemsView } from "../../utils/zoteroPane.ts";
import { spReadGraphTheme } from "../../../app/graphTheme.ts";
import { config } from "../../config.ts";
import { spFilterGraph,spGraphLabel,spSharedGraph } from "../../../core/graph.ts";
import { getFirstSelectedCollection,getFirstSelectedLibraryID } from "../../utils/zoteroSelection.ts";
import { spBuildGraphControls,spMakeGraphResizable } from "../../../app/graphControls.ts";
import { spElement } from "../../../app/ui.ts";
import { spGetCitationGraph } from "../../../app/citations.ts";
import { spPromptEmptyCitationGraph } from "../../../app/citationPrompts.ts";
  // src/features/collections/graphView.ts
  export class GraphView {
    declare active: boolean;
    declare status: HTMLParagraphElement;
    declare tooltip: HTMLDivElement;
    declare genealogyPanel: HTMLDivElement;
    declare genealogyData: GraphData;
    declare cancelGenealogy: () => void;
    declare syncControls: () => void;
    declare syncGenealogyAuthors: () => void;
    declare getGenealogyGraph: () => GraphData;
    declare showGenealogyPerson: (id: string, expanded?: boolean) => void;
    declare cleanups: Array<() => void | Promise<void>>;
    declare timers: Set<number>;
    declare animationFrames: Set<number>;
    declare _prefObserverID: any;
    declare _onSelectHandler: () => void;
    declare onUnload: () => void;
    declare refreshGraphView: () => Promise<void>;
    declare refreshGeneration: number;
    declare positions: Map<any, any>;
    declare modeFunction: Record<string, (items: Zotero.Item[]) => GraphData | Promise<GraphData>>;
    declare mode: string;
    declare _themeMedia: MediaQueryList;
    declare renderer: any;
    declare graph: GraphData;
    declare container: any;
    declare resizer: any;
    declare renderedContext: any;
    declare frame: HTMLIFrameElement;
    declare rendererReady: Promise<void> | undefined;
    declare selectionTimer: number | undefined;

    constructor() {
      this.active = true;
      this.cleanups = [];
      this.timers = /* @__PURE__ */new Set();
      this.animationFrames = /* @__PURE__ */new Set();
      this._prefObserverID = null;
      this._onSelectHandler = null;
      this.onUnload = () => this.destroy();
      this.refreshGraphView = async () => {
        if (!this.active || this.container?.style.display === "none" || !this.renderer) {
          return;
        }
        const generation = this.refreshGeneration = (this.refreshGeneration || 0) + 1;
        this.syncControls?.();
        const graph = await this.getGraph();
        if (this.active && generation === this.refreshGeneration) this.setData(graph);
      };
      this.positions = new Map();
      this.refreshGeneration = 0;
      this.modeFunction = {
        citations: this.getGraphByCitationLink.bind(this),
        note: this.getGraphByNoteLink.bind(this),
        author: this.getGraphByAuthorLink.bind(this),
        tag: this.getGraphByTagLink.bind(this)
      };
      if (getPref("function.citationGraph.enable") === false) delete this.modeFunction.citations;
      if (getPref("function.genealogy.enable") !== false) this.modeFunction.genealogy = () => this.getGenealogyGraph?.() || { nodes: {} };
      this.mode = getPref("graphView.mode") || "citations";
      if (!this.modeFunction[this.mode]) this.mode = Object.keys(this.modeFunction)[0];
      window.addEventListener("unload", this.onUnload, {
        once: true
      });
      this.init().catch(error => {
        if (this.active) {
          ztoolkit.log("Failed to initialize graph view", error);
        }
      });
      addon.api.refreshGraphView = this.refreshGraphView;
    }
    async init() {
      await this.createContainer();
      if (!this.active) {
        return;
      }
      this.registerButton();
      this.observeTheme();
    }
    observeTheme() {
      const media = this._themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => {
        if (this.active) this.setTheme();
      };
      media.addEventListener("change", update);
      this.cleanups.push(() => {
        media.removeEventListener("change", update);
        this._themeMedia = null;
      });
      const prefKey = "browser.theme.toolbar-theme";
      this._prefObserverID = Zotero.Prefs.registerObserver(prefKey, update, true);
      update();
    }
    destroy() {
      if (!this.active) {
        return;
      }
      this.active = false;
      window.removeEventListener("unload", this.onUnload);
      for (const timer of this.timers) {
        window.clearTimeout(timer);
      }
      this.timers.clear();
      for (const frame of this.animationFrames) {
        window.cancelAnimationFrame(frame);
      }
      this.animationFrames.clear();
      if (this._prefObserverID != null) {
        try {
          Zotero.Prefs.unregisterObserver(this._prefObserverID);
        } catch (error) {
          ztoolkit.log("Failed to unregister graph theme observer", error);
        }
        this._prefObserverID = null;
      }
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch (error) {
          ztoolkit.log("Failed to clean up graph view", error);
        }
      }
      try {
        this.renderer?.destroy?.();
      } catch (error) {
        ztoolkit.log("Failed to destroy graph renderer", error);
      }
      this.renderer = undefined;
      try {
        this.container?.remove();
      } catch {}
      this.positions?.clear();
      this.graph = undefined;
      if (addon.api.refreshGraphView === this.refreshGraphView) {
        delete addon.api.refreshGraphView;
      }
    }
    getTheme() {
      const preference = Zotero.Prefs.get("browser.theme.toolbar-theme", true);
      const media = this._themeMedia || window.matchMedia("(prefers-color-scheme: dark)");
      return preference === 0 ? "dark" : preference === 1 ? "light" : media.matches ? "dark" : "light";
    }
    setTheme() {
      if (!this.active || !this.renderer || !this.container || !this.resizer) {
        return;
      }
      const theme = this.getTheme();
      this.container.style.colorScheme = theme;
      const palette = spReadGraphTheme(this.container);
      this.renderer.colors = palette.colors;
      this.renderer.fontFamily = palette.fontFamily;
      this.container.style.backgroundColor = palette.background;
      this.resizer.style.backgroundColor = palette.border;
      this.renderer.containerEl.style.backgroundColor = palette.background;
      const frameDocument = this.renderer.containerEl.ownerDocument;
      frameDocument.documentElement.style.colorScheme = theme;
      frameDocument.documentElement.style.backgroundColor = palette.background;
      frameDocument.body.style.backgroundColor = palette.background;
      frameDocument.body.style.color = palette.text;
      frameDocument.body.style.fontFamily = palette.fontFamily;
      for (const node of this.renderer.nodes || []) if (node.text) node.text.style.fontFamily = palette.fontFamily;
      this.renderer.testCSS();
    }
    /**
     * 从其他面板切换到条目面板并显示节点的更新
     * @returns
     */
    async blink() {
      if (!this.active) {
        return;
      }
      if (this.container.style.display == "none" || this.mode != "note") {
        return;
      }
      const originalID = Zotero_Tabs.selectedID;
      Zotero_Tabs.select("zotero-pane");
      await this.selectNode(Zotero.BetterNotes.data.workspace.mainId);
      this.schedule(async () => {
        this.setData(await this.getGraph());
        this.schedule(() => {
          Zotero_Tabs.select(originalID);
        }, 2000);
      }, 500);
    }
    registerButton() {
      const node = document.querySelector("#zotero-tb-note-add");
      const insertionPoint = node?.nextElementSibling;
      if (!insertionPoint) {
        return;
      }
      const tbNode = ztoolkit.UI.insertElementBefore({
        tag: "toolbarbutton",
        id: config.addonRef,
        classList: ["zotero-tb-button"],
        attributes: {
          tooltiptext: getString("ui-feature-graphView"),
          type: "panel"
        },
        children: [{
          namespace: "xul",
          tag: "image",
          styles: {
            listStyleImage: `url(chrome://${config.addonRef}/content/icons/refolio.svg)`,
            width: "18px",
            height: "18px"
          }
        }],
        listeners: [{
          type: "click",
          listener: async event => {
            const node2 = this.container;
            if (!node2) {
              return;
            }
            if (node2.style.display == "none") {
              node2.style.display = "flex";
              setPref(`graphView.enable`, true);
              const firstOpen = !this.rendererReady;
              await this.ensureRenderer();
              if (!firstOpen) await this.refreshGraphView();
              await this.promptForCitationRelations();
            } else {
              node2.style.display = "none";
              setPref(`graphView.enable`, false);
            }
          }
        }]
      }, insertionPoint);
      this.cleanups.push(() => tbNode.remove());
    }
    /**
     * 这里学习connected papers只显示一个姓氏
     * 比较简洁，当前版本使用item.id作为id，无需担心重复问题
     * @param item
     * @returns
     */
    getItemDisplayText(item) {
      return spGraphLabel(item, getPref("graphView.labelField") || "authorYear", getPref("graphView.extraLabelKey") || "Graph Label");
    }
    async getGraphByCitationLink(items) {
      return spGetCitationGraph(items.filter(item => item.isRegularItem?.()));
    }
    async promptForCitationRelations() {
      const libraryID = getFirstSelectedLibraryID();
      const current = () => this.active && this.mode === "citations" && this.container?.style.display !== "none"
        && getFirstSelectedLibraryID() === libraryID;
      try { await spPromptEmptyCitationGraph(libraryID, current); }
      catch (error) { if (this.active) this.status.textContent = getErrorMessage(error); Zotero.logError(error); }
    }
    async getGraph() {
      const mode = this.mode;
      if (!mode) return { nodes: {} };
      const items = ZoteroPane.getSortedItems();
      const collection = getFirstSelectedCollection();
      const context = `${mode}:${getFirstSelectedLibraryID()}:${collection?.key || "library"}`;
      const raw: GraphData = await this.modeFunction[mode](items);
      raw.context = context;
      if (mode === "genealogy") {
        return raw;
      }
      for (const [id, node] of Object.entries(raw.nodes)) {
        if (node.type !== "item") continue;
        const item = Zotero.Items.get(Number(id));
        if (!item) continue;
        node.label = this.getItemDisplayText(item);
        node.fullLabel = item.getDisplayTitle?.() || item.getField("title") || node.label;
        let date = "";
        try { date = item.getField("date") || ""; } catch {}
        const year = String(date).match(/\b(\d{4})\b/);
        node.year = year ? Number(year[1]) : null;
      }
      const options = {
        scope: getPref("graphView.scope") || "selected", depth: Number(getPref("graphView.depth") || 1),
        minYear: getPref("graphView.minYear") || "", maxYear: getPref("graphView.maxYear") || "",
        hideIsolated: Boolean(getPref("graphView.hideIsolated"))
      };
      const seeds = ZoteroPane.getSelectedItems().map(item => item.id);
      const graph = spFilterGraph(raw, seeds, options);
      graph.totalNodes = Object.keys(raw.nodes).length;
      graph.noSelection = options.scope === "selected" && !seeds.length;
      graph.yearFiltered = Boolean(options.minYear || options.maxYear);
      return graph;
    }
    getGraphByNoteLink(items) {
      const noteItems = items.filter(item => item.itemType == "note");
      items.filter(item => item.itemType != "note").forEach(item => {
        item.getNotes().forEach(async id => {
          try {
            noteItems.push(Zotero.Items.get(id));
          } catch {}
        });
      });
      const nodes = {};
      const graph = {
        nodes
      };
      noteItems.forEach((noteItem, i) => {
        const id = noteItem.id;
        nodes[id] = {
          links: {},
          type: "item"
        };
        noteItem.getNote().match(/zotero:\/\/note\/u\/\w+/g)?.forEach(s => {
          const noteKey = s.split("/").slice(-1)[0];
          if (noteKey == noteItem.key) {
            return;
          }
          const linkedNoteItem = Zotero.Items.getByLibraryAndKey(noteItem.libraryID, noteKey);
          if (linkedNoteItem && !linkedNoteItem.deleted) nodes[id].links[linkedNoteItem.id] = true;
        });
        noteItem.getTags().forEach(tag => {
          (nodes[tag.tag] ??= {
            links: {},
            type: "tag"
          }).links[id] = true;
        });
      });
      return graph;
    }
    getGraphByAuthorLink(items: Zotero.Item[]) {
      return spSharedGraph(items.filter(item => item.isRegularItem?.()), item => item.getCreators().map(person =>
        [person.firstName, person.lastName].filter(Boolean).join(" ").trim()));
    }
    getGraphByTagLink(items: Zotero.Item[]) {
      return spSharedGraph(items.filter(item => item.isRegularItem?.()), item => item.getTags().map(tag => tag.tag).filter(tag => !tag.startsWith("/")));
    }
    async createContainer() {
      document.querySelectorAll("#graph").forEach(e => e.remove());
      const getTreeNode = () => document.querySelector("#item-tree-main") || document.querySelector("#item-tree-main-default");
      while (this.active && !getTreeNode()) {
        await Zotero.Promise.delay(10000);
      }
      if (!this.active) {
        return;
      }
      const mainNode = getTreeNode();
      const minHeight = 200;
      const container = ztoolkit.UI.createElement(document, "div", {
        id: "graph",
        styles: {
          width: "100%",
          minHeight: `${minHeight}px`,
          height: getPref(`graphView.height`),
          display: getPref(`graphView.enable`) ? "" : "none",
          backgroundColor: "transparent"
        }
      });
      spBuildGraphControls(this, container);
      const frame = this.frame = ztoolkit.UI.createElement(document, "iframe", {
        namespace: "html"
      });
      // Set the iframe's inherited scheme before it loads to avoid a white flash.
      container.style.colorScheme = this.getTheme();
      container.append(frame);
      mainNode.append(container);
      this.container = container;
      const resizer = this.resizer = spElement(document, "div");
      resizer.className = "sp-graph-resizer";
      container.insertBefore(resizer, frame);
      spMakeGraphResizable(this, container, resizer, minHeight);
      if (container.style.display !== "none") {
        await this.ensureRenderer();
        this.schedule(() => this.promptForCitationRelations(), 0);
      }
      if (this.active) {
        this.setTheme();
      }
    }
    ensureRenderer() {
      if (!this.active) return Promise.resolve();
      if (!this.rendererReady) {
        this.frame.setAttribute("src", `chrome://${config.addonRef}/content/dist/index.html`);
        this.rendererReady = this.initIFrame(this.frame).then(() => this.setTheme());
      }
      return this.rendererReady;
    }
    queueSelectionRefresh() {
      if (this.selectionTimer !== undefined || !this.active || this.container.style.display === "none") return;
      this.selectionTimer = this.schedule(async () => {
        this.selectionTimer = undefined;
        if (this.container.style.display === "none") return;
        this.syncGenealogyAuthors?.();
        if (this.mode !== "genealogy") await this.refreshGraphView();
      }, 0);
    }
    async initIFrame(frame) {
      while (this.active && (!frame.contentWindow.renderer || !ZoteroPane.itemsView || !requireItemsView().onSelect)) {
        await Zotero.Promise.delay(100);
      }
      if (!this.active) {
        return;
      }
      const renderer = this.renderer = frame.contentWindow.renderer;
      this.renderer.containerEl.style.height = "100%";
      const selection = requireItemsView().onSelect;
      const onSelect = this._onSelectHandler = () => this.queueSelectionRefresh();
      selection.addListener(onSelect);
      this.cleanups.push(() => {
        selection.removeListener(onSelect);
        this._onSelectHandler = null;
      });
      const onNodeClick = (e, id, type) => {
        ztoolkit.log(e, id, type);
        if (type == "item") {
          if (e.ctrlKey || e.metaKey) {
            requireItemsView().selectItems(ZoteroPane.getSelectedItems(true).concat([Number(id)]));
          } else {
            requireItemsView().selectItem(Number(id));
          }
        } else if (type == "person") {
          this.showGenealogyPerson?.(id);
        } else if (type == "tag") {
          const graph = this.graph;
          if (!graph) {
            return;
          }
          ztoolkit.log(id, graph.nodes);
          const ids = Object.keys(graph.nodes[id].links).filter(id2 => {
            return graph.nodes[id2].type == "item";
          });
          requireItemsView().selectItems(ids.map(Number));
        }
      };
      renderer.onNodeClick = onNodeClick;
      renderer.onNodeHover = (_event, id) => {
        const node = this.graph?.nodes[id];
        if (!node || !this.tooltip) return;
        this.tooltip.textContent = node.fullLabel || [node.label || id, node.description].filter(Boolean).join("\n");
        this.tooltip.hidden = false;
      };
      renderer.onNodeUnhover = () => { if (this.tooltip) this.tooltip.hidden = true; };
      this.cleanups.push(() => { renderer.onNodeHover = null; renderer.onNodeUnhover = null; });
      this.cleanups.push(() => {
        if (renderer.onNodeClick === onNodeClick) {
          renderer.onNodeClick = null;
        }
      });
      const handleDoubleClick = () => {
        this.schedule(() => this.refreshGraphView(), 0);
      };
      frame.addEventListener("dblclick", handleDoubleClick);
      const observer = new window.ResizeObserver(() => { if (this.active) renderer.onResize(); });
      observer.observe(frame);
      this.cleanups.push(() => {
        observer.disconnect();
        frame.removeEventListener("dblclick", handleDoubleClick);
      });
      await this.refreshGraphView();
    }
    async selectNode(id) {
      if (!this.active || !this.renderer) {
        return;
      }
      const node = this.renderer.nodes.find(node2 => Number(node2.id) == id);
      this.renderer.highlightNode = node;
      if (!node) {
        return;
      }
      const f = window.devicePixelRatio;
      const canvas = this.renderer.interactiveEl;
      const X = f * canvas.width / 2 - node.x * this.renderer.scale;
      const Y = f * canvas.height / 2 - node.y * this.renderer.scale;
      const panX = this.renderer.panX;
      const panY = this.renderer.panY;
      const duration = 500;
      const startTime = window.performance.now();
      const easeInOutQuad = t3 => t3 < 0.5 ? t3 * 2 * t3 : -1 + (4 - t3 * 2) * t3;
      const animate = currentTime => {
        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);
        progress = easeInOutQuad(progress);
        this.renderer.setPan(panX + (X - panX) * progress, panY + (Y - panY) * progress);
        this.renderer.changed();
        if (progress < 1) {
          this.requestFrame(animate);
        } else {
          this.renderer.setPan(X, Y);
          this.renderer.changed();
        }
      };
      this.requestFrame(animate);
      this.schedule(() => {
        this.renderer.highlightNode = undefined;
        this.renderer.changed();
      }, 1500);
    }
    fitGraph() {
      const renderer = this.renderer;
      if (!this.active || !renderer?.nodes.length) return;
      const nodes = renderer.nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y));
      if (!nodes.length) return;
      const ratio = window.devicePixelRatio || 1;
      const minX = Math.min(...nodes.map(node => node.x)), maxX = Math.max(...nodes.map(node => node.x));
      const minY = Math.min(...nodes.map(node => node.y)), maxY = Math.max(...nodes.map(node => node.y));
      const scale = Math.max(0.1, Math.min(2 * ratio, renderer.width * ratio / (maxX - minX + 220), renderer.height * ratio / (maxY - minY + 160)));
      renderer.targetScale = scale; renderer.setScale(scale);
      renderer.setPan(renderer.width * ratio / 2 - (minX + maxX) / 2 * scale, renderer.height * ratio / 2 - (minY + maxY) / 2 * scale);
      renderer.changed();
    }
    setData(graph: GraphData) {
      if (!this.active || !this.renderer) return;
      this.graph = graph;
      const renderer = this.renderer;
      this.positions ||= new Map();
      for (const node of renderer.nodes) {
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) this.positions.set(`${this.renderedContext}:${node.id}`, [node.x, node.y]);
      }
      while (this.positions.size > 2000) this.positions.delete(this.positions.keys().next().value);
      const positions = Object.fromEntries(Object.keys(graph.nodes || {}).flatMap(id => {
        const value = this.positions.get(`${graph.context}:${id}`); return value ? [[id, value]] : [];
      }));
      renderer.setData({ ...graph, positions });
      this.renderedContext = graph.context;
      renderer.setRenderOptions?.({ showArrow: ["citations", "note", "genealogy"].includes(this.mode) });
      const display = this.getItemDisplayText.bind(this);
      renderer.nodes.forEach(node => {
        const metadata = graph.nodes?.[node.id];
        if (metadata) {
          node.getDisplayText = () => metadata.label || (node.type === "item" ? display(Zotero.Items.get(Number(node.id))) : node.id);
        } else if (!node._getDisplayText) {
          node.getDisplayText = () => node.type === "item" ? display(Zotero.Items.get(Number(node.id))) : node.id;
        }
        node._getDisplayText ||= node.getDisplayText;
        if (node.text) node.text.text = node.getDisplayText();
      });
      if (this.tooltip) this.tooltip.hidden = true;
      if (this.status) {
        const nodes = Object.keys(graph.nodes || {}).length;
        const directed = ["citations", "note", "genealogy"].includes(this.mode);
        const edges = new Set(Object.entries(graph.nodes || {}).flatMap(([id, node]) => Object.keys(node.links).map(other =>
          JSON.stringify(directed ? [id, other] : [id, other].sort())))).size;
        const descriptions = {
          citations: getString("ui-citing-paper-cited-paper"),
          author: getString("ui-papers-sharing-an-author-name"),
          tag: getString("ui-papers-sharing-a-complete-tag"),
          note: getString("ui-note-linked-note")
        };
        let status = `${descriptions[this.mode] || ""} · ${getString("ui-graph-counts", { args: { nodes, links: edges } })}`;
        if (!this.mode) status = getString("ui-no-graph-views");
        if (this.mode === "citations" && !graph.citationDataAvailable) status = getString("ui-fetch-citations-to-build-graph");
        if (graph.noSelection) status = getString("ui-select-a-paper-or-choose-current-view");
        if (graph.yearFiltered) status += getString("ui-undated-items-excluded");
        if (this.mode === "genealogy") {
          status = graph.center || edges ? (graph.sourceMode === "manual" ? getString("ui-local") : "") + (graph.kind === "doctoral" ? getString("ui-doctoral-advisor-doctoral-student") : getString("ui-teacher-student-2")) + ` · ${getString("ui-genealogy-counts", { args: { people: nodes, relationships: edges } })}`
            : getString("ui-search-for-an-author-or-add-a-manual-relationship");
          if (graph.center && !edges) status += getString("ui-no-relationships-recorded");
          if (graph.truncated) status += getString("ui-limited-to-80-neighbours-click-a-person-to-explore");
        }
        this.status.textContent = status;
      }
      renderer.changed(); renderer.onResize();
    }
    schedule(callback, delay) {
      if (!this.active) {
        return undefined;
      }
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        if (!this.active) {
          return;
        }
        Promise.resolve().then(() => { if (this.active) return callback(); }).catch(error => {
          ztoolkit.log("Failed to run graph view task", error);
        });
      }, delay);
      this.timers.add(timer);
      return timer;
    }
    requestFrame(callback) {
      if (!this.active) {
        return undefined;
      }
      const frame = window.requestAnimationFrame(timestamp => {
        this.animationFrames.delete(frame);
        if (this.active) {
          callback(timestamp);
        }
      });
      this.animationFrames.add(frame);
      return frame;
    }
  };
