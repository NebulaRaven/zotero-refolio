import { SPCitationClient,spCitationGraph,spNormalizeDOI } from "../core/graph.ts";
import type { GraphData } from "../core/models.ts";
import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import { getPref,setPref } from "../upstream/utils/prefs.ts";
import { LocalStorage } from "../upstream/platform/persistence/storage.ts";
import { config } from "../upstream/config.ts";
import { getFirstSelectedLibraryID } from "../upstream/utils/zoteroSelection.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
interface CitationRequest {
  libraryID?: number;
  itemIDs?: number[];
  reason?: "added" | "empty";
  isCurrent?: () => boolean;
}
let storage: LocalStorage;
let referencesLoading: Promise<Map<string, string[]>>;
let client: SPCitationClient;
let controller: AbortController;
const queues: Record<"query" | "write", Promise<unknown>> = { query: Promise.resolve(), write: Promise.resolve() };
export const spCitationUpdatedItems = new Set<number>();

async function citationStorage() {
  storage ??= new LocalStorage(`${config.addonRef}-citations`);
  await storage.lock.promise;
  return storage;
}

export async function spGetCitationReferences(): Promise<Map<string, string[]>> {
  if (addon.api.citationReferences) return addon.api.citationReferences;
  referencesLoading ??= (async () => {
    const data = await citationStorage();
    const references = new Map<string, string[]>();
    for (const [doi, record] of Object.entries(data.cache.references || {}) as Array<[string, { references?: string[] }]>) {
      if (spNormalizeDOI(doi) && Array.isArray(record?.references)) references.set(doi, record.references);
    }
    return addon.api.citationReferences = references;
  })();
  return referencesLoading;
}

export async function spCitationLibraryItems(libraryID: number) {
  return (await Zotero.Items.getAll(libraryID, true, false)).filter(item => item.isRegularItem() && !item.deleted);
}

export async function spGetCitationGraph(items: Zotero.Item[], references?: Map<string, string[]>) {
  references ??= await spGetCitationReferences();
  const data = await citationStorage();
  const manual = new Map<string, string[]>();
  for (const item of items) {
    const targets = data.cache[`manual:${item.libraryID}`]?.[item.key];
    if (Array.isArray(targets)) manual.set(`${item.libraryID}/${item.key}`, targets);
  }
  return spCitationGraph(items, references, manual);
}

export function spConfirmCitationUpdate(reason: "added" | "empty", count: number, library: string) {
  const key = reason === "added" ? "citations.onAdd" : "citations.onEmpty";
  const policy = getPref(key);
  if (policy === "update" || policy === "skip") return policy === "update";
  const remember = { value: false };
  const prompt = Services.prompt;
  const result = prompt.confirmEx(Zotero.getMainWindow() as unknown as mozIDOMWindowProxy, "Refolio",
    getString(`ui-citations-${reason}-confirm`, { args: { count, library } }),
    prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING + prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_IS_STRING,
    getString("ui-update-relations"), getString("ui-skip"), null, getString("ui-remember-choice"), remember);
  if (remember.value) setPref(key, result === 0 ? "update" : "skip");
  return result === 0;
}

function enqueue<T>(operation: () => Promise<T>, kind: "query" | "write" = "write"): Promise<T> {
  const pending = queues[kind].then(operation);
  queues[kind] = pending.catch(() => {});
  return pending;
}

export async function spSaveCitationRelations(items: Zotero.Item[], graph: GraphData) {
  const byID = new Map(items.map(item => [item.id, item]));
  const changed = new Set<Zotero.Item>();
  const pairs = new Set<string>();
  await Zotero.DB.executeTransaction(async () => {
    for (const edge of graph.citationEdges || []) {
      const source = byID.get(Number(edge.source)), target = byID.get(Number(edge.target));
      if (!source || !target || source === target || source.libraryID !== target.libraryID) continue;
      if (!source.isEditable() || !target.isEditable()) continue;
      let added = false;
      if (!source.relatedItems.includes(target.key)) { source.addRelatedItem(target); changed.add(source); added = true; }
      if (!target.relatedItems.includes(source.key)) { target.addRelatedItem(source); changed.add(target); added = true; }
      if (added) pairs.add([source.id, target.id].sort((a, b) => a - b).join(":"));
    }
    for (const item of changed) await item.save({ skipDateModifiedUpdate: true });
  });
  return pairs.size;
}

