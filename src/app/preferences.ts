import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import { config } from "../upstream/config.ts";
import { trackPreferenceWindow } from "../upstream/features/preferences/preferenceWindow.ts";
import { spElement } from "./ui.ts";
import { spFeatureDefinitions, spFeatureGroups } from "../core/features.ts";
import { spFeatureSettings, spGroupSettings, spSettingValue, spSettingVisible, type SettingDef } from "../core/settingsSchema.ts";
import { spSettingControl, spSettingLabel, type SettingControl } from "./settingControls.ts";
import { readDefaultPreferences } from "../upstream/features/preferences/defaultPreferences.ts";
import { getPref, setPref } from "../upstream/utils/prefs.ts";
import { spPublicationNames } from "../core/journals.ts";
import { spFilterGraph } from "../core/graph.ts";
import { spRenderManualRanks } from "./manualRanks.ts";
import { spOpenPrefsManager } from "../upstream/features/preferences/prefsManager.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export async function registerPrefs() {
  await Zotero.PreferencePanes.register({
    pluginID: config.addonID, id: "stylepersonal-preferences",
    src: rootURI + "chrome/content/preferences.xhtml", label: "Refolio",
    image: `chrome://${config.addonRef}/content/icons/refolio.svg`,
    stylesheets: [`chrome://${config.addonRef}/content/stylepersonal.css`]
  });
}

const spSettingValidators: Record<string, (value: unknown) => void> = {
  "publicationTagsColumn.aliases": value => { spPublicationNames("validation", String(value)); },
  "graphView.minYear": value => { spFilterGraph({ nodes: {} }, [], { minYear: value as string, maxYear: getPref("graphView.maxYear") }); },
  "graphView.maxYear": value => { spFilterGraph({ nodes: {} }, [], { minYear: getPref("graphView.minYear"), maxYear: value as string }); }
};

