import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import { getPref,setPref } from "../upstream/utils/prefs.ts";
import { spNormalizeJournalName,spPublicationNames } from "../core/journals.ts";
import { spEffectiveRanks,spManualRankFields,spManualRankRecord,spReadManualRanks,spSaveManualRankRecord,spValidateManualRank } from "../core/manualRanks.ts";
import { config } from "../upstream/config.ts";
import { spElement,spSelectOptions } from "./ui.ts";
import { getPublicationTitle,updatePublicationTags } from "../upstream/utils/base.ts";
import { spGetAutomaticJournalRanks,spGetJournalLookup,spJournalChosenValue } from "./journalLookup.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spGetManualJournalRecord(title) {
  if (getPref("function.manualJournalRanks.enable") === false) return undefined;
  const names = spPublicationNames(title, getPref("publicationTagsColumn.aliases") || "{}");
  return spManualRankRecord(getPref("publicationTagsColumn.manualRanks"), names, spNormalizeJournalName);
}
export function spGetJournalRanks(storage, title) {
  return spEffectiveRanks(spGetAutomaticJournalRanks(storage, title), spGetManualJournalRecord(title));
}
export function spOpenSettings(journal?: string) {
  if (journal) addon.api.pendingManualJournal = journal;
  const win = Zotero.Utilities.Internal.openPreferences("stylepersonal-preferences");
  addon.api.openManualJournal?.(journal);
  return win;
}
export function spRegisterSettingsMenu() {
  const id = `${config.addonRef}-settings-panel`;
  ztoolkit.Menu.register("menuTools", { tag: "menuitem", id, label: getString("ui-refolio-settings"), commandListener: () => spOpenSettings() });
  return () => ztoolkit.Menu.unregister(id);
}
export function spRenderManualRanks(doc, parent, status) {
  const create = spElement.bind(null, doc);
  const section = create("details", parent);
  section.id = "stylepersonal-manual-journals";
  create("summary", section, getString("ui-journal-settings"));
  create("p", section, getString("ui-manual-sets-a-value-automatic-uses-provider-data-and")).className = "sp-help";
  const lookup = create("div", section); lookup.className = "sp-actions";
  const title = create("input", lookup); title.type = "text";
  title.placeholder = getString("ui-journal-name"); title.setAttribute("aria-label", title.placeholder);
  const load = create("button", lookup, getString("ui-load")); load.type = "button";
  const selected = create("button", lookup, getString("ui-selected-item-s-journal")); selected.type = "button";
  const saved = create("select", section); saved.setAttribute("aria-label", getString("ui-saved-journals"));
  const refreshSaved = () => {
    saved.replaceChildren(); const empty = create("option", saved, getString("ui-saved-journals-2")); empty.value = "";
    for (const record of Object.values(spReadManualRanks(getPref("publicationTagsColumn.manualRanks")))) {
      const option = create("option", saved, record.names[0]); option.value = record.names[0];
    }
  };
  const namesText = create("p", section);
  const queryRow = create("label", section); queryRow.className = "sp-field";
  queryRow.dataset.search = getString("ui-query-journal-name").toLowerCase();
  create("span", queryRow, getString("ui-query-journal-name"));
  const queryTitle = create("input", queryRow); queryTitle.type = "text";
  queryTitle.setAttribute("aria-label", getString("ui-query-journal-name"));
  queryTitle.placeholder = getString("ui-use-the-publication-name");
  create("p", section, getString("ui-enter-the-current-or-full-journal-name-to-query")).className = "sp-help";
  const conflicts = create("div", section); conflicts.className = "sp-journal-conflicts";
  const renderLookup = () => {
    conflicts.replaceChildren();
    const storage = addon.api.journalStorage;
    const report = storage && spGetJournalLookup(storage, loadedTitle);
    if (!report) return;
    create("p", conflicts, `${getString("ui-queried")}: ${report.names.join(" / ")}`);
    if (report.failedNames.length) create("p", conflicts, `${getString("ui-failed-queries")}: ${report.failedNames.join(" / ")}`);
    if (!report.conflicts.length) {
      create("p", conflicts, getString("ui-returned-fields-agree")); return;
    }
    create("h3", conflicts, getString("ui-rating-conflicts"));
    const table = create("table", conflicts); table.className = "sp-rank-table";
    const head = create("tr", create("thead", table));
    for (const label of [getString("ui-field"), getString("ui-returned-values"), getString("ui-used-value")]) create("th", head, label);
    const body = create("tbody", table);
    for (const conflict of report.conflicts) {
      const row = create("tr", body);
      create("td", row, conflict.field);
      create("td", row, conflict.values.map(value => `${value.name}${value.kind === "custom" ? ` (${getString("ui-custom")})` : ""}: ${value.value}`).join("\n"));
      create("td", row, spJournalChosenValue(loadedTitle, conflict.field, conflict.values[0].value));
    }
  };
  const table = create("table", section); table.className = "sp-rank-table";
  const head = create("tr", create("thead", table));
  for (const label of [getString("ui-field"), getString("ui-mode"), getString("ui-value")]) create("th", head, label);
  const body = create("tbody", table);
  const rows = new Map(); let loadedTitle = ""; let loadedNames = [];
  let active = true, generation = 0;
  const addRow = (field, label = field, value = undefined) => {
    if (rows.has(field)) return;
    const row = create("tr", body); create("td", row, label);
    const mode = create("select", create("td", row)); mode.setAttribute("aria-label", getString("ui-field-mode", { args: { field: label } }));
    spSelectOptions(mode, [["auto", getString("ui-automatic")], ["override", getString("ui-manual-2")], ["hide", getString("ui-hide")]]);
    const input = create("input", create("td", row)); input.type = "text"; input.setAttribute("aria-label", getString("ui-field-value", { args: { field: label } }));
    input.value = value == null ? "" : String(value);
    mode.value = value === null ? "hide" : value === undefined ? "auto" : "override";
    const update = () => { input.disabled = mode.value !== "override"; }; mode.addEventListener("change", update); update();
    rows.set(field, { mode, input });
  };
  const render = name => {
    loadedTitle = name.trim(); if (!loadedTitle) return;
    generation++;
    loadedNames = spPublicationNames(loadedTitle, getPref("publicationTagsColumn.aliases") || "{}");
    const record = spManualRankRecord(getPref("publicationTagsColumn.manualRanks"), loadedNames, spNormalizeJournalName);
    queryTitle.value = record?.queryTitle || "";
    title.value = loadedTitle; namesText.textContent = loadedNames.join(" / "); rows.clear(); body.replaceChildren();
    const fieldsKey = getPref("publicationTagsColumn.source") === "garden" ? "gardenFields" : "fields";
    const fields = new Map(fieldsKey === "gardenFields" ? [] : spManualRankFields.map(([field, labelID]) => [field, getString(labelID)]));
    for (const field of String(getPref(`publicationTagsColumn.${fieldsKey}`) || "").split(/,\s*/).filter(Boolean)) if (!fields.has(field)) fields.set(field, field);
    for (const field of Object.keys(record?.fields || {})) if (!fields.has(field)) fields.set(field, field);
    for (const [field, label] of fields) addRow(field, label, record?.fields?.[field]);
    renderLookup();
    section.open = true;
  };
  const run = fn => { try { fn(); } catch (error) { status.textContent = getErrorMessage(error); } };
  load.addEventListener("click", () => run(() => render(title.value)));
  title.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); run(() => render(title.value)); } });
  selected.addEventListener("click", () => run(() => {
    const item = Zotero.getActiveZoteroPane()?.getSelectedItems()?.[0];
    const name = item && getPublicationTitle(item);
    if (!name) throw new Error(getString("ui-select-an-item-with-a-journal-name-first"));
    render(name);
  }));
  saved.addEventListener("change", () => { if (saved.value) run(() => render(saved.value)); });
  const custom = create("div", section); custom.className = "sp-actions";
  const fieldName = create("input", custom); fieldName.placeholder = getString("ui-custom-field-key"); fieldName.setAttribute("aria-label", fieldName.placeholder);
  const add = create("button", custom, getString("ui-add-field")); add.type = "button";
  add.addEventListener("click", () => run(() => {
    if (!loadedTitle) throw new Error(getString("ui-load-a-journal-first"));
    const key = fieldName.value.trim(); spValidateManualRank(key, "1"); addRow(key); fieldName.value = "";
  }));
  const save = create("button", section, getString("ui-save-journal-settings")); save.type = "button";
  save.addEventListener("click", async () => {
    const currentGeneration = generation;
    save.disabled = true;
    try {
      if (!loadedTitle || title.value.trim() !== loadedTitle) throw new Error(getString("ui-load-the-journal-name-before-saving"));
      const fields = {};
      for (const [field, { mode, input }] of rows) {
        if (mode.value === "hide") fields[field] = null;
        if (mode.value === "override") fields[field] = spValidateManualRank(field, input.value);
      }
      const journal = loadedTitle;
      const previousQuery = spManualRankRecord(getPref("publicationTagsColumn.manualRanks"), loadedNames, spNormalizeJournalName)?.queryTitle || "";
      const records = spSaveManualRankRecord(getPref("publicationTagsColumn.manualRanks"), loadedNames, fields, spNormalizeJournalName, queryTitle.value);
      setPref("publicationTagsColumn.manualRanks", JSON.stringify(records));
      const displayKey = `publicationTagsColumn.${getPref("publicationTagsColumn.source") === "garden" ? "gardenFields" : "fields"}`;
      const display = String(getPref(displayKey) || "").split(/,\s*/).filter(Boolean);
      setPref(displayKey, [...new Set([...display, ...Object.keys(fields).filter(field => fields[field] !== null)])].join(", "));
      const queryChanged = previousQuery !== queryTitle.value.trim();
      const storage = addon.api.journalStorage;
      let updated;
      if (queryChanged && storage) {
        await storage.lock.promise;
        updated = await updatePublicationTags(storage, journal, "settings");
      }
      for (const win of Zotero.getMainWindows()) {
        const itemsView = win.ZoteroPane?.itemsView;
        if (itemsView) await itemsView.refreshAndMaintainSelection();
      }
      if (!active || generation !== currentGeneration) return;
      refreshSaved(); renderLookup();
      if (queryChanged && (!storage || updated === undefined)) {
        status.textContent = getString("ui-settings-saved-journal-lookup-is-pending"); return;
      }
      status.textContent = getPref("function.manualJournalRanks.enable") === false && Object.keys(fields).length > 0
        ? getString("ui-saved-enable-manual-journal-overrides-to-display-these-values")
        : getString("ui-journal-settings-saved");
    } catch (error) { if (active && generation === currentGeneration) status.textContent = getErrorMessage(error); }
    finally { if (active) save.disabled = false; }
  });
  const refresh = create("button", section, getString("ui-refresh-journal-ratings")); refresh.type = "button";
  refresh.addEventListener("click", async () => {
    const currentGeneration = generation;
    refresh.disabled = true;
    try {
      if (!loadedTitle || title.value.trim() !== loadedTitle) throw new Error(getString("ui-load-a-journal-first"));
      const savedQuery = spManualRankRecord(getPref("publicationTagsColumn.manualRanks"), loadedNames, spNormalizeJournalName)?.queryTitle || "";
      if (queryTitle.value.trim() !== savedQuery) throw new Error(getString("ui-save-the-query-name-first"));
      const journal = loadedTitle;
      const storage = addon.api.journalStorage;
      if (!storage) throw new Error(getString("ui-enable-the-item-table-and-restart-zotero-to-query"));
      await storage.lock.promise;
      const updated = await updatePublicationTags(storage, journal, "settings");
      if (!active || generation !== currentGeneration) return;
      renderLookup();
      status.textContent = updated === undefined ? getString("ui-journal-lookup-failed") : getString("ui-journal-ratings-updated");
      for (const win of Zotero.getMainWindows()) {
        const view = win.ZoteroPane?.itemsView;
        if (view) await view.refreshAndMaintainSelection();
      }
    } catch (error) { if (active && generation === currentGeneration) status.textContent = getErrorMessage(error); }
    finally { if (active) refresh.disabled = false; }
  });
  refreshSaved();
  const openJournal = name => {
    if (!name) return; run(() => render(name)); section.scrollIntoView({ block: "nearest" });
  };
  addon.api.openManualJournal = openJournal;
  const release = () => {
    active = false; generation++;
    doc.defaultView.removeEventListener("unload", release);
    if (addon.api.openManualJournal === openJournal) delete addon.api.openManualJournal;
  };
  doc.defaultView.addEventListener("unload", release, { once: true });
  if (addon.api.pendingManualJournal) { openJournal(addon.api.pendingManualJournal); delete addon.api.pendingManualJournal; }
  return release;
}
