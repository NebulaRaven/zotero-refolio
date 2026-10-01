import { config } from "../upstream/config.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later

type MenuTarget = _ZoteroTypes.MenuManager.ValidTarget;
type RefolioMenuOptions<T extends MenuTarget> = Omit<_ZoteroTypes.MenuManager.MenuOptions<T>, "pluginID">;

// Zotero menus are global, but Refolio features start once per main window.
const registrations = new Map<string, { key: string; users: number }>();

/** Registers a menu with Zotero.MenuManager once per session; each caller releases its own share. */
export function spRegisterMenu<T extends MenuTarget>(options: RefolioMenuOptions<T>): () => void {
  const existing = registrations.get(options.menuID);
  if (existing) existing.users++;
  else {
    const key = Zotero.MenuManager.registerMenu({ ...options, pluginID: config.addonID } as _ZoteroTypes.MenuManager.MenuOptions);
    if (!key) throw new Error(`Unable to register menu ${options.menuID}`);
    registrations.set(options.menuID, { key, users: 1 });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const entry = registrations.get(options.menuID);
    if (!entry || --entry.users > 0) return;
    registrations.delete(options.menuID);
    Zotero.MenuManager.unregisterMenu(entry.key);
  };
}
