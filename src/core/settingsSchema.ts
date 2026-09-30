// SPDX-License-Identifier: AGPL-3.0-or-later
export type SettingKind = "toggle" | "choice" | "text" | "secret" | "number" | "color" | "list" | "code" | "shortcut" | "note";
export type SettingChoice = readonly [value: string, label?: string];
export interface SettingDef {
  key: string;
  label: string;
  labelArgs?: Readonly<Record<string, string>>;
  kind: SettingKind;
  tier?: "main" | "more";
  choices?: ReadonlyArray<SettingChoice>;
  min?: number;
  max?: number;
  step?: number;
  allowAuto?: boolean;
  visibleWhen?: { readonly key: string; readonly equals: string };
  // Read once at startup, so saving it should prompt a restart.
  restart?: boolean;
}
export interface FeatureSettings {
  settings: SettingDef[];
  extra?: "manualRanks" | "prefsManager";
}

const moreSetting = (setting: SettingDef): SettingDef => ({ ...setting, tier: "more" });
const prefSetting = (key: string, kind: SettingKind, options: Partial<SettingDef> = {}): SettingDef =>
  ({ key, kind, label: `pref-${key.replaceAll(".", "-")}`, ...options });
const opacity = { min: 0, max: 1 };
const spacing = { min: 0 };

export const spTimeZoneChoices: SettingChoice[] = [["system", "ui-system-time-zone"],
  ...[-12, -11, -10, -9.5, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75,
    6, 6.5, 7, 8, 8.75, 9, 9.5, 10, 10.5, 11, 12, 12.75, 13, 14]
    .map(hours => [String(hours), `UTC${hours >= 0 ? "+" : ""}${hours}`] as const)];
const dateTypes: SettingChoice[] = [["absolute"], ["relative"]];
const citationPolicies: SettingChoice[] = [["ask", "ui-always-ask"], ["update", "ui-update-automatically"], ["skip", "ui-do-not-update"]];
const easyscholar = { key: "publicationTagsColumn.source", equals: "easyscholar" };
const garden = { key: "publicationTagsColumn.source", equals: "garden" };

