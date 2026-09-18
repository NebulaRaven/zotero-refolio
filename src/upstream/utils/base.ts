import { Requests } from "./requests.ts";
import { RateLimitedRequestScheduler } from "./rateLimitedRequestScheduler.ts";
import { getString, getErrorMessage } from "./locale.ts";
import { getPref } from "./prefs.ts";
import { getPublicationTagNotificationPolicy } from "./publicationTagUpdatePolicy.ts";
import { spMergeRanks } from "../../core/journals.ts";
import { spGetJournalQuery,spGetAutomaticJournalRanks,spStoreJournalLookup } from "../../app/journalLookup.ts";
import { registerNotify } from "../platform/zotero/notifier.ts";
import { findAnnotationColorName } from "../features/annotations/annotationColorNames.ts";
  // src/utils/base.ts
  export function adjustDialogLayout(dialog) {
    dialog.window.addEventListener("load", () => {
      const maxWidth = [...dialog.window.document.querySelectorAll("label")].map(e => Number(e.getBoundingClientRect().width)).sort((a, b) => b - a)[0];
      ztoolkit.UI.appendElement({
        tag: "style",
        namespace: "html",
        properties: {
          innerHTML: `
        [type="range"] {
          -webkit-appearance: none;
          appearance: none;
          margin: 0;
          outline: 0;
          background-color: transparent;
          width: 500px;
          border-radius: 10px;
        }
        input[type=range]::-moz-range-track {
          height: 4px;
          background: rgb(229, 229, 229);
          border-radius: 10px;
        }
        input[type=range]::-moz-range-progress {
          background: #767676;
          height: 4px;
          border-radius: 10px;
        }

        /* \u5B9A\u4E49range\u63A7\u4EF6\u8F68\u9053\u7684\u6837\u5F0F */
        [type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          background: rgb(229, 229, 229);
          border-radius: 10px;
        }

        /* \u5B9A\u4E49range\u63A7\u4EF6\u5BB9\u5668\u7684\u6837\u5F0F */
        [type="range" i]::-webkit-slider-container {
          height: 20px;
          overflow: hidden;
        }

        /* \u5B9A\u4E49range\u63A7\u4EF6\u62C7\u6307\u7684\u6837\u5F0F */
        [type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: #767676 !important;
          border: 1px solid transparent;
          margin-top: -8px;
          border-image: linear-gradient(#767676, #767676) 0 fill / 8 20 8 0 / 0px 0px 0 2000px;
        }
        input[type=text], input[type=password]{
          width: 100% !important;
          border-radius: 2px !important;
          border: 1px solid var(--color-border) !important;
          padding: 0px .5em !important;
          height: 2em !important;
          background-image: none !important;
        }
        input[type=text]:focus, input[type=password]:focus {
          border: 1px solid var(--accent-blue) !important;
        }
        select {
          border: 1px solid var(--color-border);
          border-radius: 4px;
          height: 2.2em;
          padding: 0 1em;
        }
        .dropdown-content {
          background-color: var(--material-background);
          color: currentColor;
        }

        `
        }
      }, dialog.window.document.head);
      dialog.window.document.querySelectorAll("select").forEach(e => {
        e.parentElement?.parentElement?.setAttribute("style", `
            width: 100%;
          `);
      });
      dialog.window.document.querySelectorAll("label").forEach(e => {
        e.setAttribute("style", `width: ${maxWidth}px;text-align: right;`);
        e.parentElement?.setAttribute("style", `
            width: calc(${maxWidth}px + 1em);
            display: flex;
            align-items: center;
            padding-right: 1em;
            justify-content: center;
          `);
        e.parentElement?.parentElement?.setAttribute("style", `
            display: flex;
            align-items: center;
            justify-content: center;
          `);
      });
      dialog.window.document.querySelectorAll("input").forEach(e => {
        e.setAttribute("style", "width: 100%;");
        e.parentElement?.setAttribute("style", `
                    display: flex;
                    align-items: center;
                    flex-grow: 1;
                    justify-content: center;
                  `);
        e.parentElement?.parentElement?.setAttribute("style", "display: flex;");
      });
    });
  }
  export var requests = new Requests();
  export var PUBLICATION_REQUEST_INTERVAL_MS = 600;
  export var publicationRequestScheduler = new RateLimitedRequestScheduler(PUBLICATION_REQUEST_INTERVAL_MS, {
    now: () => Date.now(),
    delay: milliseconds => Zotero.Promise.delay(milliseconds)
  });
  export var lastPublicationTagsErrorNotice = 0;
  export function getHTTPStatus(error) {
    if (!error || typeof error !== "object") {
      return 0;
    }
    const value = error;
    return Number(value.status || value.statusCode || 0) || 0;
  }
  export function showPublicationTagsError(error) {
    const now = Date.now();
    if (now - lastPublicationTagsErrorNotice < 5000) {
      return;
    }
    lastPublicationTagsErrorNotice = now;
    const status = getHTTPStatus(error);
    const text = status === 403 ? getString("publication-tags-rate-limited") : getString("publication-tags-fetch-failed", {
      args: {
        status: status > 0 ? status : "network"
      }
    });
    new ztoolkit.ProgressWindow(getString("ui-feature-publicationTagsColumn"), {
      closeTime: 6000,
      closeOtherProgressWindows: true
    }).createLine({
      text,
      type: "fail"
    }).show();
  }
  export function getPublicationTitle(item) {
    let fields = getPref(`publicationColumn.fields`);
    if (!fields.includes("publicationTitle")) {
      fields = "publicationTitle, conferenceName, university, publisher";
    }
    return fields.split(/,\s*/).map(field => {
      return item.getField(field);
    }).find(i => i && i.length > 0) || "";
  }
  export async function updatePublicationTags(localStorage, publicationTitle, trigger = "automatic") {
    if (!publicationTitle?.trim()) return 0;
    if (trigger === "automatic" && getPref("publicationTagsColumn.automaticUpdates") === false) return 0;
    const notificationPolicy = getPublicationTagNotificationPolicy(trigger);
    let query;
    try { query = spGetJournalQuery(publicationTitle); }
    catch (error) { if (notificationPolicy.showError) window.alert(getErrorMessage(error)); return; }
    const garden = query.provider === "garden";
    const apiKey = String(getPref(garden ? "garden.apiKey" : "easyscholar.secretKey") || "").trim();
    if (!apiKey && !garden) {
      if (notificationPolicy.showError || trigger === "settings") window.alert(getString("ui-enter-api-key", { args: { provider: "EasyScholar" } }));
      return;
    }
    if (!apiKey && garden && !notificationPolicy.showResult) return;
    const responses = [], failedNames = [];
    let lastError;
    for (const name of query.names) {
      if (localStorage.disposed || query.identity !== spGetJournalQuery(publicationTitle).identity) return;
      try {
        const response = garden ? await getGardenJournalRank(name, apiKey) : await publicationRequestScheduler.run(`easyscholar:${name}`, () =>
          requests.get(`https://www.easyscholar.cc/open/getPublicationRank?secretKey=${encodeURIComponent(apiKey)}&publicationName=${encodeURIComponent(name)}`, "json", {}, true));
        if (!response?.data?.officialRank) throw new Error("Journal service returned an invalid response.");
        responses.push({ name, response });
      } catch (error) { lastError = error; failedNames.push(name); }
    }
    if (!responses.length) {
      if (notificationPolicy.showError || trigger === "settings") showPublicationTagsError({ status: getHTTPStatus(lastError) });
      return;
    }
    const result = spMergeRanks(responses);
    if (!Object.keys(result.rank).length && lastError) {
      if (notificationPolicy.showError || trigger === "settings") showPublicationTagsError({ status: getHTTPStatus(lastError) });
      return;
    }
    if (lastError) {
      const previous = spGetAutomaticJournalRanks(localStorage, publicationTitle);
      if (previous && typeof previous === "object") result.rank = { ...previous, ...result.rank };
    }
    if (!await spStoreJournalLookup(localStorage, publicationTitle, query, result, failedNames, trigger)) return;
    if (notificationPolicy.showResult && !result.conflicts.length) {
      const popup = new ztoolkit.ProgressWindow(getString("ui-feature-publicationTagsColumn"), { closeTime: 5000 }).show();
      popup.createLine({ text: publicationTitle, type: "default" });
      for (const [key, value] of Object.entries(result.rank)) popup.createLine({ text: `${key}: ${value}`, type: "success" });
      if (!Object.keys(result.rank).length) popup.createLine({ text: getString("ui-not-found"), type: "fail" });
      if (lastError) popup.createLine({ text: getString("ui-failed-journal-queries", { args: { count: failedNames.length } }), type: "fail" });
    }
    return Object.keys(result.rank).length ? 1 : 0;
  }
  export async function getGardenJournalRank(name, apiKey) {
    const res = await publicationRequestScheduler.run(`garden:${name}`, () => Zotero.HTTP.request("POST", "https://soil.magiczotero.top/v1/journal-labels/query", {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ items: [{ query: name }], include_paid: true }),
      responseType: "json"
    }));
    if (res.status !== 200) throw Object.assign(new Error("Garden request failed"), { status: res.status });
    const result = res.response?.results?.[0];
    if (!result || (result.matched && !Array.isArray(result.labels))) throw new Error("Garden returned an invalid response.");
    const all = Object.fromEntries((result.matched ? result.labels : [])
      .filter(label => typeof label.value === "string" || typeof label.value === "number")
      .map(label => [label.name, label.value]));
    return { data: { officialRank: { all } } };
  }
  export function addColorNameTag() {
    let active = true;
    const unregisterNotify = registerNotify(["item"], async (event, type, ids, extraData) => {
      if (event !== "add") {
        return;
      }
      await Zotero.Promise.delay(0);
      if (!active || !getPref(`function.addColorNameTag.enable`)) {
        return;
      }
      const configuredColors = getPref(`annotationColors`);
      for (const id of ids) {
        const item = Zotero.Items.get(id);
        if (!item?.isAnnotation()) {
          continue;
        }
        const configuredName = findAnnotationColorName(configuredColors, item.annotationColor);
        if (!configuredName) {
          continue;
        }
        let name = configuredName;
        try {
          name = Zotero.getString(configuredName);
        } catch {}
        item.addTag(name);
        await item.saveTx();
      }
    });
    return () => {
      active = false;
      unregisterNotify();
    };
  }
  export function isEnabel(key) {
    return getPref(`function.${key}.enable`);
  }
  export function getCurrentUTCTime() {
    const now = /* @__PURE__ */new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const date = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");
    const utcTimeString = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
    return utcTimeString;
  }
  export function lineProgress(value, maxValue, color = "#62B6B7", opacity = "1", type = "1") {
    if (type == "1") {
      const [red, green, blue] = getRGB(color);
      const percent = value / maxValue * 100;
      const heightPct = 0.28;
      const span = ztoolkit.UI.createElement(document, "span", {
        styles: {
          position: "relative",
          height: "20px",
          width: "100%",
          margin: "auto 0",
          display: "inline-block",
          opacity
        },
        classList: ["progress"],
        subElementOptions: [{
          tag: "span",
          styles: {
            position: "absolute",
            left: "0",
            height: `${heightPct * 100}%`,
            top: `calc(50% - ${heightPct * 100}%/2)`,
            width: "100%",
            display: "inline-block",
            backgroundColor: `rgba(${red}, ${green}, ${blue}, .23)`,
            borderRadius: "1em"
          }
        }, {
          tag: "span",
          id: "progress",
          styles: {
            position: "absolute",
            left: "0",
            height: `${heightPct * 100}%`,
            top: `calc(50% - ${heightPct * 100}%/2)`,
            width: `${percent > 100 ? 100 : percent}%`,
            transition: "width 1s linear",
            display: "inline-block",
            backgroundColor: `rgba(${red}, ${green}, ${blue}, 1)`,
            borderRadius: "1em"
          }
        }]
      });
      return span;
    } else if (type == "2") {
      const [red, green, blue] = getRGB(color);
      const percent = value / maxValue * 100;
      const heightPct = 0.1;
      const radius = 3;
      const borderWidth = 2;
      const span = ztoolkit.UI.createElement(document, "span", {
        styles: {
          position: "relative",
          height: "20px",
          width: "100%",
          margin: "auto 0",
          display: "inline-block",
          opacity
        },
        classList: ["progress"],
        children: [{
          tag: "span",
          styles: {
            position: "absolute",
            left: "0",
            height: `${heightPct * 100}%`,
            top: `calc(50% - ${heightPct * 100}%/2)`,
            width: "100%",
            display: "inline-block",
            backgroundColor: color,
            borderRadius: "1em"
          }
        }, {
          tag: "span",
          id: "circle",
          styles: {
            position: "absolute",
            left: `calc(${percent > 100 ? 100 : percent}% - ${radius}px - ${borderWidth}px)`,
            width: `${radius * 2}px`,
            height: `${radius * 2}px`,
            top: `calc(50% - ${radius}px - ${borderWidth}px)`,
            display: "inline-block",
            backgroundColor: "var(--material-stripe)",
            borderRadius: "50%",
            border: `${borderWidth}px solid ${color}`
          }
        }]
      });
      return span;
    } else {
      return ztoolkit.UI.createElement(document, "span");
    }
  }
  export function getRGB(color) {
    let sColor = color.toLowerCase();
    const reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
    if (sColor && reg.test(sColor)) {
      if (sColor.length === 4) {
        let sColorNew = "#";
        for (let i = 1; i < 4; i += 1) {
          sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1));
        }
        sColor = sColorNew;
      }
      const sColorChange = [];
      for (let i = 1; i < 7; i += 2) {
        sColorChange.push(parseInt("0x" + sColor.slice(i, i + 2)));
      }
      return sColorChange;
    }
    return sColor;
  }
  export function escapeExceptAllowedTags(text) {
    if (!text) {
      return "";
    }
    let escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const tagsToRestore = [/&lt;(b|i|sub|sup)&gt;(.*?)&lt;\/\1&gt;/g];
    tagsToRestore.forEach(regex => {
      escapedText = escapedText.replace(regex, (match, p1, p2) => `<${p1}>${p2}</${p1}>`);
    });
    return escapedText;
  }
  export function registerShortcut(value, callback, type = "prefKey") {
    let shortcutString = (type == "prefKey" ? getPref(`${value}`) : value).replace(/\s\+\s/g, ",").toLowerCase();
    shortcutString = shortcutString.replace("ctrl", "control");
    const keyboardCallback = async (ev, options) => {
      const _shortcutString = shortcutString.slice(0, -1) + shortcutString.slice(-1)[0].toUpperCase();
      if (options.keyboard && options.keyboard.equals(shortcutString) || options.keyboard && options.keyboard.equals(_shortcutString)) {
        ztoolkit.log(shortcutString);
        await callback(ev);
      }
    };
    ztoolkit.Keyboard.register(keyboardCallback);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      ztoolkit.Keyboard.unregister(keyboardCallback);
    };
  }
  export function listenShortcut(inputNode, callback) {
    inputNode.addEventListener("keydown", e => {
      e.preventDefault();
      e.stopPropagation();
      const shortcut: {control: boolean; meta: boolean; shift: boolean; alt: boolean; key?: string} = {
        control: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey
      };
      if (!["Shift", "Meta", "Ctrl", "Alt", "Control"].includes(e.key)) {
        shortcut.key = e.key.toUpperCase();
      }
      const keys2 = [];
      if (shortcut.control) {
        keys2.push("Ctrl");
      }
      if (shortcut.meta) {
        keys2.push("Meta");
      }
      if (shortcut.shift) {
        keys2.push("Shift");
      }
      if (shortcut.alt) {
        keys2.push("Alt");
      }
      window.setTimeout(() => {
        inputNode.value = [...keys2, ...[shortcut.key]].filter(Boolean).join(" + ");
        ztoolkit.log(keys2, shortcut, inputNode.value);
        callback(inputNode.value);
      });
    });
  }
  export function getColoredTags(item) {
    return item.getTags().map(tag => {
      const colorPos = Zotero.Tags.getColor(item.libraryID, tag.tag);
      if (colorPos) {
        tag.color = colorPos.color;
        tag.position = colorPos.position;
        return tag;
      }
      return false;
    }).filter(Boolean);
  }
  export function isOnlyEmoji(str) {
    const re = new RegExp("\\p{Extended_Pictographic}|\\u200D|\\uFE0F", "gu");
    return !str.replace(re, "");
  }
  export function getDefaultPaperMatrixCoreFields() {
    const nameColors = JSON.parse(getPref(`annotationColors`));
    const coreFields = [];
    for (const nc of nameColors) {
      coreFields.push({
        name: nc[0],
        condition: {
          attribute: "color",
          operator: "is",
          value: nc[1]
        }
      });
    }
    return coreFields;
  }