export function spFetchCitationRelations(options: CitationRequest = {}) {
  const libraryID = options.libraryID ?? getFirstSelectedLibraryID();
  return enqueue(async () => {
    if (!addon.data.alive || options.isCurrent?.() === false) return false;
    if (options.reason && getPref(options.reason === "added" ? "citations.onAdd" : "citations.onEmpty") === "skip") return false;
    const library = Zotero.Libraries.get(libraryID);
    if (!library || !library.editable) throw new Error("ui-error-citations-read-only");
    const all = await spCitationLibraryItems(libraryID);
    const selected = options.itemIDs ? new Set(options.itemIDs) : undefined;
    const items = all.filter(item => !selected || selected.has(item.id) && !spCitationUpdatedItems.has(item.id));
    const dois = [...new Set(items.map(item => spNormalizeDOI(item.getField("DOI"))).filter(Boolean))];
    if (!dois.length) {
      if (!options.reason) window.alert(getString("ui-citations-no-doi"));
      return false;
    }
    if (options.reason === "empty" && (await spGetCitationGraph(all)).citationEdges.length) return false;
    if (!addon.data.alive || options.isCurrent?.() === false) return false;
    if (options.reason && !spConfirmCitationUpdate(options.reason, dois.length, library.name)) return false;
    controller ??= new AbortController();
    const data = await citationStorage();
    const references = new Map(await spGetCitationReferences());
    client ??= new SPCitationClient(async url => {
      const response = await Zotero.HTTP.request("GET", url, { responseType: "json", timeout: 20000 });
      return response.response;
    }, milliseconds => Zotero.Promise.delay(milliseconds));
    const failures: Array<{ doi: string; message: string }> = [];
    const fetched = new Map<string, { at: number; references: string[] }>();
    const progress = new ztoolkit.ProgressWindow(getString("ui-fetch-citations"), { closeTime: -1 });
    progress.createLine({ text: "Crossref", type: "default", progress: 0 }).show();
    try {
      for (let i = 0; i < dois.length; i++) {
        if (controller.signal.aborted || !addon.data.alive) return false;
        const doi = dois[i], cached = data.cache.references?.[doi];
        if (cached && !client.cache.has(doi)) client.cache.set(doi, cached);
        try {
          const refs = await client.get(doi, controller.signal);
          references.set(doi, refs);
          fetched.set(doi, client.cache.get(doi));
        } catch (error) { failures.push({ doi, message: getErrorMessage(error) }); }
        progress.changeLine({ text: `${i + 1}/${dois.length}`, progress: (i + 1) / dois.length * 100 });
      }
      const result = await enqueue(async () => {
        const current = await spCitationLibraryItems(libraryID);
        const graph = await spGetCitationGraph(current, references);
        if (controller.signal.aborted || !addon.data.alive) return;
        const added = await spSaveCitationRelations(current, graph);
        for (const [doi, record] of fetched) await data.set({ key: "references" }, doi, record);
        await data.flush();
        addon.api.citationReferences = references;
        for (const item of items) if (fetched.has(spNormalizeDOI(item.getField("DOI")))) spCitationUpdatedItems.add(item.id);
        return { graph, added };
      });
      if (!result) return false;
      const { graph, added } = result;
      addon.api.citationReport = { requested: dois.length, available: fetched.size, failures, edges: graph.citationEdges };
      if (!addon.data.alive) return false;
      await addon.api.refreshGraphView?.();
      new ztoolkit.ProgressWindow(getString("ui-mode-citations"), { closeTime: 8000 }).createLine({
        text: getString("ui-citations-summary", { args: { available: fetched.size, total: dois.length, links: graph.citationEdges.length, added, failed: failures.length } }),
        type: failures.length ? "default" : "success"
      }).show();
      return true;
    } finally { progress.close(); }
  }, "query");
}

export function spAddManualCitation(sourceID: number, targetID: number) {
  return enqueue(async () => {
    if (!addon.data.alive) return false;
    const source = await Zotero.Items.getAsync(sourceID), target = await Zotero.Items.getAsync(targetID);
    if (!source || !target || source.deleted || target.deleted || !source.isRegularItem() || !target.isRegularItem()
      || source.id === target.id || source.libraryID !== target.libraryID) throw new Error("ui-error-citation-select-two");
    if (!source.isEditable() || !target.isEditable()) throw new Error("ui-error-citations-read-only");
    const data = await citationStorage();
    if (!addon.data.alive) return false;
    await spSaveCitationRelations([source, target], { nodes: {}, citationEdges: [{ source: source.id, target: target.id }] });
    const key = `manual:${source.libraryID}`;
    const targets = [...new Set<string>([...(data.cache[key]?.[source.key] || []), target.key])];
    await data.set({ key }, source.key, targets);
    await data.flush();
    if (addon.data.alive) await addon.api.refreshGraphView?.();
    return addon.data.alive;
  });
}

export async function spShutdownCitations() {
  controller?.abort();
  await queues.query;
  await queues.write;
  await storage?.dispose();
  spCitationUpdatedItems.clear();
}