export const spFeatureSettings: Readonly<Record<string, FeatureSettings>> = {
  publicationTagsColumn: { settings: [
    { key: "publicationTagsColumn.source", label: "ui-provider", kind: "choice", choices: [["easyscholar"], ["garden"]] },
    { key: "easyscholar.secretKey", label: "ui-api-key", labelArgs: { provider: "EasyScholar" }, kind: "secret", visibleWhen: easyscholar },
    { key: "publicationTagsColumn.fields", label: "ui-easyscholar-fields", kind: "list", visibleWhen: easyscholar },
    { key: "garden.apiKey", label: "ui-api-key", labelArgs: { provider: "Garden" }, kind: "secret", visibleWhen: garden },
    { key: "publicationTagsColumn.gardenFields", label: "ui-garden-fields", kind: "list", visibleWhen: garden },
    { key: "publicationTagsColumn.automaticUpdates", label: "ui-fetch-missing-journal-metrics-automatically", kind: "toggle" },
    moreSetting(prefSetting("publicationTagsColumn.rankColors", "list")),
    moreSetting(prefSetting("publicationTagsColumn.defaultColor", "color")),
    moreSetting(prefSetting("publicationTagsColumn.textColor", "color", { allowAuto: true })),
    moreSetting(prefSetting("publicationTagsColumn.sortBy", "text")),
    moreSetting(prefSetting("publicationTagsColumn.map", "list")),
    moreSetting(prefSetting("publicationTagsColumn.margin", "number", spacing)),
    moreSetting(prefSetting("publicationTagsColumn.padding", "number", spacing)),
    moreSetting(prefSetting("publicationTagsColumn.opacity", "number", opacity)),
    moreSetting({ key: "", label: "ui-chinese-english-journal-names-for-pku-core-cssci-and", kind: "note" }),
    moreSetting({ key: "publicationTagsColumn.aliases", label: "ui-custom-journal-aliases-json", kind: "code" })
  ] },
  IFColumn: { settings: [
    prefSetting("IFColumn.field", "choice", { choices: [["sciif"], ["sciif5"], ["综合影响因子"], ["复合影响因子"]] }),
    prefSetting("IFColumn.color", "color"),
    prefSetting("IFColumn.max", "number", { min: 1, step: 1 }),
    moreSetting(prefSetting("IFColumn.text", "toggle")),
    moreSetting(prefSetting("IFColumn.progress", "toggle")),
    moreSetting(prefSetting("IFColumn.progressType", "choice", { choices: [["1"], ["2"]] })),
    moreSetting(prefSetting("IFColumn.opacity", "number", opacity))
  ] },
  manualJournalRanks: { settings: [], extra: "manualRanks" },
  graphView: { settings: [
    { key: "graphView.modes.citations", label: "ui-show-graph-view", labelArgs: { view: "ui-mode-citations" }, kind: "toggle" },
    { key: "graphView.modes.note", label: "ui-show-graph-view", labelArgs: { view: "ui-mode-notes" }, kind: "toggle" },
    { key: "graphView.modes.author", label: "ui-show-graph-view", labelArgs: { view: "ui-mode-authors" }, kind: "toggle" },
    { key: "graphView.modes.tag", label: "ui-show-graph-view", labelArgs: { view: "ui-mode-tags" }, kind: "toggle" },
    { key: "graphView.modes.genealogy", label: "ui-show-graph-view", labelArgs: { view: "ui-mode-genealogy" }, kind: "toggle" },
    { key: "graphView.labelField", label: "ui-node-label", kind: "choice",
      choices: [["authorYear", "ui-author-year"], ["title", "ui-title"], ["shortTitle", "ui-short-title"], ["extra", "ui-extra-field"]] },
    { key: "graphView.extraLabelKey", label: "ui-extra-field-name", kind: "text", visibleWhen: { key: "graphView.labelField", equals: "extra" } },
    moreSetting({ key: "graphView.scope", label: "ui-graph-scope", kind: "choice", choices: [["selected", "ui-selected-items"], ["all", "ui-current-view"]] }),
    moreSetting({ key: "graphView.depth", label: "ui-neighbourhood-depth", kind: "choice", choices: [["1", "1"], ["2", "2"]] }),
    moreSetting({ key: "graphView.hideIsolated", label: "ui-hide-isolated-nodes", kind: "toggle" }),
    moreSetting({ key: "graphView.minYear", label: "ui-from-year", kind: "number", min: 0, max: 9999, step: 1 }),
    moreSetting({ key: "graphView.maxYear", label: "ui-to-year", kind: "number", min: 0, max: 9999, step: 1 })
  ] },
  citationGraph: { settings: [
    { key: "citations.onAdd", label: "ui-citations-on-add", kind: "choice", choices: citationPolicies },
    { key: "citations.onEmpty", label: "ui-citations-on-empty", kind: "choice", choices: citationPolicies }
  ] },
  titleColumn: { settings: [
    prefSetting("titleColumn.color", "color"),
    prefSetting("titleColumn.opacity", "number", opacity),
    moreSetting(prefSetting("titleColumn.tags", "toggle")),
    moreSetting(prefSetting("titleColumn.emojiTags", "toggle")),
    moreSetting(prefSetting("titleColumn.translate", "toggle")),
    moreSetting(prefSetting("titleTranslate.shortcut", "shortcut", { restart: true }))
  ] },
  tagsColumn: { settings: [
    moreSetting(prefSetting("tagsColumn.align", "choice", { choices: [["left"], ["right"]] })),
    moreSetting(prefSetting("tagsColumn.margin", "number", spacing))
  ] },
  textTagsColumn: { settings: [
    prefSetting("textTagsColumn.backgroundColor", "color"),
    prefSetting("textTagsColumn.textColor", "color", { allowAuto: true }),
    moreSetting(prefSetting("textTagsColumn.match", "text")),
    moreSetting(prefSetting("textTagsColumn.opacity", "number", opacity)),
    moreSetting(prefSetting("textTagsColumn.margin", "number", spacing)),
    moreSetting(prefSetting("textTagsColumn.padding", "number", spacing))
  ] },
  publicationColumn: { settings: [prefSetting("publicationColumn.fields", "list")] },
  creatorColumn: { settings: [
    prefSetting("creatorColumn.format", "text"),
    prefSetting("creatorColumn.slices", "text"),
    prefSetting("creatorColumn.join", "text")
  ] },
  dateAddedColumn: { settings: [
    prefSetting("dateAddedColumn.dateType", "choice", { choices: dateTypes }),
    { key: "dateAddedColumn.deltaHour", label: "ui-date-added-time-zone", kind: "choice", choices: spTimeZoneChoices },
    prefSetting("dateModifiedColumn.dateType", "choice", { choices: dateTypes }),
    { key: "dateModifiedColumn.deltaHour", label: "ui-date-modified-time-zone", kind: "choice", choices: spTimeZoneChoices },
    moreSetting(prefSetting("dateAddedColumn.format", "text")),
    moreSetting(prefSetting("dateModifiedColumn.format", "text"))
  ] },
  ratingColumn: { settings: [
    prefSetting("ratingColumn.storage", "choice", { choices: [["extra"], ["tag"]] }),
    prefSetting("ratingColumn.selectedStar", "text"),
    prefSetting("ratingColumn.unselectedStar", "text"),
    moreSetting(prefSetting("ratingColumn.padding", "number", spacing))
  ] },
  remarkColumn: { settings: [moreSetting(prefSetting("remarkColumn.prompt", "code"))] },
  annotationColumn: { settings: [moreSetting(prefSetting("annotationColumn.opacity", "number", opacity))] },
  readTimeColumn: { settings: [
    prefSetting("readTime.color", "color"),
    moreSetting(prefSetting("readTime.max", "number", { min: 1, step: 1 })),
    moreSetting(prefSetting("readTime.opacity", "number", opacity)),
    moreSetting(prefSetting("readTime.progress", "toggle")),
    moreSetting(prefSetting("readTime.text", "toggle"))
  ] },
  addTags: { settings: [prefSetting("addTags.shortcut", "shortcut", { restart: true })] },
  relatedItems: { settings: [prefSetting("relatedItems.link.shortcut", "shortcut", { restart: true })] },
  showAnnotationColorName: { settings: [prefSetting("annotationColorNameDirection", "choice", { choices: [["horizontal"], ["vertical"]] })] },
  tldr: { settings: [prefSetting("tldr.autoTranslate", "toggle")] },
  toogleSidebar: { settings: [
    prefSetting("toogleSidebar.left.shortcut", "shortcut", { restart: true }),
    prefSetting("toogleSidebar.right.shortcut", "shortcut", { restart: true })
  ] },
  prefsManager: { settings: [], extra: "prefsManager" },
  styleEditor: { settings: [prefSetting("styleEditor.value", "code")] }
};

