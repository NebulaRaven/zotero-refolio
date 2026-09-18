import { requireItemsView } from "../../utils/zoteroPane.ts";
import { getPref } from "../../utils/prefs.ts";
import { config } from "../../config.ts";
import { replaceOwnedProperty } from "../../utils/ownedResource.ts";
import { getColoredTags } from "../../utils/base.ts";
import { getString } from "../../utils/locale.ts";
import { drawOpacityProgress } from "../../utils/draw.ts";
import { editAnnotationColors } from "../../../app/annotationColors.ts";
  // src/features/workspace/prompt.ts
  export async function registerAllCommands() {
    let active = true;
    let searchGeneration = 0;
    const commandIDs = /* @__PURE__ */new Set([`${config.addonRef}-prompt-search`, `${config.addonRef}-prompt-read-progress`, `${config.addonRef}-prompt-migration`, `${config.addonRef}-prompt-tags`, `${config.addonRef}-prompt-annotations`, `${config.addonRef}-prompt-addon-item`, `${config.addonRef}-prompt-prefs-export`, `${config.addonRef}-prompt-annual-summary`]);
    const pendingTimeouts = new Set<number>();
    const pendingAnimationFrames = new Set<number>();
    const pendingTurnResolvers = new Set<() => void>();
    const waitForPromptTurn = () => new Promise<void>(resolve => {
      let timer = 0;
      const settle = () => {
        pendingTurnResolvers.delete(settle);
        pendingTimeouts.delete(timer);
        resolve();
      };
      pendingTurnResolvers.add(settle);
      timer = window.setTimeout(settle, 0);
      pendingTimeouts.add(timer);
    });
    const scheduleTimeout = (callback, delay) => {
      const timer = window.setTimeout(() => {
        pendingTimeouts.delete(timer);
        if (active) {
          callback();
        }
      }, delay);
      pendingTimeouts.add(timer);
      return timer;
    };
    const scheduleAnimationFrame = callback => {
      const frame = window.requestAnimationFrame(timestamp => {
        pendingAnimationFrames.delete(frame);
        if (active) {
          callback(timestamp);
        }
      });
      pendingAnimationFrames.add(frame);
      return frame;
    };
    let suppressedSearchText;
    let suppressionTimer;
    const clearSuppressedSearch = () => {
      suppressedSearchText = undefined;
      if (suppressionTimer !== undefined) {
        window.clearTimeout(suppressionTimer);
        pendingTimeouts.delete(suppressionTimer);
        suppressionTimer = undefined;
      }
    };
    const suppressSearch = text => {
      clearSuppressedSearch();
      suppressedSearchText = text;
      suppressionTimer = scheduleTimeout(() => {
        suppressionTimer = undefined;
        suppressedSearchText = undefined;
      }, 1000);
    };
    const promptInstance = ztoolkit.Prompt.prompt;
    const originalShowSuggestions = promptInstance?.showSuggestions;
    const restorePromptSuggestions = promptInstance && originalShowSuggestions ? replaceOwnedProperty(promptInstance, "showSuggestions", async function (inputText) {
      if (suppressedSearchText !== undefined) {
        const currentInputText = this.inputNode?.value;
        if (currentInputText !== inputText) {
          return true;
        }
        if (inputText === suppressedSearchText) {
          clearSuppressedSearch();
          return true;
        }
        clearSuppressedSearch();
      }
      return originalShowSuggestions.call(this, inputText);
    }) : () => {};
    ztoolkit.Prompt.register([{
      id: `${config.addonRef}-prompt-search`,
      when: () => {
        const inputNode = document.querySelector<HTMLInputElement>(".prompt-input");
        return Boolean(inputNode && !inputNode.value.startsWith("> "));
      },
      callback: async prompt2 => {
        if (!active) {
          return;
        }
        const generation = ++searchGeneration;
        const text = prompt2.inputNode.value;
        suppressSearch(text);
        const isCurrent = () => active && generation === searchGeneration && prompt2.promptNode.isConnected && prompt2.promptNode.style.display !== "none" && prompt2.inputNode.value === text;
        function getItemDescription(item) {
          const nodes = [];
          let str = "";
          let author;
          let authorDate = "";
          if (item.firstCreator) {
            author = authorDate = item.firstCreator;
          }
          let date = item.getField("date", true, true);
          if (date && (date = date.substr(0, 4)) !== "0000") {
            authorDate += " (" + parseInt(date) + ")";
          }
          authorDate = authorDate.trim();
          if (authorDate) {
            nodes.push(authorDate);
          }
          const publicationTitle = item.getField("publicationTitle", false, true);
          if (publicationTitle) {
            nodes.push(`<i>${publicationTitle}</i>`);
          }
          let volumeIssue = item.getField("volume");
          const issue = item.getField("issue");
          if (issue) {
            volumeIssue += "(" + issue + ")";
          }
          if (volumeIssue) {
            nodes.push(volumeIssue);
          }
          const publisherPlace = [];
          let field;
          if (field = item.getField("publisher")) {
            publisherPlace.push(field);
          }
          if (field = item.getField("place")) {
            publisherPlace.push(field);
          }
          if (publisherPlace.length) {
            nodes.push(publisherPlace.join(": "));
          }
          const pages = item.getField("pages");
          if (pages) {
            nodes.push(pages);
          }
          if (!nodes.length) {
            const url = item.getField("url");
            if (url) {
              nodes.push(url);
            }
          }
          for (let i = 0, n = nodes.length; i < n; i++) {
            const node = nodes[i];
            if (i != 0) {
              str += ", ";
            }
            if (typeof node === "object") {
              const label = document.createElement("label");
              label.setAttribute("value", str);
              label.setAttribute("crop", "end");
              str = "";
            } else {
              str += node;
            }
          }
          if (str.length) {
            str += ".";
          }
          return str;
        }
        async function filter(ids) {
          const valid = await Promise.all(ids.map(async id => {
            try {
              const item = await Zotero.Items.getAsync(id);
              return Boolean(item?.isRegularItem() && !item.isFeedItem);
            } catch {
              return false;
            }
          }));
          return ids.filter((_, index) => valid[index]);
        }
        try {
          prompt2.showTip(getString("ui-searching"));
          const s = new Zotero.Search();
          s.addCondition("quicksearch-titleCreatorYear", "contains", text);
          s.addCondition("itemType", "isNot", "attachment");
          let ids = await s.search();
          await waitForPromptTurn();
          if (!isCurrent()) {
            return;
          }
          ids = await filter(ids);
          if (!isCurrent()) {
            return;
          }
          ztoolkit.log(ids.length);
          if (ids.length == 0) {
            const s2 = new Zotero.Search();
            const operators = ["is", "isNot", "true", "false", "isInTheLast", "isBefore", "isAfter", "contains", "doesNotContain", "beginsWith"];
            let hasValidCondition = false;
            let joinMode: "all" | "any" = "all";
            if (/\s*\|\|\s*/.test(text)) {
              joinMode = "any";
            }
            text.split(/\s*(&&|\|\|)\s*/g).forEach(conditinString => {
              const conditions = conditinString.trim().match(/([^\s]+?)\s+([^\s]+?)\s+(.+)/);
              if (conditions && conditions.length == 4 && operators.indexOf(conditions[2]) != -1) {
                hasValidCondition = true;
                s2.addCondition("joinMode", joinMode);
                s2.addCondition(conditions[1], conditions[2] as _ZoteroTypes.Search.Operator, conditions[3]);
              }
            });
            if (hasValidCondition) {
              ids = await s2.search();
              await waitForPromptTurn();
              if (!isCurrent()) {
                return;
              }
            }
          }
          ids = await filter(ids);
          if (!isCurrent()) {
            return;
          }
          ztoolkit.log(ids.length);
          prompt2.exit();
          prompt2.promptNode.style.display = "flex";
          const container = prompt2.createCommandsContainer();
          container.classList.add("suggestions");
          if (ids.length > 0) {
            ids.forEach(id => {
              const item = Zotero.Items.get(id);
              const title = item.getField("title");
              const ele = ztoolkit.UI.createElement(document, "div", {
                namespace: "html",
                classList: ["command"],
                listeners: [{
                  type: "mousemove",
                  listener: function () {
                    prompt2.selectItem(this);
                  }
                }, {
                  type: "click",
                  listener: () => {
                    prompt2.promptNode.style.display = "none";
                    Zotero_Tabs.select("zotero-pane");
                    ZoteroPane.selectItem(item.id);
                  }
                }],
                styles: {
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "start"
                },
                children: [{
                  tag: "span",
                  styles: {
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  },
                  properties: {
                    innerText: title
                  }
                }, {
                  tag: "span",
                  styles: {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  },
                  properties: {
                    innerHTML: getItemDescription(item)
                  }
                }]
              });
              container.appendChild(ele);
            });
          } else {
            prompt2.exit();
            prompt2.promptNode.style.display = "flex";
            prompt2.showTip(getString("ui-not-found"));
          }
        } finally {}
      }
    }]);
    const getItem = () => {
      const id = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)?.itemID;
      const readingItem = id ? Zotero.Items.get(id).parentItem : undefined;
      const selectedItems = ZoteroPane.getSelectedItems();
      const item = readingItem || selectedItems?.[0];
      return item;
    };
    const getAllTags = item => {
      const coloredTags = getColoredTags(item);
      const tags = item.getTags().filter(tag => coloredTags.map(tag2 => tag2.tag).indexOf(tag.tag) == -1);
      return [...coloredTags, ...tags];
    };
    ztoolkit.Prompt.register([{
      id: `${config.addonRef}-prompt-read-progress`,
      name: getString("read-progress-bar"),
      label: "Refolio",
      when: () => {
        const item = getItem();
        if (!item) {
          return false;
        }
        const record = addon.api.storage.get(item, "readingTime");
        ztoolkit.log(record);
        return getPref(`function.titleColumn.enable`) && record?.data && Object.keys(record.data).length > 0;
      },
      /**
       * 进度条UI，重置
       */
      callback: prompt2 => {
        const container = prompt2.createCommandsContainer();
        const item = getItem();
        prompt2.inputNode.placeholder = item.getField("title");
        const record = addon.api.storage.get(item, "readingTime");
        if (!record || !record.data || Object.keys(record.data).length == 0) {
          prompt2.showTip(getString("prompt-empty"));
          return;
        }
        const box = ztoolkit.UI.createElement(document, "div", {
          styles: {
            display: "flex",
            alignContent: "baseline",
            justifyContent: "space-between",
            borderRadius: "5px",
            padding: "6px 12px",
            marginRight: "12px",
            marginTop: "2px",
            marginBottom: "2px",
            height: "2em"
          }
        });
        const values = [];
        for (let i = 0; i < record.page; i++) {
          values.push(parseFloat(record.data[i]) || 0);
        }
        const color = getPref(`titleColumn.color`);
        const opacity = getPref(`titleColumn.opacity`);
        const span = drawOpacityProgress(values, color, opacity);
        const openToPage = async page => {
          const pdfItem = await item.getBestAttachment();
          if (!pdfItem) {
            return;
          }
          await Zotero.OpenPDF.openToPage(pdfItem, page);
        };
        const progressSpans = [...span.querySelectorAll("span")];
        progressSpans.forEach((span2, index) => {
          span2.style.cursor = "pointer";
          const page = index + 1;
          span2.onclick = () => {
            openToPage(page);
          };
          span2.onmouseenter = () => {
            span2.style.border = "1.5px solid white";
          };
          span2.onmouseleave = () => {
            span2.style.border = "";
          };
          const sec = values[index];
          let t3;
          if (sec < 60) {
            t3 = `${sec} s`;
          } else if (sec / 60) {
            t3 = `${(sec / 60).toFixed(1)} m`;
          } else {
            t3 = `${(sec / 60 / 60).toFixed(1)} h`;
          }
          span2.setAttribute("title", getString("ui-reading-page", { args: { time: t3, page } }));
        });
        box.appendChild(span);
        container.appendChild(box);
      }
    }, {
      id: `${config.addonRef}-prompt-migration`,
      name: getString("migration-of-old-data"),
      label: "Refolio",
      when: () => {
        const items = ZoteroPane.getSelectedItems();
        return items.length == 1 && items[0].getField("title") == "StylePersonal";
      },
      callback: async prompt2 => {
        const tipNode = prompt2.showTip(getString("prompt-migration-in-progress"));
        tipNode.style.position = "relative";
        const progress = ztoolkit.UI.createElement(document, "span", {
          styles: {
            position: "absolute",
            height: "100%",
            left: "0",
            top: "0",
            backgroundColor: "#FF8E9E",
            zIndex: "-1",
            opacity: "0.5",
            transition: "width .1 linear"
          }
        });
        tipNode.appendChild(progress);
        progress.style.width = "0%";
        const ids = ZoteroPane.getSelectedItems()[0].getNotes();
        let totalTime = 0;
        for (let i = 0; i < ids.length; i++) {
          const noteItem = Zotero.Items.get(ids[i]);
          try {
            const data = JSON.parse(noteItem.note.replace(/<.+?>/g, "").replace(/[^\n{]+/, ""));
            if (!data.itemKey) {
              const s = new Zotero.Search();
              s.addCondition("title", "contains", data.title);
              data.itemKey = Zotero.Items.get((await s.search())[0]).key;
              ztoolkit.log(data.itemKey);
            }
            totalTime += Object.values(data.pageTime as Record<string, number>).reduce((a, b) => a + b, 0);
            const record = {
              page: data.pageNum,
              data: data.pageTime
            };
            if (data.itemKey) {
              addon.api.storage.set(Zotero.Items.getByLibraryAndKey(1, data.itemKey), "readingTime", record);
            }
          } catch {}
          progress.style.width = `${i / ids.length * 100}%`;
          prompt2.inputNode.value = getString("ui-migration-progress", { args: { current: i, total: ids.length } });
          await Zotero.Promise.delay(10);
        }
        prompt2.inputNode.value = "";
        prompt2.exit();
        prompt2.showTip(getString("prompt-migration-complete", {
          args: {
            count: ids.length,
            hours: (totalTime / 60 / 60).toFixed(2)
          }
        }));
      }
    }, {
      id: `${config.addonRef}-prompt-tags`,
      name: getString("tags"),
      label: "Refolio",
      when: () => {
        const item = getItem();
        if (item) {
          if (getAllTags(item).length > 0) {
            return true;
          }
        }
        return false;
      },
      callback: prompt2 => {
        const libraryID = 1;
        const container = prompt2.createCommandsContainer();
        container.style.fontSize = "1em";
        const tags = getAllTags(getItem());
        const inputStyles = {
          height: "1.5em",
          border: "1px solid #eee",
          borderRadius: ".1em",
          padding: "0 0.5em",
          width: "8em"
        };
        tags.forEach(tag => {
          const color = Zotero.Tags.getColor(libraryID, tag.tag);
          let position = color ? color.position : undefined;
          position = position == undefined ? undefined : position + 1;
          const set = line2 => {
            const name = line2.querySelector("#name").value;
            const color = line2.querySelector("#color").value;
            const position2 = line2.querySelector("#position").value;
            if (/^#(\w{3}|\w{6})$/i.test(color) && /^\d+$/.test(position2) && name.length) {
              Zotero.Tags.setColor(libraryID, name, color, position2);
            }
          };
          const line = ztoolkit.UI.createElement(document, "div", {
            classList: ["command"],
            styles: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              width: "100%"
            },
            children: [{
              tag: "span",
              id: "circle",
              styles: {
                display: "inline-block",
                height: ".7em",
                width: ".7em",
                borderRadius: tag.tag.startsWith("#") ? ".1em" : ".7em",
                backgroundColor: tag.color
              }
            }, {
              tag: "div",
              children: [{
                tag: "input",
                id: "name",
                styles: inputStyles,
                properties: {
                  value: tag.tag,
                  placeholder: getString("ui-name")
                },
                listeners: [{
                  type: "change",
                  listener: () => {
                    Zotero.Tags.rename(libraryID, tag.tag, line.querySelector("#name").value);
                  }
                }]
              }]
            }, {
              tag: "div",
              styles: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center"
              },
              children: [{
                tag: "input",
                id: "color",
                styles: inputStyles,
                properties: {
                  value: tag.color || "",
                  placeholder: getString("ui-color")
                },
                listeners: [{
                  type: "change",
                  listener: () => {
                    ztoolkit.log(line.querySelector("#circle").style.backgroundColor);
                    line.querySelector("#circle").style.backgroundColor = line.querySelector("#color").value;
                    ztoolkit.log(line.querySelector("#circle").style.backgroundColor);
                    if (!/^\d+$/.test(line.querySelector("#position").value)) {
                      line.querySelector("#position").value = "1";
                    }
                    set(line);
                  }
                }]
              }]
            }, {
              tag: "div",
              children: [{
                tag: "input",
                id: "position",
                styles: inputStyles,
                properties: {
                  value: position,
                  placeholder: getString("ui-position")
                },
                listeners: [{
                  type: "change",
                  listener: () => {
                    set(line);
                  }
                }]
              }]
            }]
          });
          container.appendChild(line);
        });
      }
    }, {
      /**
       * 实现标注颜色组，可以新创建新组，组内可以新建新的标注颜色
       */
      id: `${config.addonRef}-prompt-annotations`,
      name: getString("annotations"),
      label: "Refolio",
      when: () => {
        return getPref(`function.annotationColors.enable`);
      },
      callback: prompt2 => {
        prompt2.exit();
        editAnnotationColors();
      }
    }, {
      id: `${config.addonRef}-prompt-addon-item`,
      name: getString("set-as-addon-item"),
      when: () => {
        const item = getItem();
        return item && (item?.getField("title")).includes("Addon");
      },
      callback: prompt2 => {
        const item = getItem();
        Zotero.Prefs.set("Zotero.AddonItem.key", item.key);
        if ("item" in addon.api.storage) {
          addon.api.storage.item = item;
        }
        prompt2.showTip(getString("prompt-addon-item-set", {
          args: {
            count: item.getNotes().length
          }
        }));
      }
    }, {
      id: `${config.addonRef}-prompt-prefs-export`,
      name: getString("prefs-export"),
      label: "CSV",
      when: () => {
        return ZoteroPane.getSelectedItems().length >= 2;
      },
      callback: async prompt2 => {
        const excludeKeys = ["hasAttachment"];
        const columns = requireItemsView().tree._columns._columns.filter(i => i.hidden == false && excludeKeys.indexOf(i.dataKey) == -1);
        const getCustomKeyCellText = (item, dataKey) => {
          const cache = Zotero.ItemTreeManager._columnManager._optionsCache[dataKey];
          const data = cache.dataProvider(item, dataKey);
          if (cache.renderCell) {
            const span = cache.renderCell(-1, data, {
              className: ""
            });
            return [...span.childNodes].map(i => i.textContent).filter(Boolean).join("; ");
          } else {
            return data;
          }
        };
        const items = ZoteroPane.getSelectedItems();
        const fp = new window.FilePicker();
        fp.init(window, Zotero.getString("fileInterface.export"), fp.modeSave);
        fp.defaultString = getString("prompt-export-file-name");
        fp.appendFilters(fp.filterAll);
        const rv = await fp.show();
        if (rv == fp.returnOK || rv == fp.returnReplace) {
          const filepath = fp.file;
          let csvText = `\uFEFF"Key","${getString("prompt-item-type")}",${columns.map(i => {
            return JSON.stringify(document.querySelector(`.${i.className.split(" ")[1]}`)?.textContent?.trim());
          }).join(",")}
`;
          for (const item of items) {
            if (item.isAttachment() || item.isNote()) {
              continue;
            }
            let lineText = `${item.key},${item.itemType},`;
            for (const column of columns) {
              if (column.pluginID) {
                lineText += JSON.stringify(getCustomKeyCellText(item, column.dataKey));
              } else {
                lineText += JSON.stringify(item.getField(column.dataKey));
              }
              lineText += ",";
            }
            lineText = lineText.replace(/,$/, "");
            csvText += lineText + "\n";
          }
          ztoolkit.log(csvText);
          await Zotero.File.putContentsAsync(filepath, csvText, "utf-8");
          prompt2.exit();
        }
      }
    },
    // {
    //   name: "生成 AI 大纲",
    //   label: "Refolio",
    //   when: () => {
    //     let items = ZoteroPane.getSelectedItems()
    //     return items.length >= 1
    //   },
    //   callback: async (prompt) => {
    //     // @ts-ignore
    //     prompt.exit()
    //     let success = 0, fail = 0
    //     const items = ZoteroPane.getSelectedItems()
    //     for (let item of items) {
    //       if (!item.isTopLevelItem() || item.isPDFAttachment()) {
    //         continue
    //       }
    //       const pdfItem = await item.getBestAttachment() as Zotero.Item
    //       if (!pdfItem) { continue}
    //       async function lk(a: any) {
    //         a = await crypto.subtle.digest("SHA-256", a);
    //         a = new Uint8Array(a);
    //         const b = [];
    //         for (let c = 0; c < 16; ++c)
    //           b.push(a[c].toString(16).padStart(2, "0"));
    //         return b.join("")
    //       }
    //       const buf = await IOUtils.read(
    //         pdfItem.getFilePath() as string
    //       );
    //       const bytes = new window.Uint8Array(buf)
    //       const pi = await lk(bytes)
    //       const res = await Zotero.HTTP.request(
    //         "GET",
    //         `https://scholar.google.com/scholar_kp?kp_url=&pi=${pi}&hl=zh-CN`,
    //         {
    //           responseType: "json",
    //           headers: {
    //             "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    //           }
    //         }
    //       )
    //       ztoolkit.log(res)
    //       const md = res.response.kp
    //       if(md) {
    //         const noteItem = new Zotero.Item("note")
    //         noteItem.parentID = item.id
    //         await noteItem.saveTx()
    //         noteItem.setNote(await Zotero.BetterNotes.api.convert.md2html(
    //            md
    //         ))
    //         await noteItem.saveTx()
    //         success += 1
    //       } else {
    //         fail += 1
    //       }
    //     }
    //     new ztoolkit.ProgressWindow("生成结果")
    //       .createLine({ text: `共${items.length}：${success}成功，${fail}失败`, type: "default"})
    //     .show()
    //   }
    // },
    {
      id: `${config.addonRef}-prompt-annual-summary`,
      name: "🎉 2025 年度总结",
      when: () => {
        return false;
      },
      label: "Refolio",
      callback: async prompt2 => {
        try {
          const isPromptActive = () => active && prompt2.promptNode.isConnected && prompt2.promptNode.style.display !== "none";
          const sum = arr => {
            if (arr.length == 0) {
              return 0;
            } else {
              return arr.reduce((a, b) => a + b, 0);
            }
          };
          const s = new Zotero.Search();
          s.addCondition("dateAdded", "isAfter", "2024-12-31");
          s.addCondition("dateAdded", "isBefore", "2026-01-01");
          s.addCondition("itemType", "isNot", "attachment");
          const ids = await s.search();
          if (!isPromptActive()) {
            return;
          }
          const allItems = (await Promise.all(ids.map(id => Zotero.Items.getAsync(id)))).filter(item => item !== null);
          if (!isPromptActive()) {
            return;
          }
          const regularItems = allItems.filter(item => item.isRegularItem() && item.libraryID == 1);
          const noteItems = allItems.filter(item => item.isNote() && item.libraryID == 1);
          const getTopKeywords = (textArray, count = 4) => {
            const stopWords = /* @__PURE__ */new Set(["the", "and", "that", "are", "with", "from", "this", "which", "was", "were", "been", "have", "has", "had", "will", "would", "should", "their", "there", "they", "them", "some", "any", "not", "but", "also", "than", "into", "about", "such", "these", "those", "using", "through", "based", "study", "research", "analysis", "基于", "研究", "分析", "探讨", "一种", "关于", "可以", "通过", "进行", "结果", "意义", "内容", "笔记", "nbsp"]);
            const text = textArray.join(" ").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, " ").replace(/\b\w{1,3}\b/g, " ");
            const words = text.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
            const freq = {};
            words.forEach(w => freq[w] = (freq[w] || 0) + 1);
            return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, count);
          };
          const getTopPublications = (items, count = 3) => {
            const pubTitles = items.map(i => i.getField("publicationTitle")).filter(title => title && title.trim().length > 0);
            const freqMap: Record<string, number> = {};
            pubTitles.forEach(title => {
              freqMap[title] = (freqMap[title] || 0) + 1;
            });
            return Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, count).map(([name]) => name);
          };
          const bibKeywords = getTopKeywords(regularItems.map(i => i.getDisplayTitle()), 3);
          const noteTexts = noteItems.map(n => n.getNote());
          const noteKeywords = getTopKeywords(noteTexts, 3);
          const annoCounts = [];
          for (const i of regularItems) {
            const attItem = await i.getBestAttachment();
            if (!isPromptActive()) {
              return;
            }
            if (attItem) {
              const n = attItem.getAnnotations().length;
              if (n > 0) {
                annoCounts.push(n);
              }
            }
          }
          const annoAverageCount = annoCounts.length > 0 ? Math.round(sum(annoCounts) / annoCounts.length) : 0;
          const readDetails = regularItems.map(i => {
            const record = addon.api.storage.get(i, "readingTime");
            if (!record) {
              return null;
            }
            const seconds = sum(Object.values(record.data));
            return {
              item: i,
              seconds
            };
          }).filter(detail => detail !== null && detail.seconds > 0);
          const s2 = new Zotero.Search();
          s2.addCondition("dateAdded", "isAfter", "2024-12-31");
          s2.addCondition("dateAdded", "isBefore", "2026-01-01");
          s2.addCondition("tag", "contains", "全文翻译");
          const ids2 = await s2.search();
          if (!isPromptActive()) {
            return;
          }
          const ftItems = (await Promise.all(ids2.map(id => Zotero.Items.getAsync(id)))).filter(item => item !== null && item.attachmentReaderType == "snapshot");
          if (!isPromptActive()) {
            return;
          }
          const readCount = readDetails.length;
          const unreadCount = regularItems.length - readCount;
          const readRate = regularItems.length > 0 ? Math.round(readCount / regularItems.length * 100) : 0;
          const totalHour = Math.round(sum(readDetails.map(i => i.seconds)) / 3600 * 10) / 10;
          const top3Read = readDetails.sort((a, b) => b.seconds - a.seconds).slice(0, 3);
          const allTitles = allItems.filter(i => i.isRegularItem() && i.isTopLevelItem() && i.libraryID == 1 && !i.isNote()).map(i => i.getDisplayTitle());
          let chineseCount = 0;
          let englishCount = 0;
          const total = allTitles.length;
          allTitles.forEach(title => {
            if (/[\u4e00-\u9fa5]/.test(title)) {
              chineseCount++;
            } else {
              englishCount++;
            }
          });
          const chineseRatio = total > 0 ? (chineseCount / total * 100).toFixed(2) : 0;
          const englishRatio = total > 0 ? (englishCount / total * 100).toFixed(2) : 0;
          const data = {
            imported: regularItems.length,
            notes: noteItems.length,
            readCount,
            unreadCount,
            readRate,
            unreadRate: 100 - readRate,
            totalHour,
            bibKeywords: bibKeywords.map(w => w.toUpperCase()).join(" · "),
            noteKeywords: noteKeywords.join(" · "),
            topPublication: getTopPublications(regularItems, 3).join(" · "),
            ftCount: ftItems.length,
            annoAverageCount,
            chineseCount,
            englishCount
          };
          const container = prompt2.createCommandsContainer();
          container.innerHTML = "";
          Object.assign(container.style, {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px 20px",
            background: "transparent",
            maxHeight: "500px",
            overflowY: "auto",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#333"
          });
          const lines: Array<{type: string; content?: string; sub?: string; size?: string; color?: string; margin?: string; marginTop?: string; weight?: string; italic?: boolean; prefix?: string; value?: number; suffix?: string}> = [{
            type: "text",
            content: "2025 年度总结",
            size: "1.5em",
            weight: "800",
            margin: "0 0 30px 0",
            color: "#1a1a1a"
          }, {
            type: "text",
            content: `\u{1F44B} \u4F60\u597D\u54C7\uFF0C${Zotero.Users.getCurrentName() || "研究者"}`,
            size: "1.2em",
            color: "#999",
            margin: "30px 0 8px 0"
          }, {
            type: "split"
          }, {
            type: "number",
            prefix: "📚 今年，你导入文献 ",
            value: data.imported,
            suffix: " 篇",
            color: "#444"
          }, {
            type: "number",
            prefix: "📖 已读文献 ",
            value: data.readCount,
            suffix: ` \u7BC7 (${data.readRate}%)`,
            color: "#435b4cff",
            weight: "600"
          }, {
            type: "number",
            prefix: "📔 尘封文献 ",
            value: data.unreadCount,
            suffix: ` \u7BC7 (${data.unreadRate}%)`,
            color: "#372d23ff"
          }, {
            type: "number",
            prefix: "🇨🇳 中文文献 ",
            value: data.chineseCount,
            suffix: ` \u7BC7 (${chineseRatio}%)`,
            color: "#435b4cff",
            weight: "600"
          }, {
            type: "number",
            prefix: "🌍 外文文献 ",
            value: data.englishCount,
            suffix: ` \u7BC7 (${englishRatio}%)`,
            color: "#372d23ff"
          }, {
            type: "number",
            prefix: "平均每篇文献你会做出 ",
            value: data.annoAverageCount,
            suffix: ` \u4E2A\u6807\u6CE8`,
            color: "#b4923eff"
          }, {
            type: "text",
            content: "年度学术关键词",
            size: "0.9em",
            color: "#bbb",
            margin: "40px 0 10px 0",
            weight: "600"
          }, {
            type: "text",
            content: data.bibKeywords || "暂无",
            size: "1.3em",
            color: "#007AFF",
            weight: "bold"
          }, {
            type: "text",
            content: "年度最爱阅读期刊",
            size: "0.9em",
            color: "#bbb",
            margin: "40px 0 10px 0",
            weight: "600"
          }, {
            type: "text",
            content: data.topPublication || "暂无",
            size: "1.3em",
            color: "#007AFF",
            weight: "bold"
          }, {
            type: "split"
          }, {
            type: "number",
            prefix: "📒 你创建了 ",
            value: data.notes,
            suffix: " 条笔记",
            color: "#444"
          }, {
            type: "text",
            content: "年度笔记关键词",
            size: "0.9em",
            color: "#bbb",
            margin: "40px 0 10px 0",
            weight: "600"
          }, {
            type: "text",
            content: data.noteKeywords || "暂无",
            size: "1.3em",
            color: "#007AFF",
            weight: "bold"
          }, {
            type: "split"
          }, {
            type: "number",
            prefix: "🕤 阅读总时长 ",
            value: data.totalHour,
            suffix: " 小时",
            color: "#3478f6",
            weight: "bold"
          }, {
            type: "number",
            prefix: "平均每天 ",
            value: Math.round(data.totalHour * 60 / 365),
            suffix: " 分钟",
            color: "#3c61a4ff",
            weight: "bold"
          }, {
            type: "number",
            prefix: "平均每篇 ",
            value: readCount > 0 ? Math.round(data.totalHour * 60 / readCount) : 0,
            suffix: " 分钟",
            color: "#2f497aff",
            weight: "bold"
          }, {
            type: "text",
            content: "💬 阅读数据由 Style 插件统计，若插件安装时间较短，统计数据可能尚不完整。",
            size: "0.85em",
            color: "#ccc",
            marginTop: "4px"
          }, {
            type: "text",
            content: "🏆 阅读 TOP 3",
            size: "0.9em",
            color: "#999",
            margin: "25px 0 10px 0"
          }, ...top3Read.map((d, index) => ({
            type: "text",
            content: `${["🥇", "🥈", "🥉"][index]} ${d.item.getDisplayTitle().substring(0, 28)}...`,
            sub: `\u9605\u8BFB\u65F6\u957F\uFF1A${Math.round(d.seconds / 60)} \u5206\u949F`,
            size: "0.9em",
            color: "#555",
            margin: "12px 0"
          })), {
            type: "split"
          }, {
            type: "number",
            prefix: "📖 使用 Refolio 全文翻译 ",
            value: data.ftCount,
            suffix: ` \u6B21`,
            color: "#3478f6"
          }, {
            type: "split"
          }, {
            type: "text",
            content: "🌙 Style 无法计算你是否阅读到深夜，但那些静谧时光，星光与你都记得",
            size: ".8em",
            color: "#555"
          }, {
            type: "text",
            content: "🎉 加油，2026 ～",
            size: "1.2em",
            weight: "bold"
          }, {
            type: "split"
          }, {
            type: "text",
            content: "✨ 星光不问赶路人，每一步都算数",
            size: "0.85em",
            color: "#ccc",
            marginTop: "10px"
          }, {
            type: "text",
            content: "* 本报告由 Refolio 插件生成",
            size: "0.85em",
            color: "#ccc",
            italic: true,
            margin: "0"
          }];
          const animateNumber = (element, target) => {
            const duration = 1500;
            const startTime = window.performance.now();
            const update = now => {
              if (!active || !container.isConnected || container.style.display === "none" || !prompt2.promptNode.isConnected || prompt2.promptNode.style.display === "none") {
                return;
              }
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeOut = 1 - Math.pow(1 - progress, 4);
              element.innerText = String(target % 1 === 0 ? Math.floor(easeOut * target) : (easeOut * target).toFixed(1));
              if (progress < 1) {
                scheduleAnimationFrame(update);
              } else {
                element.innerText = String(target);
              }
            };
            scheduleAnimationFrame(update);
          };
          const canvas = document.createElement("canvas");
          Object.assign(canvas.style, {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0
          });
          container.appendChild(canvas);
          const launchFireworks = () => {
            const context = canvas.getContext("2d");
            if (!context) {
              return;
            }
            const drawingContext = context;
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            const particles = [];
            const colors = ["#FF3B30", "#007AFF", "#FFCC00", "#4CD964", "#5856D6", "#FF9500"];
            class Particle {
    declare x: any;
    declare y: any;
    declare color: any;
    declare velocity: { x: number; y: number; };
    declare alpha: number;
    declare friction: number;

              constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                this.velocity = {
                  x: (Math.random() - 0.5) * 8,
                  y: (Math.random() - 0.5) * 8
                };
                this.alpha = 1;
                this.friction = 0.95;
              }
              draw() {
                drawingContext.globalAlpha = this.alpha;
                drawingContext.beginPath();
                drawingContext.arc(this.x, this.y, 2, 0, Math.PI * 2);
                drawingContext.fillStyle = this.color;
                drawingContext.fill();
              }
              update() {
                this.velocity.x *= this.friction;
                this.velocity.y *= this.friction;
                this.x += this.velocity.x;
                this.y += this.velocity.y;
                this.alpha -= 0.01;
              }
            }
            const createFirework = () => {
              const x = Math.random() * canvas.width;
              const y = Math.random() * (canvas.height * 0.6);
              const color = colors[Math.floor(Math.random() * colors.length)] ?? colors[0];
              for (let i = 0; i < 30; i++) {
                particles.push(new Particle(x, y, color));
              }
            };
            const animate = () => {
              if (!active || !container.isConnected || container.style.display === "none" || !prompt2.promptNode.isConnected || prompt2.promptNode.style.display === "none") {
                return;
              }
              drawingContext.clearRect(0, 0, canvas.width, canvas.height);
              particles.forEach((p, i) => {
                if (p.alpha <= 0) {
                  particles.splice(i, 1);
                } else {
                  p.update();
                  p.draw();
                }
              });
              if (Math.random() < 0.05) {
                createFirework();
              }
              scheduleAnimationFrame(() => animate());
            };
            animate();
          };
          lines.forEach((lineData, i) => {
            const lineWrap = document.createElement("div");
            lineWrap.style.opacity = "0";
            lineWrap.style.transform = "translateY(15px)";
            lineWrap.style.transition = "all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
            lineWrap.style.marginBottom = lineData.margin ? "0" : "14px";
            lineWrap.style.marginTop = lineData.marginTop ?? (lineData.margin ? lineData.margin.split(" ")[0] : "0");
            const line = document.createElement("div");
            line.style.fontSize = lineData.size || "1.05em";
            line.style.fontWeight = lineData.weight || "400";
            line.style.color = lineData.color || "#333";
            line.style.fontStyle = lineData.italic ? "italic" : "normal";
            if (lineData.type === "split") {
              Object.assign(line.style, {
                height: "1px",
                width: "40px",
                background: "#f0f0f0",
                margin: "30px auto"
              });
            } else if (lineData.type === "number") {
              const numSpan = document.createElement("span");
              numSpan.style.margin = "0 4px";
              numSpan.style.fontSize = "1.2em";
              numSpan.style.fontWeight = "800";
              line.appendChild(document.createTextNode(lineData.prefix));
              line.appendChild(numSpan);
              line.appendChild(document.createTextNode(lineData.suffix));
              lineWrap.addEventListener("transitionstart", () => animateNumber(numSpan, lineData.value), {
                once: true
              });
            } else {
              line.innerText = lineData.content;
            }
            lineWrap.appendChild(line);
            if (lineData.sub) {
              const sub = document.createElement("div");
              Object.assign(sub.style, {
                fontSize: "0.8em",
                color: "#999",
                marginTop: "4px"
              });
              sub.innerText = lineData.sub;
              lineWrap.appendChild(sub);
            }
            container.appendChild(lineWrap);
            scheduleTimeout(() => {
              lineWrap.style.opacity = "1";
              lineWrap.style.transform = "translateY(0)";
              lineWrap.dispatchEvent(new window.Event("transitionstart"));
            }, i * 600);
          });
          scheduleTimeout(() => {
            launchFireworks();
          }, lines.length * 600);
        } catch (e) {
          window.alert(e);
        }
      }
    }]);
    return () => {
      if (!active) {
        return;
      }
      active = false;
      searchGeneration += 1;
      clearSuppressedSearch();
      for (const timer of pendingTimeouts) {
        window.clearTimeout(timer);
      }
      pendingTimeouts.clear();
      for (const frame of pendingAnimationFrames) {
        window.cancelAnimationFrame(frame);
      }
      pendingAnimationFrames.clear();
      for (const settle of pendingTurnResolvers) {
        settle();
      }
      pendingTurnResolvers.clear();
      restorePromptSuggestions();
      for (const id of commandIDs) {
        ztoolkit.Prompt.unregister(id);
      }
    };
  }

