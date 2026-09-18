import type { TagElement } from '../../../types/ui.ts';
import { requireItemsView } from "../../utils/zoteroPane.ts";
import { getPref,setPref } from "../../utils/prefs.ts";
import { ColorRNA_default } from "../../../vendor/index.js";
import { appendOwnedEntry } from "../../utils/ownedResource.ts";
import { requireCollectionsView } from "../../utils/zoteroPane.ts";
import { getElements } from "../../utils/dom.ts";
import { getFirstSelectedCollectionID,getFirstSelectedLibraryID } from "../../utils/zoteroSelection.ts";
import { getString, getErrorMessage } from "../../utils/locale.ts";
import { buildMenuPopup } from "../../platform/zotero/menu.ts";
import { spRemoveTags,spRenameTags,spTagWithin } from "../../../core/tags.ts";
import { isEnabel,registerShortcut } from "../../utils/base.ts";
import { getSelectedReaderAnnotations } from "../../utils/reader.ts";
  // src/features/tags/tags.ts
  export var Tags = class _Tags {
    declare active: boolean;
    declare cleanups: Array<() => void | Promise<void>>;
    declare linkSymbol: string;
    declare props: { icon: { size: number; right: number; svg: string; }; item: { padding: number; }; tree: { size: number; }; color: { hover: string; select: string; }; sorted: string[]; };
    declare plainTags: string[];
    declare searchJoinMode: "all" | "any";
    declare annotationsID: string;
    declare nestedTagsID: string;
    declare state: Record<string, any>;
    declare tagsIn: { items: string[]; collection: string[]; };
    declare tagsIns: Map<string, { collection: string[]; items: string[] }>;
    declare _nestedTagsCache: { key: any; result: {}; };
    declare _cachedSortMode: number;
    declare getTagPrefixes: () => any[];
    declare containerID: string;
    declare onSelect: any;
    declare collectionItems: any;
    declare nestedTags: any;
    declare nestedTagsContainer: HTMLElement;
    declare container: HTMLElement;
    declare searchText: string;
    private timers = new Set<number>();
    private renderGeneration = 0;
    private initGeneration = 0;

    schedule(callback: () => void | Promise<void>, delay = 0) {
      if (!this.active) return undefined;
      const generation = this.renderGeneration;
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        Promise.resolve().then(() => {
          if (this.active && generation === this.renderGeneration) return callback();
        }).catch(error => ztoolkit.log("Nested tag update failed", error));
      }, delay);
      this.timers.add(timer);
      return timer;
    }
    cancelTimer(timer: number | undefined) {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      this.timers.delete(timer);
    }
    clearRenderTimers() {
      this.renderGeneration++;
      for (const timer of this.timers) window.clearTimeout(timer);
      this.timers.clear();
    }

    constructor(containerID = "zotero-tag-selector", onSelect = undefined) {
      this.active = true;
      this.cleanups = [];
      this.linkSymbol = "/";
      this.props = {
        icon: {
          size: 10,
          right: 3,
          svg: ""
        },
        item: {
          padding: 6
        },
        tree: {
          size: 2
        },
        color: {
          hover: "#e4e4e4",
          select: "#4072e5"
          // select: "#9384D1"
        },
        sorted: [getString("ui-tag-ascending"), getString("ui-tag-descending"), getString("ui-frequency-ascending"), getString("ui-frequency-descending")]
      };
      this.plainTags = [];
      this.searchJoinMode = "all";
      this.annotationsID = "zotero-item-pane-message-box";
      this.nestedTagsID = "nested-tags-container";
      /**
       * 用于记录层级标签的选择状态和折叠状态，使得刷新时候保持
       */
      this.state = {};
      this.tagsIn = {
        items: [],
        collection: []
      };
      this.tagsIns = new Map();
      this._nestedTagsCache = null;
      this._cachedSortMode = null;
      /**
       * 用于获取标签的开头
       * 从[plainTag, index]解析，记录在this.state里
       * @returns
       */
      this.getTagPrefixes = () => {
        const keys2 = Object.keys(this.state).filter(key => this.state[key].select);
        if (keys2.length == 0) {
          return [];
        }
        const tagStartArr = keys2.map(k => this.key2tag(k));
        return tagStartArr;
      };
      this.containerID = containerID;
      this.onSelect = onSelect;
      this.props.icon.svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.props.icon.size}" height="${this.props.icon.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
      try {
        this.prepare();
      } catch (error) {
        this.destroy();
        throw error;
      }
    }
    /**
     * 用于执行只需要执行一次的逻辑
     */
    prepare() {
      const c = new ColorRNA_default(this.props.color.select);
      const displayAllTags = Zotero.Prefs.get("tagSelector.displayAllTags");
      const [red, green, blue] = c.rgb();
      const styles = ztoolkit.UI.createElement(document, "style", {
        namespace: "html",
        id: `${this.containerID}-nested-tags-style`,
        properties: {
          innerHTML: `
          .nested-tags-control-icon {
            margin: 0 .5em;
            padding: 5px;
            transition: opacity .23s;
          }
          .tag-selector, .nested-tags-box {
            border-top: var(--material-border-quarternary);
            align-items: center;
          }

          #${this.nestedTagsID} .item {
            margin: .1em 0;
            transition: background-color .1s linear, opacity .1s linear;
          }
          #${this.annotationsID} * {
            transition: background-color .1s linear;
          }
          #${this.nestedTagsID} .item:hover {
            cursor: pointer;
            background-color: ${this.props.color.hover};
          }
          #${this.nestedTagsID} .item:not(.not-in-items):not(.selected):hover {
            background-color: rgba(${red}, ${green}, ${blue}, .23) !important;
          }
          #${this.nestedTagsID} .item.selected:hover {
            background-color: rgba(${red}, ${green}, ${blue}, 1);
          }
          #${this.nestedTagsID} .item.not-in-items {
            opacity: 1;
          }
          #${this.nestedTagsID} .item.not-in-collection {
            opacity: .23;
            ${displayAllTags ? "" : "display: none;"}
            cursor: default;
          }
          #${this.nestedTagsID} .item.selected {
            color: white;
            background-color: rgba(${red}, ${green}, ${blue}, .9);
          }
          #zotero-tag-selector {
            display: flex;
            flex-direction: column;
            align-items: center;

          }
          
          #zotero-tag-selector .tag-selector-list  {
            height: auto !important;
          }
          .nested-search-box .icon {
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0.8;
          }
          .nested-search-box .icon:hover {
            opacity: 1
          }

          .menu-item:hover{
            background-color: var(--color-quinary-on-sidepane);
          }
        `
        }
      });
      document.documentElement.appendChild(styles);
      this.cleanups.push(() => styles.remove());
      if (this.onSelect) {
        return;
      }
      const filterItems = async (items: Zotero.Item[], row: Zotero.CollectionTreeRow) => {
        if (!this.active) return items;
        this.collectionItems ??= items;
        const prefixes = this.getTagPrefixes();
        if (!prefixes.length) return items;
        const search = row.isFeeds() ? new Zotero.Search() : new Zotero.Search({ libraryID: row.ref.libraryID });
        if (row.isFeeds()) search.addCondition("feed", "true");
        if (row.isTrash()) search.addCondition("deleted", "true");
        const scope = await row.getSearchObject();
        if (!this.active) return items;
        search.setScope(scope, true);
        search.addCondition("joinMode", this.searchJoinMode);
        for (const tag of prefixes) search.addCondition("tag", "contains", tag);
        const ids = new Set(await search.search());
        if (!this.active) return items;
        return items.filter(item => ids.has(item.id));
      };
      this.cleanups.push(appendOwnedEntry(addon.data.patch.getItems.data, filterItems));
      const collectionsView = requireCollectionsView();
      collectionsView.onSelect.addListener(addon.hooks.onCollectionSelect);
      this.cleanups.push(() => {
        collectionsView.onSelect.removeListener(addon.hooks.onCollectionSelect);
      });
    }
    destroy() {
      if (!this.active) {
        return;
      }
      this.active = false;
      this.initGeneration++;
      this.clearRenderTimers();
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch (error) {
          ztoolkit.log("Failed to clean up nested tags", error);
        }
      }
      this.container?.querySelectorAll(".nested-tags").forEach(node => {
        node.remove();
      });
      this.container?.childNodes.forEach(node => {
        const element = node as HTMLElement;
        if (element.style) {
          element.style.display = "";
        }
      });
      this.collectionItems = undefined;
      this.plainTags = [];
      this.tagsIn = {
        items: [],
        collection: []
      };
      this.tagsIns = new Map();
      this._nestedTagsCache = null;
      this.state = {};
      this.onSelect = undefined;
      if (addon.api.tagsUI === this) {
        delete addon.api.tagsUI;
      }
    }
    /**
     * 确保container已初始化
     * @param force 不经任何条件判断
     * @returns
     */
    async init(force = false) {
      if (!this.active) {
        return;
      }
      const generation = ++this.initGeneration;
      this.container ??= document.querySelector("#" + this.containerID);
      const plainTags = await this.getPlainTags();
      if (!this.active || generation !== this.initGeneration) {
        return;
      }
      this.tagsIns = new Map();
      if (!force) {
        if (
        // 与上次状态相同
        plainTags.length === this.plainTags.length && plainTags.join("\0") === this.plainTags.join("\0") ||
        // this._state == JSON.stringify(this.state)
        // 未处于当前视图
        this.nestedTagsContainer?.style.display == "none") {
          getElements<TagElement>(this.nestedTagsContainer?.querySelectorAll(".item") || []).forEach(e => e.update());
          return;
        }
      }
      this.plainTags = plainTags;
      getElements(this.container.children).forEach(e => e.style.display = "none");
      this.nestedTags = this.getNestedTags();
      if (!this.active) {
        return;
      }
      this.refresh();
    }
    clearSelect() {
      Object.keys(this.state).forEach(key => this.state[key].select = false);
    }
    async getPlainTags() {
      let func;
      if (this.searchText && this.searchText.trim().length) {
        let regex;
        const res = this.searchText.match(/\/(.+)\/(\w*)/);
        if (res) {
          regex = new RegExp(res[1], res[2]);
          func = s => regex.test(s);
        } else {
          func = s => s.match(new RegExp(this.searchText, "i"));
        }
      }
      let plainTags = [];
      const collectionID = getFirstSelectedCollectionID();
      const displayAllTags = Zotero.Prefs.get("tagSelector.displayAllTags");
      const libraryID = getFirstSelectedLibraryID() ?? Zotero.Libraries.userLibraryID;
      let allItems = await Zotero.Items.getAll(libraryID);
      if (collectionID && !displayAllTags) {
        allItems = allItems.filter(i => i.topLevelItem.inCollection(collectionID));
      }
      allItems.forEach(item => {
        item.getTags().map(i => plainTags.push(i.tag));
      });
      plainTags = plainTags.filter(tag => {
        return _Tags.getTagMatch(tag);
      });
      if (func) {
        plainTags = plainTags.filter(tag => {
          return tag.split(this.linkSymbol).find(s => func(s));
        });
      }
      return plainTags;
    }
    key2tag(key) {
      const [plainTag, index] = JSON.parse(key);
      return plainTag.split(this.linkSymbol).slice(0, index + 1).join(this.linkSymbol);
    }
    getNestedTags() {
      const cacheKey = this.plainTags.join("\0");
      if (this._nestedTagsCache && this._nestedTagsCache.key === cacheKey) {
        return this._nestedTagsCache.result;
      }
      const nestedTags = {};
      for (let i = 0; i < this.plainTags.length; i++) {
        const plainTag = this.plainTags[i];
        const splitTags = plainTag.replace(/^#\s*/, "").split(this.linkSymbol);
        let _nestedTags = nestedTags;
        for (let j = 0; j < splitTags.length; j++) {
          const temp = _nestedTags[splitTags[j]] ??= {
            number: 0,
            children: {},
            // 用于区分当前分级标签，也用于和filter通信
            id: JSON.stringify([plainTag, j])
          };
          temp.number += 1;
          _nestedTags = temp.children;
        }
      }
      this._nestedTagsCache = {
        key: cacheKey,
        result: nestedTags
      };
      return nestedTags;
    }
    /**
     * 用于#标签获取映射后的标签名，也用于嵌套标签视图的标签验证
     * @param tag 要匹配的标签名称
     * @returns 如果和正则匹配，返回括号里的内容，不匹配则返回空
     */
    static getTagMatch(tag) {
      try {
        const rawString = getPref(`textTagsColumn.match`);
        const res = rawString.match(/\/(.+)\/(\w*)/);
        let regex;
        if (res) {
          regex = new RegExp(res[1], res[2]);
        } else if (rawString.startsWith("~~")) {
          regex = new RegExp(`^([^${rawString.slice(2)}].+)`);
        } else {
          regex = new RegExp(`^${rawString}(.+)`);
        }
        const arr = tag.match(regex);
        return arr && (arr.slice(1).join("") || arr[0]) || "";
      } catch {
        return tag;
      }
    }
    updateTagsIn(sortedItems?) {
      if (!this.collectionItems) {
        return;
      }
      if (!sortedItems) {
        const sortedIDs2 = /* @__PURE__ */new Set();
        for (const item of ZoteroPane.getSortedItems()) {
          sortedIDs2.add(item.id);
        }
        sortedItems = this.collectionItems.filter(item => sortedIDs2.has(item.id) || sortedIDs2.has(item.parentID));
      }
      const ids = (items: Zotero.Item[]) => items.map(item => item.id).sort((a, b) => a - b);
      const cacheKey = JSON.stringify([ids(this.collectionItems), ids(sortedItems)]);
      const cached = this.tagsIns.get(cacheKey);
      if (cached) {
        this.tagsIn = cached;
        return;
      }
      this.tagsIn = {
        items: [],
        collection: []
      };
      const sortedIDs = new Set(sortedItems.map(item => item.id));
      const collectedTags = { collection: new Set<string>(), items: new Set<string>() };
      this.collectionItems.reduce((tagsIn, item) => {
        let tagIn = "collection";
        if (sortedIDs.has(item.id)) {
          tagIn = "items";
        }
        item.getTags().forEach(tag => tagsIn[tagIn].add(tag.tag));
        if (item.isPDFAttachment()) {
          item.getAnnotations().forEach(annoItem => {
            annoItem.getTags().forEach(tag => tagsIn[tagIn].add(tag.tag));
          });
        }
        return tagsIn;
      }, collectedTags);
      this.tagsIn = {
        collection: Array.from(collectedTags.collection).sort(),
        items: Array.from(collectedTags.items).sort() || []
      };
      if (this.tagsIns.size >= 50) this.tagsIns.delete(this.tagsIns.keys().next().value);
      this.tagsIns.set(cacheKey, this.tagsIn);
      getElements<TagElement>(this.nestedTagsContainer?.querySelectorAll(".item") || []).forEach(e => e.update());
    }
    /**
     * 刷新
     */
    refresh() {
      if (!this.active) {
        return;
      }
      this.clearRenderTimers();
      const schedule = this.schedule.bind(this);
      const cancelTimer = this.cancelTimer.bind(this);
      this.container.querySelector("#nested-tags-container")?.remove();
      this.container.querySelector(".nested-tags")?.remove();
      const nestedTagsContainer = this.nestedTagsContainer = ztoolkit.UI.appendElement({
        tag: "div",
        id: this.nestedTagsID,
        classList: ["nested-tags"],
        styles: {
          height: "100px",
          // overflowY: "hidden",
          flex: "1 1 auto",
          display: "flex",
          // width: `${ZoteroPane.tagSelector.getContainerDimensions().width}px`,
          width: `100%`,
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center"
        }
      }, this.container);
      const box = ztoolkit.UI.appendElement({
        tag: "div",
        classList: ["nested-tags-box"],
        styles: {
          width: "calc(100% - 10px)",
          padding: "5px",
          height: "100%",
          overflowX: "",
          overflowY: "auto"
        },
        listeners: [{
          type: "dblclick",
          listener: async () => {
            this.searchText = "";
            this.clearSelect();
            await requireItemsView().refreshAndMaintainSelection();
            this.updateTagsIn();
            await this.init(true);
          }
        }]
      }, this.nestedTagsContainer);
      let timer;
      const searchBox = ztoolkit.UI.appendElement({
        tag: "div",
        classList: ["tag-selector-filter-pane"],
        styles: {
          width: "95%"
        },
        children: [{
          tag: "div",
          classList: ["tag-selector-filter-container"],
          children: [{
            tag: "div",
            classList: ["search"],
            children: [{
              tag: "input",
              attributes: {
                type: "search",
                placeholder: getString("filter-nested-tags")
              },
              listeners: [{
                type: "input",
                listener: async () => {
                  const inputNode = searchBox.querySelector("input");
                  const clearNode = searchBox.querySelector(".clear");
                  const searchText = inputNode.value;
                  if (searchText.length) {
                    clearNode.style.display = "";
                  } else {
                    clearNode.style.display = "none";
                  }
                  cancelTimer(timer);
                  timer = schedule(async () => {
                    this.searchText = searchText;
                    const generation = this.renderGeneration;
                    const plainTags = await this.getPlainTags();
                    if (!this.active || generation !== this.renderGeneration || inputNode.value !== searchText) return;
                    this.plainTags = plainTags;
                    this.nestedTags = this.getNestedTags();
                    box.replaceChildren();
                    this.render(box, this.nestedTags, 0);
                  }, 500);
                }
              }]
            }, {
              tag: "div",
              classList: ["search-cancel-button", "clear"],
              styles: {
                display: "none"
              },
              listeners: [{
                type: "click",
                listener: async () => {
                  const inputNode = searchBox.querySelector("input");
                  const clearNode = searchBox.querySelector(".clear");
                  inputNode.value = "";
                  clearNode.style.display = "none";
                  cancelTimer(timer);
                  this.searchText = "";
                  const generation = this.renderGeneration;
                  const plainTags = await this.getPlainTags();
                  if (!this.active || generation !== this.renderGeneration || inputNode.value !== "") return;
                  this.plainTags = plainTags;
                  this.nestedTags = this.getNestedTags();
                  box.replaceChildren();
                  this.render(box, this.nestedTags, 0);
                }
              }]
            }]
          }]
        }]
      }, this.nestedTagsContainer);
      const tagSelector = this.container.querySelector<HTMLElement>(".tag-selector");
      this.updateTagsIn();
      this._cachedSortMode = Number(getPref(`nestedTags.sorted`));
      this.render(box, this.nestedTags, 0);
      this._cachedSortMode = null;
      const icons2 = {
        sort: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-sort-asc"><path d="M11 11h4"></path><path d="M11 15h7"></path><path d="M11 19h10"></path><path d="M9 7 6 4 3 7"></path><path d="M6 6v14"></path></svg>`,
        nest: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-folder-tree"><path d="M13 10h7a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path><path d="M13 21h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.88a1 1 0 0 1-.9-.55l-.44-.9a1 1 0 0 0-.9-.55H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path><path d="M3 3v2c0 1.1.9 2 2 2h3"></path><path d="M3 3v13c0 1.1.9 2 2 2h3"></path></svg>`,
        collapse: {
          true: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevrons-up-down"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`,
          false: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevrons-down-up"><path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path></svg>`
        }
      };
      const containerID = this.containerID;
      const initializeTags = this.init.bind(this);
      const tagState = this.state;
      let isAllCollapse = true;
      const controlNode = ztoolkit.UI.insertElementBefore({
        tag: "div",
        classList: ["nested-tags"],
        styles: {
          margin: "5px auto",
          height: "30px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          width: "100px"
        },
        children: [{
          tag: "toolbarbutton",
          classList: ["nested-tags-control-icon"],
          properties: {
            innerHTML: icons2.sort
          },
          listeners: [{
            type: "click",
            listener: event => {
              const x = event.screenX;
              const y = event.screenY;
              const children = [];
              const selectedIndex = Number(getPref(`nestedTags.sorted`));
              for (let i = 0; i < this.props.sorted.length; i++) {
                children.push({
                  tag: "menuitem",
                  attributes: {
                    label: this.props.sorted[i],
                    type: "checkbox",
                    checked: getPref(`nestedTags.sorted`) == String(i)
                  },
                  listeners: [{
                    type: "command",
                    listener: async () => {
                      setPref(`nestedTags.sorted`, String(i));
                      await this.init(true);
                    }
                  }]
                });
                if (i == 1) {
                  children.push({
                    tag: "menuseparator"
                  });
                }
              }
              const menuPopup = buildMenuPopup({
                x,
                y
              }, children);
              menuPopup.querySelectorAll("menuitem").forEach((e, i) => {
                e.style.fontWeight = selectedIndex == i ? "bold" : "normal";
              });
            }
          }]
        }, {
          tag: "toolbarbutton",
          classList: ["nested-tags-control-icon"],
          properties: {
            innerHTML: icons2.nest
          },
          listeners: [{
            type: "click",
            listener: async function () {
              const node = this;
              if (nestedTagsContainer.style.display == "none") {
                nestedTagsContainer.style.display = "flex";
                schedule(() => {
                  if (containerID == "zotero-tag-selector") {
                    initializeTags(true);
                  }
                }, 230);
                tagSelector.style.display = "none";
                node.parentNode?.childNodes.forEach(e => {
                  if (e != node) {
                    if (e.timer) {
                      cancelTimer(e.timer);
                    }
                    e.style.display = "";
                    e.style.opacity = "0";
                    schedule(() => {
                      e.style.opacity = "0.85";
                    }, 1);
                  }
                });
                node.style.backgroundColor = "";
                node.style.opacity = "0.85";
                node.style.color = "#5a5a5a";
              } else {
                nestedTagsContainer.style.display = "none";
                tagSelector.style.display = "";
                node.parentNode?.childNodes.forEach(e => {
                  if (e != node) {
                    e.style.opacity = "0";
                    e.timer = schedule(() => {
                      e.style.display = "none";
                    }, 230);
                  }
                });
                node.style.display = "";
                node.style.backgroundColor = "hsla(201, 17%, 68%, 0.15)";
                node.style.color = "hsl(201, 17%, 68%)";
              }
            }
          }]
        }, {
          tag: "toolbarbutton",
          classList: ["nested-tags-control-icon"],
          properties: {
            innerHTML: icons2.collapse.true
          },
          listeners: [{
            type: "click",
            listener: function () {
              const _isAllCollapse = isAllCollapse;
              const toggle = async node => {
                let nodes = [...node.querySelectorAll(".item .collapse")];
                if (!_isAllCollapse) {
                  nodes = nodes.reverse();
                }
                for (let i = 0; i < nodes.length; i++) {
                  const e = nodes[i];
                  if ((tagState[e.key] ??= {}).collapse == _isAllCollapse) {
                    e.click();
                    if (_isAllCollapse) {
                      schedule(() => {
                        toggle(e.tree);
                      }, 10);
                    }
                  }
                }
              };
              toggle(box);
              isAllCollapse = !isAllCollapse;
              this.innerHTML = icons2.collapse[String(isAllCollapse)];
            }
          }]
        }]
      }, this.container.childNodes[0]);
    }
    /**
     * 从给定的items找出包含标签的
     */
    filterItemsByTagStart(items, tagStart) {
      const filterItems = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.getTags && item.getTags().find(tag => tag.tag.startsWith(tagStart))) {
          filterItems.push(item);
        }
        if (item.isPDFAttachment()) {
          let flag = false;
          item.getAnnotations().forEach(annoItem => {
            annoItem.getTags().forEach(tag => {
              if (tag.tag.startsWith(tagStart)) {
                flag = true;
              }
            });
          });
          if (flag) {
            filterItems.push(item);
          }
        }
      }
      return filterItems;
    }
    /**
     * 用于渲染一个父节点下的一个层级的标签
     * nestedTags本身可看作一个children
     * @param parent
     * @param children
     * @param margin
     */
    render(parent, children, margin = 0) {
      const sortedTags = this.getSortedTags(children);
      for (const tag of sortedTags) {
        const key = children[tag].id;
        (this.state[key] ??= {}).collapse ??= true;
        const itemNode = ztoolkit.UI.appendElement({
          tag: "div",
          classList: ["item", "not-in-collection"].concat(this.state[key].select ? ["selected"] : []),
          styles: {
            borderRadius: "3px",
            height: "1.8em",
            lineHeight: "1.8em",
            padding: `0 ${this.props.item.padding}px`
          },
          children: [{
            tag: "div",
            styles: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between"
            },
            children: [{
              tag: "div",
              styles: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                width: "80%"
              },
              children: [{
                tag: "div",
                id: "tag",
                styles: {
                  width: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                },
                properties: {
                  innerText: tag,
                  textContent: tag
                },
                listeners: [{
                  type: "click",
                  listener: async event => {
                    const ctrlKey = Zotero.isMac ? event.metaKey : event.ctrlKey;
                    this.searchJoinMode = ctrlKey ? "any" : "all";
                    if (itemNode.classList.contains("selected")) {
                      itemNode.classList.remove("selected");
                    } else {
                      itemNode.classList.add("selected");
                    }
                    if (this.onSelect) {
                      const [plainTag, index] = JSON.parse(children[tag].id);
                      const textTag = plainTag[0] + plainTag.slice(1).split("/").slice(0, index + 1).join("/");
                      this.onSelect(textTag);
                    } else {
                      if (itemNode.classList.contains("not-in-collection")) {
                        return;
                      }
                      if (itemNode.classList.contains("not-in-items") && !ctrlKey) {
                        this.clearSelect();
                      }
                      if (this.state[key].select) {
                        this.state[key].select = false;
                      } else {
                        this.state[key].select = true;
                      }
                      await requireItemsView().refreshAndMaintainSelection();
                    }
                  }
                }, {
                  type: "mouseup",
                  listener: async event => {
                    if (event.button == 2) {
                      const menuItems = [];
                      const selectedIndex = Number(getPref(`nestedTags.sorted`));
                      for (let i = 0; i < this.props.sorted.length; i++) {
                        const menuItem = {
                          styles: {
                            marginLeft: "", borderLeft: ""
                          },
                          listeners: [],
                          properties: { innerText: "" }
                        };
                        menuItem.styles.borderLeft = `3px solid ${selectedIndex == i ? "#16a085" : "transparent"}`;
                        menuItem.properties.innerText = this.props.sorted[i];
                        menuItem.listeners.push({
                          type: "mousedown",
                          listener: async () => {
                            setPref(`nestedTags.sorted`, String(i));
                            await this.init(true);
                          }
                        });
                        menuItems.push(menuItem);
                      }
                      const x = event.screenX;
                      const y = event.screenY;
                      const [plainTag, index] = JSON.parse(children[tag].id);
                      const orignalTagName = plainTag[0] + plainTag.slice(1).split("/").slice(0, index + 1).join("/");
                      const orignalEndTagName = orignalTagName.split("/").slice(-1)[0];
                      const libraryID = getFirstSelectedLibraryID() ?? Zotero.Libraries.userLibraryID;
                      const matchedTags = (await Zotero.Tags.getAll(libraryID)).map(tag2 => tag2.tag).filter(tag2 => spTagWithin(tag2, orignalTagName, this.linkSymbol));
                      buildMenuPopup({
                        x,
                        y
                      }, [{
                        tag: "menuitem",
                        attributes: {
                          label: getString("ui-rename")
                        },
                        listeners: [{
                          type: "command",
                          listener: async () => {
                            const io: { tagName: any; } & { _lastButtonId?: string; unloadLock?: { promise: Promise<void> } } = {
                              tagName: orignalTagName
                            };
                            const win = new ztoolkit.Dialog(2, 1).addCell(0, 0, {
                              tag: "input",
                              namespace: "html",
                              id: "tag-name",
                              attributes: {
                                "data-prop": "value",
                                "data-bind": "tagName",
                                type: "text"
                              },
                              styles: {
                                height: "20px"
                              }
                            }).addButton(getString("ui-rename"), "tag-rename").addButton(getString("ui-cancel"), "tag-cancel").setDialogData(io).open(getString("ui-tag"));
                            await io.unloadLock.promise;
                            const newTagName = io.tagName;
                            if (io._lastButtonId === "tag-rename" && orignalTagName !== newTagName) {
                              try {
                                await spRenameTags(Zotero, libraryID, orignalTagName, newTagName, this.linkSymbol);
                                await this.init(true);
                              } catch (error) { window.alert(getErrorMessage(error)); }
                            }
                          }
                        }]
                      }, {
                        tag: "menuitem",
                        attributes: {
                          label: getString("ui-tag-color")
                        },
                        listeners: [{
                          type: "command",
                          listener: async () => {
                            const oldColor = addon.api.storage?.get({
                              key: "Coloring"
                            }, orignalTagName)?.color;
                            const newColor = window.prompt(getString("ui-enter-tag-color"), oldColor || "");
                            if (newColor) {
                              await addon.api.storage?.set({
                                key: "Coloring"
                              }, orignalTagName, {
                                color: newColor
                              });
                            }
                            await requireItemsView().refreshAndMaintainSelection();
                          }
                        }]
                      }, {
                        tag: "menuseparator"
                      }, {
                        tag: "menuitem",
                        attributes: {
                          label: getString("ui-copy-tag")
                        },
                        listeners: [{
                          type: "command",
                          listener: () => {
                            new ztoolkit.Clipboard().addText(orignalEndTagName, "text/unicode").copy();
                          }
                        }]
                      }, {
                        tag: "menuitem",
                        attributes: {
                          label: getString("ui-copy-full-tag")
                        },
                        listeners: [{
                          type: "command",
                          listener: () => {
                            new ztoolkit.Clipboard().addText(orignalTagName, "text/unicode").copy();
                          }
                        }]
                      }, {
                        tag: "menuseparator"
                      }, {
                        tag: "menuitem",
                        attributes: {
                          label: getString("ui-remove")
                        },
                        listeners: [{
                          type: "command",
                          listener: async () => {
                            if (window.confirm(getString(matchedTags.length > 1 ? "ui-remove-tags-confirm" : "ui-remove-tag-confirm", { args: { tag: orignalTagName, count: matchedTags.length } }))) {
                              try {
                                await spRemoveTags(Zotero, libraryID, orignalTagName, this.linkSymbol);
                                await this.init(true);
                              } catch (error) { window.alert(getErrorMessage(error)); }
                            }
                          }
                        }]
                      }, {
                        tag: "menuseparator"
                      }, {
                        tag: "menuitem",
                        attributes: {
                          label: getString("ui-clear-filter")
                        },
                        listeners: [{
                          type: "command",
                          listener: async () => {
                            this.clearSelect();
                            await this.init(true);
                            await requireItemsView().refreshAndMaintainSelection();
                          }
                        }]
                      }]);
                    }
                  }
                }]
              }]
            }, {
              tag: "span",
              id: "number",
              styles: {
                borderRadius: "3px"
              },
              properties: {
                innerText: children[tag].number,
                textConetnt: children[tag].number
              }
            }]
          }]
        }, parent);
        itemNode.update = () => {
          if (this.containerID != "zotero-tag-selector") {
            ["not-in-items", "not-in-collection"].forEach(className => {
              itemNode.classList.remove(className);
            });
            return;
          } else {
            const tagStart = this.key2tag(key);
            if (!this.tagsIn.items.find(tag2 => tag2.startsWith(tagStart))) {
              this.state[key].select = false;
              itemNode.classList.remove("selected");
              if (!this.tagsIn.collection.find(tag2 => tag2.startsWith(tagStart))) {
                itemNode.classList.remove("not-in-items");
                itemNode.classList.add("not-in-collection");
              } else {
                itemNode.classList.remove("not-in-collection");
                itemNode.classList.add("not-in-items");
              }
            } else {
              ["not-in-items", "not-in-collection"].forEach(className => {
                itemNode.classList.remove(className);
              });
            }
          }
        };
        itemNode.update();
        const displayAllTags = Zotero.Prefs.get("tagSelector.displayAllTags");
        const subTags = Object.keys(children[tag].children);
        if (displayAllTags && subTags.length ||
        // AddTags
        this.onSelect && subTags.length ||
        // Not in Items
        !displayAllTags && subTags.length && subTags.some(tag1 => this.tagsIn.items.find(tag2 => tag2.startsWith(this.key2tag(children[tag].children[tag1].id))))) {
          const tree = ztoolkit.UI.appendElement({
            tag: "div",
            classList: ["tree"],
            styles: {
              borderLeft: `${this.props.tree.size}px solid var(--fill-quarternary)`,
              marginLeft: `${this.props.item.padding + this.props.icon.size / 2 - this.props.tree.size / 2}px`,
              paddingLeft: `${this.props.icon.size / 2 + this.props.icon.right}px`
            }
          }, parent);
          const collapseNode = ztoolkit.UI.insertElementBefore({
            tag: "div",
            classList: ["collapse"],
            styles: {
              marginRight: `${this.props.icon.right}px`,
              transform: this.state[key].collapse ? "rotate(-90deg)" : "",
              transition: "transform 100ms ease-in-out"
            },
            properties: {
              innerHTML: this.props.icon.svg,
              key,
              tree
            },
            listeners: [{
              type: "click",
              listener: async () => {
                const duration = 150;
                const transition = `max-height ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out`;
                this.state[key].collapse = !this.state[key].collapse;
                collapseNode.style.transform = this.state[key].collapse ? "rotate(-90deg)" : "";
                tree.style.overflow = "hidden";
                tree.style.transition = "none";
                const treeEl = tree;
                (treeEl._collapseTimers || []).forEach(id => this.cancelTimer(id));
                treeEl._collapseTimers = [];
                const track = id => {
                  treeEl._collapseTimers.push(id);
                };
                if (this.state[key].collapse) {
                  tree.style.maxHeight = window.getComputedStyle(tree).height;
                  tree.style.transition = transition;
                  track(this.schedule(() => {
                    tree.style.maxHeight = "0px";
                  }, 0));
                  track(this.schedule(() => {
                    tree.replaceChildren();
                  }, duration));
                } else {
                  tree.style.maxHeight = "";
                  this.render(...args);
                  track(this.schedule(() => {
                    const height = window.getComputedStyle(tree).height;
                    tree.style.transition = transition;
                    tree.style.maxHeight = "0px";
                    this.schedule(() => {
                      tree.style.maxHeight = height;
                    }, 0);
                  }, 0));
                }
                track(this.schedule(() => {
                  tree.style.maxHeight = "";
                  tree.style.transition = "";
                }, duration));
              }
            }]
          }, itemNode.querySelector("#tag"));
          const args: Parameters<InstanceType<typeof Tags>["render"]> = [tree, children[tag].children, margin + this.props.item.padding + this.props.icon.size + this.props.icon.right];
          if (!this.state[key].collapse) {
            this.render(...args);
          }
        }
      }
    }
    getSortedTags(children) {
      let sortedTags;
      const getString3 = s => s;
      switch (this._cachedSortMode ?? Number(getPref(`nestedTags.sorted`))) {
        case 0:
          sortedTags = Object.keys(children).sort((a, b) => getString3(a) > getString3(b) ? 1 : -1);
          break;
        case 1:
          sortedTags = Object.keys(children).sort((a, b) => getString3(a) > getString3(b) ? 1 : -1).reverse();
          break;
        case 2:
          sortedTags = Object.keys(children).sort((tag1, tag2) => children[tag1].number - children[tag2].number);
          break;
        case 3:
          sortedTags = Object.keys(children).sort((tag1, tag2) => children[tag2].number - children[tag1].number);
          break;
        default:
          sortedTags = Object.keys(children);
      }
      return sortedTags;
    }
  };
  export async function initTags(shutdownSignal) {
    await Zotero.Promise.delay(1000);
    if (shutdownSignal?.aborted || !addon.data.alive) {
      return;
    }
    while (!shutdownSignal?.aborted && addon.data.alive && !ZoteroPane.tagSelector) {
      ZoteroPane.toggleTagSelector();
      await Zotero.Promise.delay(1000);
    }
    if (shutdownSignal?.aborted || !addon.data.alive || !ZoteroPane.tagSelector) {
      return;
    }
    const tagsUI = new Tags();
    addon.api.tagsUI = tagsUI;
    let active = true;
    const timers = new Set<number>();
    const schedule = (callback, delay) => {
      if (!active) {
        return;
      }
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!active) {
          return;
        }
        Promise.resolve().then(() => { if (active) return callback(); }).catch(error => {
          ztoolkit.log("Failed to update nested tags", error);
        });
      }, delay);
      timers.add(timer);
      return timer;
    };
    schedule(async () => {
      await tagsUI.init();
    }, 1000);
    let updateTimer: number | undefined;
    let pendingItems: Zotero.Item[] = [];
    const updateTags = (items: Zotero.Item[]) => {
      if (!active) return items;
      pendingItems = items;
      if (updateTimer !== undefined) return items;
      updateTimer = schedule(() => {
        updateTimer = undefined;
        const latest = pendingItems;
        pendingItems = [];
        if (tagsUI.nestedTagsContainer?.style.display != "none") {
          tagsUI.updateTagsIn(latest);
          getElements<TagElement>(tagsUI.nestedTagsContainer?.querySelectorAll(".item") || []).forEach(e => e.update());
        }
      }, 0);
      return items;
    };
    const removeUpdateTags = appendOwnedEntry(addon.data.patch.getItems.data, updateTags);
    return () => {
      active = false;
      pendingItems = [];
      removeUpdateTags();
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      timers.clear();
      tagsUI.destroy();
    };
  }
  export class AddTags {
    declare active: boolean;
    declare popupGeneration: number;
    declare unregisterShortcut: () => void;
    declare popupTagSelector: any;
    declare popupTagsUI: InstanceType<typeof Tags>;

    constructor() {
      this.active = true;
      this.popupGeneration = 0;
      addon.api.addTagsUI = this;
      this.unregisterShortcut = registerShortcut("addTags.shortcut", () => {
        this.show();
      });
    }
    destroy() {
      if (!this.active) {
        return;
      }
      this.active = false;
      this.popupGeneration += 1;
      this.unregisterShortcut();
      this.closePopup();
      if (addon.api.addTagsUI === this) {
        delete addon.api.addTagsUI;
      }
    }
    async show() {
      if (!this.active) {
        return;
      }
      const generation = ++this.popupGeneration;
      const id = "AddTags-zotero-tag-selector-container";
      this.closePopup();
      const tagsContainer = ztoolkit.UI.appendElement({
        tag: "div",
        namespace: "html",
        id,
        styles: {
          display: "flex",
          left: `${document.documentElement.scrollWidth / 2 - 200}px`,
          top: `${document.documentElement.scrollHeight / 2 - 200}px`,
          width: "400px",
          height: "400px",
          flexDirection: "column",
          justifyContent: "center",
          position: "fixed",
          // zIndex: "999",
          padding: "10px",
          // paddingBottom: ".5em",
          backgroundColor: "var(--material-background)",
          transition: `opacity .23s linear`,
          "-moz-user-select": "text",
          boxShadow: "0 4px 24px rgb(0 0 0 / 20%)",
          borderRadius: "8px",
          // maxHeight: "300px",
          userSelect: "text"
        },
        listeners: [],
        children: [{
          tag: "div",
          namespace: "html",
          styles: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column"
          },
          id: "AddTags-zotero-tag-selector"
        }, {
          tag: "div",
          classList: ["search"],
          styles: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: [{
            tag: "input",
            id: "selected-tags",
            styles: {
              margin: "0 2.5%"
            },
            attributes: {
              type: "text",
              placeholder: getString("tags-selected-placeholder")
            },
            listeners: [{
              type: "input",
              listener: function (event) {
                ztoolkit.log(tagSelector);
                const input = event.currentTarget;
                tagSelector.selectedTags = new Set(input.value.split("; ").filter(Boolean));
                ztoolkit.log(tagSelector.selectedTags);
              }
            }]
          }]
        }, {
          tag: "div",
          classList: ["mid-buttons"],
          styles: {
            margin: "5px 0",
            height: "30px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          },
          children: [{
            tag: "radiogroup",
            id: "add-to",
            namespace: "xul",
            children: [{
              tag: "hbox",
              children: [{
                tag: "radio",
                id: "add-to-item",
                attributes: {
                  value: "Item",
                  label: getString("ui-item"),
                  disabled: "true"
                }
              }, {
                tag: "radio",
                id: "add-to-annotation",
                attributes: {
                  value: "Annotation",
                  label: getString("ui-annotation"),
                  disabled: "true"
                }
              }, {
                tag: "radio",
                id: "add-to-note",
                attributes: {
                  value: "Note",
                  label: getString("ui-note"),
                  disabled: "true"
                }
              }, {
                tag: "radio",
                id: "add-to-attachment",
                attributes: {
                  value: "Attachment",
                  label: getString("ui-attachment"),
                  disabled: "true"
                }
              }]
            }]
          }]
        }, {
          tag: "div",
          classList: ["end-buttons"],
          styles: {
            display: "flex",
            justifyContent: "end"
          },
          children: [{
            tag: "div",
            classList: ["info"],
            styles: {
              flexGrow: "1",
              textAlign: "left",
              display: "flex",
              flexDirection: "row",
              justifyContent: "start",
              alignItems: "center",
              paddingLeft: ".5em",
              opacity: ".7"
            },
            children: [{
              tag: "toolbarbutton",
              namespace: "xul",
              classList: ["refresh"],
              styles: {
                width: "28px",
                height: "28px",
                "list-style-image": `url("chrome://zotero/skin/20/universal/sync.svg")`,
                fill: "currentColor",
                cursor: "pointer"
              },
              listeners: [{
                type: "command",
                listener: async event => {
                  tagSelector.collectionTreeRows = [requireCollectionsView().getRow(0)];
                  tagSelector.setState({
                    showAutomatic: Zotero.Prefs.get("tagSelector.showAutomatic")
                  });
                  tagSelector.selectedTags.clear();
                  await onSelect();
                  tagSelector.searchBoxRef.current.handleClear();
                  const tagSelectorList = tagsContainer.querySelector(".tag-selector-list");
                  if (tagSelectorList) {
                    tagSelectorList.style.height = "";
                  }
                  tagsContainer.querySelectorAll(".nested-tags-box .selected").forEach(e => e.classList.remove("selected"));
                }
              }]
            }, {
              tag: "span",
              classList: ["tags-num"],
              properties: {
                innerText: getString("ui-select-tags")
              }
            }]
          }, {
            namespace: "xul",
            tag: "button",
            id: "add",
            attributes: {
              label: getString("ui-add"),
              default: "true"
            },
            styles: {
              marginRight: "1em"
            },
            listeners: [{
              type: "click",
              // 添加标签
              listener: async () => {
                let selecedTags = tagSelector.selectedTags;
                ztoolkit.log(tagSelector.selectedTags);
                if (selecedTags.size == 0) {
                  const inputNodes2 = [...tagsContainer.querySelectorAll(".tag-selector-filter-container input")];
                  const inputTag = inputNodes2.map(i => i.value).filter(Boolean)[0];
                  if (!inputTag) {
                    window.alert(getString("ui-select-or-enter-tag"));
                    return;
                  } else if (window.confirm(getString("ui-add-tag-confirm", { args: { tag: inputTag } }))) {
                    selecedTags = new Set([inputTag]);
                  } else {
                    return;
                  }
                }
                for (const targetItem of targetItems) {
                  for (const tag of selecedTags) {
                    targetItem.addTag(tag);
                  }
                  await targetItem.saveTx();
                }
                this.closePopup(tagsContainer);
              }
            }]
          }, {
            namespace: "xul",
            tag: "button",
            id: "cancel",
            attributes: {
              label: getString("ui-cancel")
            },
            listeners: [{
              type: "click",
              listener: () => {
                this.closePopup(tagsContainer);
              }
            }]
          }]
        }]
      }, document.documentElement);
      tagsContainer.addEventListener("mousedown", () => {
        ZoteroPane.tagSelector.contextTag = tagSelector.contextTag;
      });
      let addTo = "Item";
      let targetItems = [];
      if (Zotero_Tabs.selectedID == "zotero-pane") {
        const selectedItems = ZoteroPane.getSelectedItems();
        if (selectedItems?.length > 0) {
          addTo = "Item";
          for (const item of selectedItems) {
            targetItems.push(item);
          }
        }
      } else {
        const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
        const src = (document.activeElement as HTMLIFrameElement)?.src || "";
        if (src.includes("reader")) {
          const annoArr = await getSelectedReaderAnnotations(reader._internalReader._primaryView);
          if (annoArr.length > 0) {
            addTo = "Annotation";
            for (const anno of annoArr) {
              ztoolkit.log(anno);
              targetItems.push(Zotero.Items.getByLibraryAndKey(anno.libraryID || 1, anno.id));
            }
          } else {
            addTo = "Attachment";
            targetItems = [reader._item];
          }
        } else if (src.includes("editor")) {
          const noteWin = (document.activeElement as HTMLIFrameElement)?.contentWindow;
          const editor = Zotero.Notes._editorInstances.find(editor2 => {
            return editor2._iframeWindow == noteWin;
          });
          if (editor) {
            addTo = "Note";
            targetItems = [editor._item];
          } else {
            addTo = "Attachment";
            targetItems = [reader._item];
          }
        } else {
          addTo = "Item";
          targetItems = [reader._item.parentItem];
        }
      }
      if (!this.active || generation !== this.popupGeneration) {
        tagsContainer.remove();
        return;
      }
      tagsContainer.querySelector("#add-to").value = addTo;
      tagsContainer.querySelector(`#add-to radio[value=${addTo}]`)?.removeAttribute("disabled");
      this.addDragEvent(tagsContainer);
      const onSelect = async () => {
        const state = await tagSelector.getTagsAndScope();
        state.tags = state.tags.filter(i => !i.tag.startsWith("#"));
        tagSelector.setState(state);
        const tagsNumNode = tagsContainer.querySelector(".info .tags-num");
        const selectedTagsNode = tagsContainer.querySelector("#selected-tags");
        if (tagSelector.selectedTags.size > 0) {
          tagsNumNode.innerText = getString("ui-selected-tag-count", { args: { count: tagSelector.selectedTags.size } });
          selectedTagsNode.value = [...tagSelector.selectedTags].join("; ");
        } else {
          tagsNumNode.innerText = getString("ui-select-tags");
          selectedTagsNode.value = "";
        }
      };
      const tagSelector = await Zotero.TagSelector.init(tagsContainer.querySelector("#AddTags-zotero-tag-selector"), {
        container: id,
        onSelection: async data => {
          await onSelect();
        }
      });
      if (!this.active || generation !== this.popupGeneration) {
        tagSelector.destroy?.();
        tagsContainer.remove();
        return;
      }
      this.popupTagSelector = tagSelector;
      window.tagSelector = tagSelector;
      tagSelector.onItemViewChanged({
        libraryID: 1,
        collectionTreeRows: [requireCollectionsView().getRow(0)]
      });
      onSelect();
      if (isEnabel("tags")) {
        const tagsUI = new Tags("AddTags-zotero-tag-selector", textTag => {
          if (tagSelector.selectedTags.has(textTag)) {
            tagSelector.selectedTags.delete(textTag);
          } else {
            tagSelector.selectedTags.add(textTag);
          }
          onSelect();
        });
        this.popupTagsUI = tagsUI;
        await tagsUI.init();
        if (!this.active || generation !== this.popupGeneration) {
          tagsUI.destroy();
          tagsContainer.remove();
          return;
        }
      }
      tagsContainer.querySelector(".tag-selector").style["border-top"] = "none";
      tagsContainer.querySelector(".tag-selector-actions")?.remove();
      tagsContainer.focus();
      const inputNodes = [...tagsContainer.querySelectorAll(".tag-selector-filter-container input")];
      inputNodes.forEach(inputNode => {
        inputNode.addEventListener("keypress", e => {
          if (e.key == "Escape") {
            tagsContainer.querySelector("#cancel").click();
          } else if (e.key == "Enter") {
            tagsContainer.querySelector("#add").click();
          }
        });
      });
      inputNodes[1].focus();
      return tagSelector;
    }
    closePopup(container?) {
      this.popupTagsUI?.destroy();
      this.popupTagsUI = undefined;
      this.popupTagSelector?.destroy?.();
      if (window.tagSelector === this.popupTagSelector) {
        delete window.tagSelector;
      }
      this.popupTagSelector = undefined;
      (container ?? document.querySelector("#AddTags-zotero-tag-selector-container"))?.remove();
    }
    /**
     * Ctrl + 拖拽
     * @param node
     */
    addDragEvent(node) {
      let posX;
      let posY;
      let currentX;
      let currentY;
      let isDragging = false;
      function handleMouseDown(event) {
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }
        if (event.target instanceof window.HTMLInputElement || event.target instanceof window.HTMLTextAreaElement || event.target.classList.contains("tag")) {
          return;
        }
        posX = node.offsetLeft - event.clientX;
        posY = node.offsetTop - event.clientY;
        isDragging = true;
      }
      function handleMouseUp(event) {
        isDragging = false;
      }
      function handleMouseMove(event) {
        if (isDragging) {
          currentX = event.clientX + posX;
          currentY = event.clientY + posY;
          node.style.left = currentX + "px";
          node.style.top = currentY + "px";
        }
      }
      node.addEventListener("mousedown", handleMouseDown);
      node.addEventListener("mouseup", handleMouseUp);
      node.addEventListener("mousemove", handleMouseMove);
    }
  };

