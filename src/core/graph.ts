import { isRecord } from "./models.ts";
import type { GraphItem,GraphData,GraphNode,GraphEdge,GraphFilter,NodeID,Delay,JsonRequest } from "./models.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spExtraValue(extra: unknown, field: string): string {
  for (const line of String(extra || "").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon >= 0 && line.slice(0, colon).trim().toLowerCase() === field.toLowerCase()) {
      return line.slice(colon + 1).trim();
    }
  }
  return "";
}

export function spGraphLabel(item: GraphItem, field = "authorYear", extraField = "Graph Label") {
  const read = (key: string) => { try { return String(item.getField(key) || ""); } catch { return ""; } };
  let text = field === "extra" ? spExtraValue(read("extra"), extraField)
    : field === "title" || field === "shortTitle" ? read(field) : "";
  if (!text && field !== "authorYear") text = read("shortTitle") || read("title");
  if (!text) {
    const author = item.getCreators?.()[0];
    const name = author?.lastName || author?.name || "";
    text = name ? [name, read("year")].filter(Boolean).join(", ") : read("title");
  }
  const chars = Array.from(text || item.getDisplayTitle?.() || item.key || "Untitled");
  return chars.length > 80 ? chars.slice(0, 60).join("") + " … " + chars.slice(-16).join("") : chars.join("");
}

export function spNormalizeDOI(value: unknown): string {
  const text = String(value || "").trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return /^10\.\d{4,9}\/\S+$/i.test(text) ? text.toLowerCase() : "";
}

export function spCitationGraph(items: GraphItem[], references: ReadonlyMap<string, string[]>, manual: ReadonlyMap<string, string[]> = new Map()): GraphData {
  const nodes: Record<string, GraphNode> = {};
  const byDOI = new Map<string, GraphItem[]>();
  const byKey = new Map<string, GraphItem>();
  const edges: GraphEdge[] = [];
  for (const item of items) {
    nodes[item.id] = { links: {}, type: "item" };
    const doi = spNormalizeDOI(item.getField("DOI"));
    if (doi) {
      const matches = byDOI.get(doi) || [];
      matches.push(item); byDOI.set(doi, matches);
    }
    if (item.key) byKey.set(`${item.libraryID}/${item.key}`, item);
  }
  for (const item of items) {
    const doi = spNormalizeDOI(item.getField("DOI"));
    const targets = new Set((references.get(doi) || []).map(spNormalizeDOI).filter(Boolean));
    const link = (target: GraphItem | undefined) => {
      if (!target || target.id === item.id || target.libraryID !== item.libraryID || nodes[item.id].links[target.id]) return;
      nodes[item.id].links[target.id] = true;
      edges.push({ source: item.id, target: target.id });
    };
    for (const target of targets) for (const match of byDOI.get(target) || []) link(match);
    for (const key of manual.get(`${item.libraryID}/${item.key}`) || []) {
      link(byKey.get(`${item.libraryID}/${key}`));
    }
  }
  return { nodes, citationEdges: edges, citationDataAvailable: edges.length > 0 || items.some(item => references.has(spNormalizeDOI(item.getField("DOI")))) };
}

export function spSharedGraph<T extends Pick<GraphItem, "id">>(items: T[], valuesFor: (item: T) => string[]): GraphData {
  const nodes: Record<string, GraphNode> = Object.fromEntries(items.map(item => [item.id, { links: {}, type: "item" }]));
  const groups = new Map<string, number[]>();
  for (const item of items) for (const value of new Set(valuesFor(item).filter(Boolean))) {
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value)!.push(item.id);
  }
  for (const ids of groups.values()) for (let i = 0; i < ids.length; i++) {
    for (const target of ids.slice(i + 1)) nodes[ids[i]].links[target] = true;
  }
  return { nodes };
}