// Rendered under a group heading. They do not belong to one feature, so no switch greys them out.
export const spGroupSettings: Readonly<Record<string, SettingDef[]>> = {
  graph: [{ key: "", label: "ui-citation-arrows-point-to-the-cited-paper-select-an", kind: "note" }],
  reader: [
    { key: "readingProgress.recordingEnabled", label: "ui-record-reading-time", kind: "toggle", restart: true },
    prefSetting("recordInterval", "number", { min: 1, step: 1, restart: true })
  ]
};

// Edited by other Refolio interfaces; showing them as raw text would only invite broken JSON.
export const spStatePreferences: ReadonlySet<string> = new Set([
  "graphView.mode", "graphView.height", "collectionItem.sortBy",
  "annotationColors", "annotationColorsGroups", "publicationTagsColumn.manualRanks"
]);

export function spSettingValue(setting: Pick<SettingDef, "kind" | "min" | "max">, raw: unknown, fallback: unknown): string | number | boolean {
  if (setting.kind === "toggle") return Boolean(raw);
  const text = String(raw ?? "");
  if (setting.kind !== "number") return text;
  const trimmed = text.trim();
  // Only settings whose default is empty (the graph years) may be cleared.
  if (!trimmed && fallback === "") return "";
  const value = Number(trimmed);
  const outside = (setting.min !== undefined && value < setting.min) || (setting.max !== undefined && value > setting.max);
  if (!trimmed || !Number.isFinite(value) || outside) throw new Error("ui-error-invalid-number");
  return typeof fallback === "number" ? value : trimmed;
}

export function spColorHex(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${[...text.slice(1)].map(digit => digit + digit).join("")}`;
  return "#000000";
}

export function spSettingVisible(setting: Pick<SettingDef, "visibleWhen">, read: (key: string) => unknown): boolean {
  return !setting.visibleWhen || String(read(setting.visibleWhen.key) ?? "") === setting.visibleWhen.equals;
}
