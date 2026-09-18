import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import { spElement,spGenealogyOptions,spSelectOptions } from "./ui.ts";
import { SPGenealogyClient } from "../core/genealogy.ts";
import { getPref } from "../upstream/utils/prefs.ts";
import { spMergeManualGenealogy,spReadManualGenealogy } from "../core/manualGenealogy.ts";
import { spBuildManualGenealogyControls } from "./manualGenealogy.ts";
import { version2 } from "../upstream/config.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spBuildGenealogyControls(view, container) {
  const doc = container.ownerDocument;
  const create = spElement.bind(null, doc);
  const panel = view.genealogyPanel = create("div", container); panel.className = "sp-genealogy";
  const row = create("div", panel); row.className = "sp-genealogy-row";
  const author = create("select", row); author.setAttribute("aria-label", getString("ui-authors-of-selected-items"));
  const search = create("input", row); search.placeholder = getString("ui-author-name"); search.setAttribute("aria-label", search.placeholder);
  const submit = create("button", row, getString("ui-search-wikidata")); submit.type = "button";
  const kind = create("select", row); kind.setAttribute("aria-label", getString("ui-relationship-type"));
  spSelectOptions(kind, spGenealogyOptions(), "doctoral");
  const manualView = create("button", row, getString("ui-local-genealogy")); manualView.type = "button";
  const external = create("a", row, "Academic Family Tree"); external.href = "https://academictree.org/";
  external.addEventListener("click", event => { event.preventDefault(); Zotero.launchURL(external.href); });
  const results = create("div", panel), details = create("details", panel);
  details.hidden = true;
  let generation = 0, controller, remoteGraph, localBase;
  const client = new SPGenealogyClient(async url => {
    const response = await Zotero.HTTP.request("GET", url, { responseType: "json", timeout: 25000,
      headers: { Accept: "application/json", "User-Agent": `Refolio/${version2} (https://github.com/NebulaRaven/zotero-refolio)` } });
    return response.response;
  }, ms => Zotero.Promise.delay(ms));
  const language = String(Zotero.locale || "en").split(/[-_]/)[0].toLowerCase();
  view.cancelGenealogy = () => { generation++; controller?.abort(); submit.disabled = false; };
  view.cleanups.push(view.cancelGenealogy);
  const request = async fn => {
    view.cancelGenealogy(); const own = generation; controller = new AbortController(); submit.disabled = true;
    view.status.textContent = getString("ui-loading-wikidata");
    const current = () => own === generation && view.active && view.mode === "genealogy";
    try { await fn(controller.signal, current); }
    catch (error) { if (current()) view.status.textContent = getString("ui-lookup-failed") + getErrorMessage(error); }
    finally { if (own === generation) submit.disabled = false; }
  };
  const link = (parent, text, url) => {
    const a = create("a", parent, text); a.href = url;
    a.addEventListener("click", event => { event.preventDefault(); Zotero.launchURL(url); }); return a;
  };
  const localData = () => getPref("genealogy.manualData");
  view.getGenealogyGraph = () => view.genealogyData = spMergeManualGenealogy(remoteGraph || localBase, localData(), kind.value);
  const showManual = async (relationshipKind = kind.value, center?) => {
    view.cancelGenealogy(); remoteGraph = undefined; kind.value = relationshipKind;
    results.replaceChildren(); details.replaceChildren(); details.hidden = true;
    const person = center && spReadManualGenealogy(localData()).people[center];
    localBase = person ? { center, sourceMode: "manual", nodes: { [center]: { ...person, type: "person", links: {},
      url: center.startsWith("Q") ? `https://www.wikidata.org/wiki/${center}` : "" } }, genealogyEdges: [] } : null;
    view.getGenealogyGraph();
    await view.refreshGraphView();
    if (center) view.showGenealogyPerson(center);
    if (view.active && view.mode === "genealogy") view.schedule(() => view.fitGraph(), 100);
  };
  const manualEditor = spBuildManualGenealogyControls(view, panel, showManual);
  view.showGenealogyPerson = (id, expanded = true) => {
    const graph = view.genealogyData, person = graph?.nodes[id]; if (!person) return;
    details.replaceChildren(); results.replaceChildren();
    create("summary", details, `${person.label} · ${getString("ui-relationships-and-sources")}`);
    details.open = expanded; details.hidden = false;
    const header = create("div", details); header.className = "sp-genealogy-row";
    create("strong", header, person.label); create("span", header, person.description);
    if (person.url) link(header, id, person.url);
    const expand = create("button", header, getString("ui-explore-this-person")); expand.type = "button";
    expand.addEventListener("click", () => {
      if (id.startsWith("Q") && graph.sourceMode !== "manual") load(id);
      else showManual(kind.value, id).catch(error => { view.status.textContent = getErrorMessage(error); });
    });
    const add = create("button", header, getString("ui-add-relationship")); add.type = "button";
    add.addEventListener("click", () => manualEditor.add(id));
    for (const edge of graph.genealogyEdges.filter(edge => edge.source === id || edge.target === id)) {
      const entry = create("div", details); entry.className = "sp-genealogy-row";
      create("span", entry, `${graph.nodes[edge.source].label} → ${graph.nodes[edge.target].label}`);
      if (edge.wikidata) create("span", entry, edge.referenced ? getString("ui-wikidata-references-recorded") : getString("ui-wikidata-no-references-recorded"));
      edge.statements.forEach((url, index) => link(entry, getString("ui-record") + (index ? ` ${index + 1}` : ""), url));
      edge.references.forEach((url, index) => link(entry, getString("ui-source") + ` ${index + 1}`, url));
      for (const record of edge.manualRecords || []) {
        create("span", entry, getString("ui-manual"));
        if (record.sourceURL) link(entry, getString("ui-manual-source"), record.sourceURL);
        if (record.note) create("span", entry, record.note).className = "sp-genealogy-note";
        const edit = create("button", entry, getString("ui-edit-manual-record")); edit.type = "button";
        edit.addEventListener("click", () => manualEditor.edit(record.id));
      }
    }
  };
  const load = id => request(async (signal, current) => {
    const graph = await client.graph(id, kind.value, language, signal);
    if (!current()) return;
    remoteGraph = graph; localBase = undefined;
    view.getGenealogyGraph();
    await view.refreshGraphView();
    if (current()) {
      view.showGenealogyPerson(id, false);
      view.schedule(() => { if (current()) view.fitGraph(); }, 600);
    }
  });
  const query = () => request(async (signal, current) => {
    if (!search.value.trim()) throw new Error(getString("ui-enter-an-author-name"));
    const matches = await client.search(search.value, language, signal);
    if (!current()) return;
    results.replaceChildren(); details.replaceChildren(); details.hidden = true;
    view.status.textContent = matches.length ? getString("ui-confirm-the-person-using-their-description-and-wikidata-record") : getString("ui-no-matching-entry-found");
    for (const match of matches) {
      const candidate = create("div", results); candidate.className = "sp-genealogy-candidate";
      const label = create("div", candidate); create("strong", label, match.label || match.id);
      create("div", label, match.description || getString("ui-no-description"));
      link(candidate, match.id, `https://www.wikidata.org/wiki/${match.id}`);
      const choose = create("button", candidate, getString("ui-use-this-person")); choose.type = "button";
      choose.addEventListener("click", () => load(match.id));
    }
  });
  submit.addEventListener("click", query);
  search.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); query(); } });
  manualView.addEventListener("click", () => showManual().catch(error => { view.status.textContent = getErrorMessage(error); }));
  kind.addEventListener("change", () => {
    if (remoteGraph) load(remoteGraph.center);
    else showManual().catch(error => { view.status.textContent = getErrorMessage(error); });
  });
  author.addEventListener("change", () => { if (author.value) search.value = author.value; });
  view.syncGenealogyAuthors = () => {
    const old = author.value; author.replaceChildren();
    const empty = create("option", author, getString("ui-selected-authors")); empty.value = "";
    const names = new Set();
    for (const item of ZoteroPane.getSelectedItems()) for (const person of item.getCreators?.() || []) {
      const name = [person.firstName, person.lastName].filter(Boolean).join(" "); if (name) names.add(name);
    }
    for (const name of names) { const option = create("option", author, name); option.value = name; }
    if (names.has(old)) author.value = old;
    if (!search.value && names.size) { search.value = [...names][0]; author.value = search.value; }
  };
  view.syncGenealogyAuthors();
  try { view.getGenealogyGraph(); }
  catch (error) { view.status.textContent = getErrorMessage(error); }
}
