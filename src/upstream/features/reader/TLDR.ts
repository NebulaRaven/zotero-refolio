import type { EditableText } from '../../../types/ui.ts';
import { getPref } from "../../utils/prefs.ts";
import { config } from "../../config.ts";
import { getString } from "../../utils/locale.ts";
import { getSuccessfulTldrTranslation,getTldrTextFromResponse,prepareTldrText } from "./tldrLogic.ts";
  // src/features/reader/TLDR.ts
  export function registerTLDRPane(win) {
    let active = true;
    const states = new WeakMap<Element, { item: Zotero.Item; dirty: boolean }>();
    const bindItem = (body: Element, item: Zotero.Item) => {
      const state = { item, dirty: false };
      states.set(body, state);
      return state;
    };
    const isCurrent = (body: Element, state: { item: Zotero.Item; dirty: boolean }) =>
      active && body.isConnected && states.get(body) === state;
    win.MozXULElement.insertFTLIfNeeded(`${config.addonRef}-mainWindow.ftl`);
    const sectionKey = Zotero.ItemPaneManager.registerSection({
      paneID: "TLDR",
      pluginID: config.addonID,
      header: {
        l10nID: `${config.addonRef}-TLDR-header`,
        icon: `chrome://zotero/skin/itempane/16/abstract.svg`
      },
      sidenav: {
        l10nID: `${config.addonRef}-TLDR-sidenav`,
        icon: `chrome://zotero/skin/itempane/20/abstract.svg`
      },
      bodyXHTML: `<editable-text id="TLDR" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" multiline="true" data-l10n-attrs="placeholder" style="--line-height: 1.5em;" value=""><textarea xmlns="http://www.w3.org/1999/xhtml" rows="1" class="input" no-windows-native=""></textarea></editable-text>`,
      onInit: ({
        body
      }) => {
        const inputNode = body.querySelector<EditableText>("editable-text#TLDR");
        if (!inputNode) {
          return;
        }
        inputNode.addEventListener("input", () => {
          const state = states.get(body);
          if (active && state?.item) bindItem(body, state.item).dirty = true;
        });
        inputNode.addEventListener("change", async () => {
          if (!active || !inputNode.isConnected) {
            return;
          }
          const state = states.get(body);
          if (!state?.item) return;
          bindItem(body, state.item);
          try {
            await ztoolkit.ExtraField.setExtraField(state.item, "TLDR", inputNode.value);
          } catch (error) { ztoolkit.log("Failed to save TLDR", error); }
        });
      },
      onRender: async ({
        body,
        item
      }) => {
        if (!active || !body.isConnected) {
          return;
        }
        const inputNode = body.querySelector<EditableText>("editable-text#TLDR");
        if (!inputNode) {
          return;
        }
        const current = states.get(body);
        if (current?.item?.id === item.id && current.dirty) return;
        const state = bindItem(body, item);
        inputNode.placeholder = getString("ui-no-tldr");
        const savedTldr = ztoolkit.ExtraField.getExtraField(item, "TLDR");
        if (savedTldr) {
          inputNode.value = savedTldr;
          return;
        }
        const tldr = await getItemTLDR(item, () => isCurrent(body, state));
        if (!isCurrent(body, state) || !inputNode.isConnected) {
          return;
        }
        inputNode.value = tldr || ztoolkit.ExtraField.getExtraField(item, "remark") || "";
      },
      onItemChange: ({
        tabType,
        item,
        body,
        setEnabled
      }) => {
        if (!active) {
          setEnabled(false);
          return false;
        }
        if (states.get(body)?.item?.id !== item?.id) bindItem(body, item);
        if (!["reader", "library"].includes(tabType)) {
          setEnabled(false);
        }
        return true;
      },
      sectionButtons: [{
        type: "translate",
        icon: `chrome://${config.addonRef}/content/icons/translate.svg`,
        l10nID: `${config.addonRef}-translate`,
        onClick: async ({
          item,
          body
        }) => {
          if (!active || !body.isConnected) {
            return;
          }
          const translate = getTldrTranslator();
          if (!translate) {
            window.alert(getString("tldr-translate-plugin-missing"));
            return;
          }
          const inputNode = body.querySelector<EditableText>("editable-text#TLDR");
          if (!inputNode) {
            return;
          }
          const state = bindItem(body, item);
          try {
            const translated = getSuccessfulTldrTranslation(await translate(inputNode.value));
            if (!translated || !isCurrent(body, state)) {
              return;
            }
            inputNode.value = translated;
            await ztoolkit.ExtraField.setExtraField(item, "TLDR", translated);
            if (active && body.isConnected) {
              onUpdateHeight({
                body
              });
            }
          } catch (error) {
            ztoolkit.log("TLDR translation failed", error);
          }
        }
      }, {
        type: "refresh",
        icon: `chrome://${config.addonRef}/content/icons/refresh.svg`,
        l10nID: `${config.addonRef}-refresh`,
        onClick: async ({
          item,
          body
        }) => {
          if (!active || !body.isConnected) {
            return;
          }
          const inputNode = body.querySelector<EditableText>("editable-text#TLDR");
          if (!inputNode) {
            return;
          }
          const DOI = item.getField("DOI");
          if (!DOI) {
            inputNode.value = getString("ui-doi-required-for-summary");
            new ztoolkit.ProgressWindow("TLDR").createLine({
              text: getString("ui-no-doi"),
              type: "default"
            }).show();
            return;
          }
          const state = bindItem(body, item);
          const tldr = await getItemTLDR(item, () => isCurrent(body, state));
          if (!isCurrent(body, state)) return;
          if (tldr && inputNode.isConnected) {
            inputNode.value = tldr;
            onUpdateHeight({
              body
            });
            new ztoolkit.ProgressWindow("TLDR").createLine({
              text: tldr,
              type: "success"
            }).show();
          } else {
            new ztoolkit.ProgressWindow("TLDR").createLine({
              text: getString("ui-no-tldr"),
              type: "default"
            }).show();
            return;
          }
        }
      }]
    });
    return () => {
      active = false;
      if (sectionKey) {
        Zotero.ItemPaneManager.unregisterSection(sectionKey);
      }
    };
  }
  export async function getItemTLDR(item, shouldContinue = () => true) {
    if (!shouldContinue()) {
      return "";
    }
    const DOI = item.getField("DOI");
    if (!DOI) {
      return "";
    }
    const api = `https://api.semanticscholar.org/graph/v1/paper/${DOI}?fields=tldr`;
    const res = await Zotero.HTTP.request("GET", api, {
      responseType: "json"
    });
    if (!shouldContinue()) {
      return "";
    }
    const sourceText = getTldrTextFromResponse(res.response);
    return prepareTldrText(sourceText, {
      autoTranslate: getPref(`tldr.autoTranslate`) === true,
      translate: getTldrTranslator(),
      persist: async text => {
        if (!shouldContinue()) {
          return;
        }
        await ztoolkit.ExtraField.setExtraField(item, "TLDR", text);
      },
      onTranslationError: error => {
        ztoolkit.log("TLDR auto translation failed", error);
      }
    });
  }
  export function getTldrTranslator() {
    const api = Zotero.PDFTranslate?.api;
    const translate = api?.translate;
    if (typeof translate !== "function") {
      return undefined;
    }
    return text => {
      const targetLanguage = Zotero.Prefs.get("ZoteroPDFTranslate.targetLanguage");
      return translate.call(api, text, {
        pluginID: config.addonID,
        ...(typeof targetLanguage === "string" && targetLanguage ? {
          langto: targetLanguage
        } : {})
      });
    };
  }
  export function onUpdateHeight({
    body
  }) {
    const details = body.closest("item-details");
    const head = body.closest("item-pane-custom-section")?.querySelector(".head");
    const heightKey = "--details-height";
    body?.style.setProperty(heightKey, `${details.querySelector(".zotero-view-item").clientHeight - head.clientHeight - 8}px`);
  }

