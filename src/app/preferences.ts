import { getString, getErrorMessage, getPreferenceOptionLabel } from "../upstream/utils/locale.ts";
import { config } from "../upstream/config.ts";
import { trackPreferenceWindow } from "../upstream/features/preferences/preferenceWindow.ts";
import { spElement,spSelect,spSelectOptions } from "./ui.ts";
import { spFeatureDefinitions,spFeatureGroups,spInactivePreferences } from "../core/features.ts";
import { readDefaultPreferences } from "../upstream/features/preferences/defaultPreferences.ts";
import { getPref,setPref } from "../upstream/utils/prefs.ts";
import { spPublicationNames } from "../core/journals.ts";
import { spFilterGraph } from "../core/graph.ts";
import { spRenderManualRanks } from "./manualRanks.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export async function registerPrefs() {
  await Zotero.PreferencePanes.register({
    pluginID: config.addonID, id: "stylepersonal-preferences",
    src: rootURI + "chrome/content/preferences.xhtml", label: "Refolio",
    image: `chrome://${config.addonRef}/content/icons/favicon@32x32.png`
  });
}
export async function registerPrefsScripts(prefWindow) {
  const doc = prefWindow.document;
  const container = doc.querySelector("#stylepersonal-settings");
  if (!container || container.dataset.loaded) return;
  const originalChildren = Array.from(container.childNodes);
  trackPreferenceWindow(addon.data, prefWindow);
  container.dataset.loaded = "true";
  const prefObservers = [];
  const registration = addon.data.prefs;
  const originalRelease = registration?.release;
  let released = false;
  let releaseManualRanks: () => void = () => {};
  const release = () => {
    if (released) return; released = true;
    for (const id of prefObservers) Zotero.Prefs.unregisterObserver(id);
    prefWindow.removeEventListener("unload", release);
    releaseManualRanks();
    container.replaceChildren(...originalChildren);
    delete container.dataset.loaded;
    originalRelease?.();
  };
  if (registration) registration.release = release;
  prefWindow.addEventListener("unload", release, { once: true });
  const create = spElement.bind(null, doc);
  const status = create("p", container);
  status.setAttribute("role", "status");
  status.className = "sp-status";
  create("p", container, getString("ui-restart-zotero-to-apply-feature-switches-graph-and-journal")).className = "sp-help";
  const search = create("input", container); search.type = "search";
  search.placeholder = getString("ui-find-a-feature-or-setting");
  search.setAttribute("aria-label", search.placeholder); search.className = "sp-search";
  const sections = new Map();
  const navigation = create("nav", container); navigation.className = "sp-actions sp-navigation";
  for (const [id, labelID] of spFeatureGroups) {
    const link = create("a", navigation, getString(labelID)); link.href = `#sp-group-${id}`;
    const section = create("section", container); section.id = `sp-group-${id}`;
    create("h2", section, getString(labelID)); sections.set(id, section);
  }
  const defaults = readDefaultPreferences();
  const featured = new Set();
  const addField = (key, label, choices, parent = container) => {
    featured.add(key);
    const fallback = defaults.get(`${config.prefsPrefix}.${key}`);
    const value = getPref(key) ?? fallback;
    const row = create("label", parent);
    row.className = "sp-field";
    row.dataset.search = `${label} ${key}`.toLowerCase();
    create("span", row, label);
    const type = typeof fallback;
    const input = choices ? spSelect(doc, row) : create(key === "publicationTagsColumn.aliases" ? "textarea" : "input", row);
    input.setAttribute("aria-label", label);
    input.dataset.pref = key;
    if (choices) {
      spSelectOptions(input, choices);
    } else if (input.localName === "input") {
      input.type = type === "boolean" ? "checkbox" : /secretKey|apiKey|cookies/i.test(key) ? "password" : type === "number" ? "number" : "text";
    }
    if (type === "boolean") {
      input.checked = Boolean(value); row.classList.add("sp-toggle"); row.prepend(input);
    } else input.value = String(value ?? "");
    prefObservers.push(Zotero.Prefs.registerObserver(`${config.prefsPrefix}.${key}`, () => {
      if (doc.activeElement === input) return;
      const current = getPref(key) ?? fallback;
      if (type === "boolean") input.checked = Boolean(current); else input.value = String(current ?? "");
    }, true));
    input.addEventListener("change", async () => {
      try {
        const next = type === "boolean" ? input.checked : type === "number" ? Number(input.value) : input.value;
        if (type === "number" && !Number.isFinite(next)) throw new Error(getString("ui-enter-a-valid-number"));
        if (key === "publicationTagsColumn.aliases") spPublicationNames("validation", next);
        if (["graphView.minYear", "graphView.maxYear"].includes(key)) spFilterGraph({ nodes: {} }, [], {
          minYear: key.endsWith("minYear") ? next : getPref("graphView.minYear"),
          maxYear: key.endsWith("maxYear") ? next : getPref("graphView.maxYear")
        });
        setPref(key, next);
        status.textContent = getString("ui-saved-restart-zotero-after-changing-feature-switches");
        if (key.startsWith("graphView.")) await addon.api.refreshGraphView?.();
      } catch (error) { status.textContent = getErrorMessage(error); }
    });
  };
  const master = create("div", container); container.insertBefore(master, navigation);
  addField("enable", getString("ui-enable-refolio"), undefined, master);
  for (const [key, group, labelID] of spFeatureDefinitions) addField(`function.${key}.enable`, getString(labelID), undefined, sections.get(group));
  const journal = sections.get("journals"), graph = sections.get("graph"), reader = sections.get("reader"), columns = sections.get("columns");
  addField("publicationTagsColumn.source", getString("ui-provider"), [["easyscholar", "EasyScholar"], ["garden", "Garden"]], journal);
  addField("publicationTagsColumn.automaticUpdates", getString("ui-fetch-missing-journal-metrics-automatically"), undefined, journal);
  addField("easyscholar.secretKey", getString("ui-api-key", { args: { provider: "EasyScholar" } }), undefined, journal);
  addField("garden.apiKey", getString("ui-api-key", { args: { provider: "Garden" } }), undefined, journal);
  addField("publicationTagsColumn.fields", getString("ui-easyscholar-fields"), undefined, journal);
  addField("publicationTagsColumn.gardenFields", getString("ui-garden-fields"), undefined, journal);
  create("p", journal, getString("ui-chinese-english-journal-names-for-pku-core-cssci-and"));
  addField("publicationTagsColumn.aliases", getString("ui-custom-journal-aliases-json"), undefined, journal);
  releaseManualRanks = spRenderManualRanks(doc, journal, status);
  featured.add("publicationTagsColumn.manualRanks");
  for (const [mode, label] of [["citations", "citations"], ["note", "notes"], ["author", "authors"], ["tag", "tags"], ["genealogy", "genealogy"]]) {
    addField(`graphView.modes.${mode}`, getString("ui-show-graph-view", { args: { view: getString(`ui-mode-${label}`) } }), undefined, graph);
  }
  const citationPolicies = [["ask", getString("ui-always-ask")], ["update", getString("ui-update-automatically")], ["skip", getString("ui-do-not-update")]];
  addField("citations.onAdd", getString("ui-citations-on-add"), citationPolicies, graph);
  addField("citations.onEmpty", getString("ui-citations-on-empty"), citationPolicies, graph);
  addField("graphView.labelField", getString("ui-node-label"), [["authorYear",getString("ui-author-year")],["title",getString("ui-title")],["shortTitle",getString("ui-short-title")],["extra",getString("ui-extra-field")]], graph);
  addField("graphView.extraLabelKey", getString("ui-extra-field-name"), undefined, graph);
  addField("graphView.scope", getString("ui-graph-scope"), [["selected", getString("ui-selected-items")], ["all", getString("ui-current-view")]], graph);
  addField("graphView.depth", getString("ui-neighbourhood-depth"), [["1", "1"], ["2", "2"]], graph);
  addField("graphView.hideIsolated", getString("ui-hide-isolated-nodes"), undefined, graph);
  addField("graphView.minYear", getString("ui-from-year"), undefined, graph);
  addField("graphView.maxYear", getString("ui-to-year"), undefined, graph);
  create("p", graph, getString("ui-citation-arrows-point-to-the-cited-paper-select-an")).className = "sp-help";
  const zones = [["system",getString("ui-system-time-zone")], ...[-12,-11,-10,-9.5,-9,-8,-7,-6,-5,-4,-3.5,-3,-2,-1,0,1,2,3,3.5,4,4.5,5,5.5,5.75,6,6.5,7,8,8.75,9,9.5,10,10.5,11,12,12.75,13,14].map(n => [String(n),`UTC${n >= 0 ? "+" : ""}${n}`])];
  addField("dateAddedColumn.deltaHour",getString("ui-date-added-time-zone"),zones, columns);
  addField("dateModifiedColumn.deltaHour",getString("ui-date-modified-time-zone"),zones, columns);
  addField("readingProgress.recordingEnabled",getString("ui-record-reading-time"), undefined, reader);
  const advanced = create("details", container);
  create("summary", advanced, getString("ui-all-core-settings"));
  const options: Record<string, string[]> = {
    "dateAddedColumn.dateType": ["absolute", "relative"],
    "dateModifiedColumn.dateType": ["absolute", "relative"],
    "tagsColumn.align": ["left", "right"],
    "IFColumn.field": ["sciif", "sciif5", "综合影响因子", "复合影响因子"],
    "IFColumn.progressType": ["1", "2"],
    "ratingColumn.storage": ["extra", "tag"],
    "annotationColorNameDirection": ["horizontal", "vertical"],
    "graphView.mode": ["citations", "note", "author", "tag", "genealogy"]
  };
  for (const [key] of defaults) {
    const suffix = key.slice(config.prefsPrefix.length + 1);
    if (key.startsWith(config.prefsPrefix + ".") && !featured.has(suffix) && !spInactivePreferences.has(suffix)) {
      const choices = options[suffix]?.map(value => [value, getPreferenceOptionLabel(value)]);
      addField(suffix, getString(`pref-${suffix.replaceAll(".", "-")}`), choices, advanced);
    }
  }
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    for (const row of container.querySelectorAll(".sp-field")) row.hidden = Boolean(query) && !row.dataset.search.includes(query);
    for (const section of sections.values()) section.hidden = Boolean(query) && ![...section.querySelectorAll(".sp-field")].some(row => !row.hidden);
    advanced.open = Boolean(query);
  });
}
