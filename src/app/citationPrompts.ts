import { spCitationLibraryItems,spFetchCitationRelations,spGetCitationGraph } from "./citations.ts";
import { spNormalizeDOI } from "../core/graph.ts";
import { getPref } from "../upstream/utils/prefs.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
const promptingLibraries = new Set<number>();

export async function spPromptEmptyCitationGraph(libraryID: number, isCurrent: () => boolean) {
  const library = Zotero.Libraries.get(libraryID);
  if (promptingLibraries.has(libraryID) || !isCurrent() || !library || !library.editable || getPref("citations.onEmpty") === "skip") return;
  const items = await spCitationLibraryItems(libraryID);
  if (!items.some(item => spNormalizeDOI(item.getField("DOI"))) || !isCurrent()) return;
  if ((await spGetCitationGraph(items)).citationEdges.length || !isCurrent() || promptingLibraries.has(libraryID)) return;
  promptingLibraries.add(libraryID);
  try { await spFetchCitationRelations({ libraryID, reason: "empty", isCurrent }); }
  finally { promptingLibraries.delete(libraryID); }
}

export function spRegisterCitationUpdates() {
  const pending = new Map<number, Set<number>>();
  const awaitingDOI = new Set<number>();
  const win = Zotero.getMainWindow();
  let timer: number | undefined, active = true, flushing = false;
  const enabled = () => active && addon.data.alive && getPref("enable") !== false && getPref("function.citationGraph.enable") !== false;
  const flush = async () => {
    timer = undefined;
    if (flushing || !enabled()) return;
    flushing = true;
    const batches = [...pending]; pending.clear();
    try {
      for (const [libraryID, itemIDs] of batches) {
        if (!enabled()) return;
        try { await spFetchCitationRelations({ libraryID, itemIDs: [...itemIDs], reason: "added", isCurrent: enabled }); }
        catch (error) { Zotero.logError(error); }
      }
    } finally {
      flushing = false;
      if (pending.size && enabled()) {
        if (timer !== undefined) win.clearTimeout(timer);
        timer = win.setTimeout(flush, 1500);
      }
    }
  };
  const observer = Zotero.Notifier.registerObserver({
    notify(event, _type, ids) {
      if (!enabled() || !["add", "modify", "delete"].includes(event)) return;
      for (const id of ids.map(Number)) {
        if (event === "delete") {
          awaitingDOI.delete(id); for (const batch of pending.values()) batch.delete(id); continue;
        }
        if (event === "modify" && !awaitingDOI.has(id)) continue;
        const item = Zotero.Items.get(id);
        if (!item?.isRegularItem() || item.deleted || !item.isEditable()) continue;
        if (!spNormalizeDOI(item.getField("DOI"))) { awaitingDOI.add(id); continue; }
        awaitingDOI.delete(id);
        if (!pending.has(item.libraryID)) pending.set(item.libraryID, new Set());
        pending.get(item.libraryID).add(id);
      }
      if (pending.size) {
        if (timer !== undefined) win.clearTimeout(timer);
        timer = win.setTimeout(flush, 1500);
      }
    }
  }, ["item"], "refolio-citation-updates");
  return () => {
    active = false;
    if (timer !== undefined) win.clearTimeout(timer);
    Zotero.Notifier.unregisterObserver(observer);
    pending.clear(); awaitingDOI.clear(); promptingLibraries.clear();
  };
}
