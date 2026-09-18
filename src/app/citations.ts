import { SPCitationClient,spCitationGraph,spGraphLabel,spNormalizeDOI } from "../core/graph.ts";
import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import { getPref } from "../upstream/utils/prefs.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export var spCitationAbort;
export var spCitationLoading;
export var spCitationClient;
export async function spLoadCitationGraph() {
  if (spCitationLoading) return spCitationLoading;
  const items = ZoteroPane.getSortedItems().filter(item => item.isRegularItem?.());
  const dois = [...new Set(items.map(item => spNormalizeDOI(item.getField("DOI"))).filter(Boolean))];
  if (!dois.length) { window.alert(getString("ui-citations-no-doi")); return false; }
  if (!window.confirm(getString("ui-citations-confirm", { args: { count: dois.length } }))) return false;
  spCitationAbort = new AbortController();
  spCitationClient ??= new SPCitationClient(async url => {
    const response = await Zotero.HTTP.request("GET", url, { responseType: "json", timeout: 20000 });
    return response.response;
  }, milliseconds => Zotero.Promise.delay(milliseconds));
  spCitationLoading = (async () => {
    const references = new Map();
    const failures = [];
    const progress = new ztoolkit.ProgressWindow(getString("ui-citation-graph"), { closeTime: -1 });
    progress.createLine({ text: "Crossref", type: "default", progress: 0 }).show();
    try {
      for (let i = 0; i < dois.length; i++) {
        if (spCitationAbort.signal.aborted || !addon.data.alive) return false;
        try { references.set(dois[i], await spCitationClient.get(dois[i], spCitationAbort.signal)); }
        catch (error) { failures.push({ doi: dois[i], message: getErrorMessage(error) }); }
        progress.changeLine({ text: `${i + 1}/${dois.length}`, progress: (i + 1) / dois.length * 100 });
      }
      addon.api.citationReferences = references;
      const graph = spCitationGraph(items, references);
      addon.api.citationReport = { requested: dois.length, available: references.size, failures, edges: graph.citationEdges };
      const label = id => spGraphLabel(items.find(item => item.id === id), getPref("graphView.labelField"), getPref("graphView.extraLabelKey"));
      const links = graph.citationEdges.slice(0, 40).map(edge => `${label(edge.source)} → ${label(edge.target)}`).join("\n");
      window.alert(getString("ui-citations-summary", { args: { available: references.size, total: dois.length, links: graph.citationEdges.length, failed: failures.length } }) + `\n\n${links}${graph.citationEdges.length > 40 ? "\n…" : ""}`);
      return true;
    } finally { progress.close(); }
  })();
  try { return await spCitationLoading; } finally { spCitationLoading = undefined; }
}
