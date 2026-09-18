import { restoreMissingDefaultPreferences } from "../upstream/features/preferences/defaultPreferences.ts";
import { initLocale } from "../upstream/utils/locale.ts";
import { registerPrefs,registerPrefsScripts } from "./preferences.ts";
import { FeatureRuntime } from "../upstream/app/lifecycle.ts";
import { spRegisterSettingsMenu } from "./manualRanks.ts";
import { getPref } from "../upstream/utils/prefs.ts";
import { createFinalFeatures,createImmediateFeatures,createStandardFeatures } from "../upstream/app/mainWindowFeatures.ts";
import { spCitationAbort } from "./citations.ts";
import { config } from "../upstream/config.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Lifecycle follows MuiseDestiny/zotero-addon-template (bootstrap branch).
export var windowRuntimes = new Map();
export async function onStartup() {
  await waitForZotero();
  await restoreMissingDefaultPreferences();
  initLocale();
  await registerPrefs();
  for (const win of Zotero.getMainWindows()) await onMainWindowLoad(win);
}
export async function onMainWindowLoad(win) {
  if (windowRuntimes.has(win) || !addon.data.alive) return;
  const runtime = new FeatureRuntime({ addon, window: win }, reportFeatureFailure);
  windowRuntimes.set(win, runtime);
  try {
    await runtime.start({ id: "settings-panel", start: () => spRegisterSettingsMenu() });
    if (getPref("enable") === false) return;
    await runtime.startAll(createImmediateFeatures());
    await runtime.startAll(createStandardFeatures());
    await runtime.startAll(createFinalFeatures(runtime.shutdownSignal));
  } catch (error) {
    windowRuntimes.delete(win);
    await runtime.stopAll();
    throw error;
  }
}
export async function onMainWindowUnload(win) {
  const runtime = windowRuntimes.get(win);
  if (!runtime) return;
  windowRuntimes.delete(win);
  await runtime.stopAll();
}
export async function onShutdown() {
  addon.data.alive = false;
  spCitationAbort?.abort();
  for (const runtime of [...windowRuntimes.values()].reverse()) await runtime.stopAll();
  windowRuntimes.clear();
  addon.data.prefs?.release?.();
  Zotero.PreferencePanes.unregister?.("stylepersonal-preferences");
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  delete Zotero[config.addonInstance];
}
export async function onPrefsEvent(type, data) {
  if (type === "load") await registerPrefsScripts(data.window);
}
export async function onCollectionSelect() {
  const tags = addon.api.tagsUI;
  if (!tags) return;
  tags.collectionItems = undefined;
  if (tags.nestedTagsContainer?.style.display !== "none") await tags.init(true);
}
export function reportFeatureFailure(failure) {
  (addon.api.featureFailures ??= []).push({ feature: failure.featureID, phase: failure.phase, message: String(failure.error) });
  Zotero.logError(failure.error);
}
export async function waitForZotero() {
  await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise]);
}
export var hooks_default = { onStartup, onShutdown, onMainWindowLoad, onMainWindowUnload, onPrefsEvent, onCollectionSelect };