// Neighbourhood distance ignores edge direction; the displayed edges retain it.
export function spFilterGraph(graph: GraphData, seeds: NodeID[], { scope = "selected", depth = 1, minYear = "", maxYear = "", hideIsolated = false }: GraphFilter = {}): GraphData {
  const source = graph.nodes || {};
  const yearBound = (value: string | number | null | undefined) => value === "" || value == null ? null : Number(value);
  const min = yearBound(minYear), max = yearBound(maxYear);
  if ((min !== null && !Number.isInteger(min)) || (max !== null && !Number.isInteger(max)) || (min !== null && max !== null && min > max)) {
    throw new Error("ui-error-invalid-year-range");
  }
  const eligible = new Set(Object.keys(source).filter(id => {
    const year = source[id].year;
    if (min === null && max === null) return true;
    return typeof year === "number" && Number.isInteger(year) && (min === null || year >= min) && (max === null || year <= max);
  }));
  const adjacent = new Map([...eligible].map(id => [id, new Set<string>()]));
  for (const id of eligible) for (const other of Object.keys(source[id].links || {})) {
    if (eligible.has(other) && id !== other) { adjacent.get(id)!.add(other); adjacent.get(other)!.add(id); }
  }
  const selected = new Set(seeds.map(String).filter(id => eligible.has(id)));
  const visible = scope === "all" ? new Set(eligible) : new Set(selected);
  if (scope !== "all") {
    let frontier = [...selected];
    for (let level = 0; level < Math.max(1, Math.min(2, Number(depth) || 1)); level++) {
      const next = [];
      for (const id of frontier) for (const other of adjacent.get(id) || []) {
        if (!visible.has(other)) { visible.add(other); next.push(other); }
      }
      frontier = next;
    }
  }
  if (hideIsolated) for (const id of [...visible]) {
    if (![...adjacent.get(id)!].some(other => visible.has(other))) visible.delete(id);
  }
  const nodes = Object.fromEntries([...visible].map(id => [id, {
    ...source[id], links: Object.fromEntries(Object.entries(source[id].links || {}).filter(([other]) => visible.has(other) && other !== id))
  }]));
  return { ...graph, nodes, citationEdges: graph.citationEdges?.filter(edge => visible.has(String(edge.source)) && visible.has(String(edge.target))) };
}

export class SPCitationClient {
    declare request: JsonRequest;
    declare delay: Delay;
    declare now: () => number;
    declare cache: Map<string, { at: number; references: string[] }>;
    declare inFlight: Map<string, Promise<string[]>>;
    declare queue: Promise<unknown>;
    declare lastStart: number;
  constructor(request: JsonRequest, delay: Delay, now = Date.now) {
    this.request = request; this.delay = delay; this.now = now;
    this.cache = new Map(); this.inFlight = new Map(); this.queue = Promise.resolve(); this.lastStart = -Infinity;
  }
  get(doi: string, signal?: AbortSignal): Promise<string[]> {
    doi = spNormalizeDOI(doi);
    if (!doi) return Promise.reject(new Error("ui-error-invalid-doi"));
    const cached = this.cache.get(doi);
    if (cached && this.now() - cached.at < 86400000) return Promise.resolve(cached.references);
    if (this.inFlight.has(doi)) return this.inFlight.get(doi)!;
    const pending = this.queue.catch(() => {}).then(async () => {
      if (signal?.aborted) throw new Error("ui-error-citation-cancelled");
      await this.delay(Math.max(0, 1000 - (this.now() - this.lastStart)));
      if (signal?.aborted) throw new Error("ui-error-citation-cancelled");
      this.lastStart = this.now();
      const response = await this.request(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      const message = isRecord(response) && isRecord(response.message) ? response.message : undefined;
      if (!isRecord(response) || response.status !== "ok" || !message || !Array.isArray(message.reference)) {
        throw new Error("ui-error-no-crossref-references");
      }
      const references = message.reference.map((ref: unknown) => spNormalizeDOI(isRecord(ref) ? ref.DOI : undefined)).filter(Boolean);
      if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(doi, { at: this.now(), references });
      return references;
    });
    this.queue = pending.catch(() => {});
    this.inFlight.set(doi, pending);
    pending.then(() => this.inFlight.delete(doi), () => this.inFlight.delete(doi));
    return pending;
  }
}