export async function registerPrefsScripts(prefWindow) {
  const doc = prefWindow.document;
  const container = doc.querySelector("#stylepersonal-settings");
  if (!container || container.dataset.loaded) return;
  trackPreferenceWindow(addon.data, prefWindow);
  container.dataset.loaded = "true";
  const mounted: Element[] = [], prefObservers = [], cleanups: Array<() => void> = [];
  const registration = addon.data.prefs;
  const originalRelease = registration?.release;
  let released = false;
  const release = () => {
    if (released) return; released = true;
    for (const id of prefObservers) Zotero.Prefs.unregisterObserver(id);
    prefWindow.removeEventListener("unload", release);
    for (const cleanup of cleanups) cleanup();
    for (const node of mounted) node.remove();
    delete container.dataset.loaded;
    originalRelease?.();
  };
  if (registration) registration.release = release;
  prefWindow.addEventListener("unload", release, { once: true });

  const create = spElement.bind(null, doc);
  const defaults = readDefaultPreferences();
  const fallbackOf = (key: string) => defaults.get(`${config.prefsPrefix}.${key}`);
  const current = (key: string) => getPref(key) ?? fallbackOf(key);
  const refreshers: Array<() => void> = [];
  const refresh = () => { for (const refresher of refreshers) refresher(); };
  const moreSections: HTMLDetailsElement[] = [];

  const section = (id: string, titleID?: string) => {
    const box = doc.createXULElement("vbox");
    box.id = `sp-group-${id}`; box.classList.add("main-section");
    container.append(box); mounted.push(box);
    if (!titleID) return box;
    const group = doc.createXULElement("groupbox"); box.append(group);
    const caption = doc.createXULElement("label"); group.append(caption);
    create("h2", caption, getString(titleID));
    return group;
  };
  // preferences.xhtml ships this section so Zotero puts its pane heading inside it; that keeps
  // every group a separate root for Zotero's settings search.
  const general = container.querySelector(".main-section") ?? section("general");
  const header = create("div", general); header.className = "sp-header"; mounted.push(header);
  const masterRow = create("label", header); masterRow.className = "sp-feature-head sp-master";
  const notice = create("div", header); notice.className = "sp-restart"; notice.hidden = true;
  create("span", notice, getString("ui-restart-required"));
  const restart = create("button", notice, getString("ui-restart-now")); restart.type = "button";
  restart.addEventListener("click", () => Zotero.Utilities.Internal.quit(true));
  const status = create("p", header); status.setAttribute("role", "status"); status.className = "sp-status";
  const showRestart = () => { notice.hidden = false; };

  const bind = (setting: SettingDef, control: SettingControl, afterSave?: () => void) => {
    const { key } = setting, fallback = fallbackOf(key);
    control.input.dataset.pref = key;
    control.write(current(key));
    prefObservers.push(Zotero.Prefs.registerObserver(`${config.prefsPrefix}.${key}`, () => {
      if (doc.activeElement === control.input) return;
      control.write(current(key)); refresh();
    }, true));
    control.onChange(async () => {
      try {
        const next = spSettingValue(setting, control.read(), fallback);
        spSettingValidators[key]?.(next);
        setPref(key, next);
        status.textContent = "";
        afterSave?.(); refresh();
        if (key.startsWith("graphView.")) await addon.api.refreshGraphView?.();
      } catch (error) { status.textContent = getErrorMessage(error); }
    });
  };

  const renderSettings = (parent: Element, settings: SettingDef[], controls: SettingControl[]) => {
    let more: HTMLDetailsElement | null = null, checks: Element | null = null, checksParent: Element | null = null;
    for (const setting of settings) {
      let target = parent;
      if (setting.tier === "more") {
        if (!more) {
          more = create("details", parent); more.className = "sp-more";
          create("summary", more, getString("ui-more-options")); moreSections.push(more);
        }
        target = more;
      }
      if (setting.kind === "note") {
        create("p", target, getString(setting.label)).className = "sp-help"; checks = null; continue;
      }
      let row: HTMLElement, control: SettingControl;
      if (setting.kind === "toggle") {
        if (!checks || checksParent !== target) { checks = create("div", target); checks.className = "sp-checks"; checksParent = target; }
        row = create("label", checks); row.className = "sp-check";
        control = spSettingControl(doc, row, setting);
        create("span", row, spSettingLabel(setting));
      } else {
        checks = null;
        row = create(setting.kind === "color" ? "div" : "label", target); row.className = "sp-field";
        create("span", row, spSettingLabel(setting));
        control = spSettingControl(doc, row, setting);
      }
      if (setting.visibleWhen) refreshers.push(() => { row.hidden = !spSettingVisible(setting, current); });
      bind(setting, control); controls.push(control);
    }
  };

  const masterSetting: SettingDef = { key: "enable", label: "ui-enable-refolio", kind: "toggle" };
  bind(masterSetting, spSettingControl(doc, masterRow, masterSetting), showRestart);
  create("span", masterRow, getString("ui-enable-refolio")).className = "sp-feature-name";

  const groups = new Map<string, Element>();
  for (const [id, labelID] of spFeatureGroups) {
    const group = section(id, labelID); groups.set(id, group);
    if (spGroupSettings[id]) {
      const box = create("div", group); box.className = "sp-group-settings";
      renderSettings(box, spGroupSettings[id], []);
    }
  }
  let releaseManualRanks = () => {};
  cleanups.push(() => releaseManualRanks());
  for (const [key, groupID, labelID] of spFeatureDefinitions) {
    const spec = spFeatureSettings[key] ?? { settings: [] };
    const block = create("div", groups.get(groupID)); block.className = "sp-feature"; block.dataset.feature = key;
    const head = create("label", block); head.className = "sp-feature-head";
    const switchSetting: SettingDef = { key: `function.${key}.enable`, label: labelID, kind: "toggle" };
    bind(switchSetting, spSettingControl(doc, head, switchSetting), showRestart);
    create("span", head, getString(labelID)).className = "sp-feature-name";
    create("span", head, getString(`${labelID}-desc`)).className = "sp-feature-desc";
    if (!spec.settings.length && !spec.extra) continue;
    const body = create("div", block); body.className = "sp-feature-body indented-pref";
    const controls: SettingControl[] = [];
    renderSettings(body, spec.settings, controls);
    let action: HTMLButtonElement | null = null;
    if (spec.extra === "prefsManager") {
      action = create("button", body, getString("ui-open-prefs-manager"));
      action.type = "button"; action.className = "sp-action";
      action.addEventListener("click", () => spOpenPrefsManager());
    }
    if (spec.extra === "manualRanks") releaseManualRanks = spRenderManualRanks(doc, body, status);
    refreshers.push(() => {
      const enabled = Boolean(current(switchSetting.key));
      if (enabled) delete body.dataset.disabled; else body.dataset.disabled = "true";
      for (const control of controls) control.setDisabled(!enabled);
      if (action) action.disabled = !enabled;
    });
  }
  // Zotero's search matches text inside closed <details> but cannot reveal it.
  const search = doc.getElementById?.("prefs-search");
  if (search) {
    let before: boolean[] | null = null;
    const onSearch = () => {
      const searching = Boolean(String(search.value ?? "").trim());
      if (searching && !before) {
        before = moreSections.map(details => Boolean(details.open));
        for (const details of moreSections) details.open = true;
      } else if (!searching && before) {
        moreSections.forEach((details, index) => { details.open = before[index]; });
        before = null;
      }
    };
    for (const type of ["input", "command"]) search.addEventListener(type, onSearch, true);
    cleanups.push(() => { for (const type of ["input", "command"]) search.removeEventListener(type, onSearch, true); });
    onSearch();
  }
  refresh();
}
