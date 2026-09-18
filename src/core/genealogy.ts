import { isRecord } from "./models.ts";
import type { GenealogyKind,GraphData,GraphNode,GenealogyEdge,WikidataEntity,WikidataRelation,WikidataResponse,WikidataPerson,Delay,JsonRequest } from "./models.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spWikidataID(value: unknown): string {
  const id = String(value || "").replace(/^https?:\/\/www\.wikidata\.org\/entity\//, "");
  if (!/^Q[1-9]\d*$/.test(id)) throw new Error("ui-error-invalid-wikidata-id");
  return id;
}

export function spGenealogyRelations(entity: WikidataEntity, kind: GenealogyKind = "doctoral"): WikidataRelation[] {
  const props: Array<[string, boolean]> = kind === "doctoral" ? [["P184", true], ["P185", false]] : [["P1066", true], ["P802", false]];
  const result: WikidataRelation[] = [];
  for (const [property, personIsStudent] of props) {
    const claims = (entity.claims?.[property] || []).filter(claim => claim.rank !== "deprecated");
    const preferred = claims.some(claim => claim.rank === "preferred");
    for (const claim of claims) {
      if (preferred && claim.rank !== "preferred") continue;
      const target = claim.mainsnak?.datavalue?.value?.id;
      if (!target || !/^Q[1-9]\d*$/.test(target) || target === entity.id) continue;
      const references = [];
      for (const ref of claim.references || []) {
        for (const snak of ref.snaks?.P854 || []) {
          const url = snak.datavalue?.value;
          if (typeof url === "string" && /^https?:\/\//i.test(url)) references.push(url);
        }
        for (const snak of ref.snaks?.P248 || []) {
          const id = snak.datavalue?.value?.id;
          if (/^Q[1-9]\d*$/.test(id || "")) references.push(`https://www.wikidata.org/wiki/${id}`);
        }
      }
      result.push({ source: personIsStudent ? target : entity.id, target: personIsStudent ? entity.id : target,
        kind, property, owner: entity.id, referenced: Boolean(claim.references?.length),
        references: [...new Set(references)], statement: `https://www.wikidata.org/wiki/${entity.id}#${property}` });
    }
  }
  return result;
}

export function spGenealogyGraph(entities: Record<string, WikidataEntity>, center: string, kind: GenealogyKind = "doctoral", language = "en"): GraphData {
  const relations = new Map<string, GenealogyEdge>();
  for (const entity of Object.values(entities)) for (const edge of spGenealogyRelations(entity, kind)) {
    if (edge.source !== center && edge.target !== center) continue;
    if (!entities[edge.source] || !entities[edge.target]) continue;
    const key = `${edge.source}:${edge.target}`;
    const old = relations.get(key);
    relations.set(key, { ...edge, referenced: edge.referenced || Boolean(old?.referenced),
      references: [...new Set([...(old?.references || []), ...edge.references])],
      statements: [...new Set([...(old?.statements || []), edge.statement])] });
  }
  const nodes: Record<string, GraphNode> = {};
  const ids = new Set([center, ...[...relations.values()].flatMap(edge => [edge.source, edge.target])]);
  for (const id of ids) {
    const entity = entities[id];
    if (!entity) continue;
    nodes[id] = { type: "person", links: {}, label: entity.labels?.[language]?.value || entity.labels?.en?.value || entity.labels?.mul?.value || Object.values(entity.labels || {})[0]?.value || id,
      description: entity.descriptions?.[language]?.value || entity.descriptions?.en?.value || "", url: `https://www.wikidata.org/wiki/${id}` };
  }
  for (const edge of relations.values()) nodes[edge.source].links[edge.target] = true;
  return { nodes, genealogyEdges: [...relations.values()], center, kind };
}

export class SPGenealogyClient {
    declare request: JsonRequest;
    declare delay: Delay;
    declare now: () => number;
    declare cache: Map<string, { value: WikidataResponse; at: number }>;
    declare queue: Promise<unknown>;
    declare lastStart: number;

  constructor(request: JsonRequest, delay: Delay = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now) {
    this.request = request; this.delay = delay; this.now = now;
    this.cache = new Map(); this.queue = Promise.resolve(); this.lastStart = -Infinity;
  }
  async json(url: string, signal?: AbortSignal): Promise<WikidataResponse> {
    const cached = this.cache.get(url);
    if (signal?.aborted) throw new Error("ui-error-genealogy-cancelled");
    if (cached && this.now() - cached.at < 86400000) return cached.value;
    const task = this.queue.catch(() => {}).then(async () => {
      if (signal?.aborted) throw new Error("ui-error-genealogy-cancelled");
      await this.delay(Math.max(0, 300 - (this.now() - this.lastStart)));
      if (signal?.aborted) throw new Error("ui-error-genealogy-cancelled");
      this.lastStart = this.now();
      const raw = await this.request(url);
      if (!isRecord(raw) || raw.error) throw new Error(isRecord(raw) && isRecord(raw.error) ? String(raw.error.info || "ui-error-invalid-wikidata-response") : "ui-error-invalid-wikidata-response");
      const value = raw as WikidataResponse;
      if (!Array.isArray(value.search) && !isRecord(value.entities) && !Array.isArray(value.results?.bindings)) throw new Error("ui-error-invalid-wikidata-response");
      if (signal?.aborted) throw new Error("ui-error-genealogy-cancelled");
      if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(url, { value, at: this.now() });
      return value;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async search(name: string, language = "en", signal?: AbortSignal): Promise<WikidataPerson[]> {
    const query = String(name).trim();
    if (!query) return [];
    const params = new URLSearchParams({ action: "wbsearchentities", search: query, language, uselang: language, format: "json", limit: "8", type: "item" });
    const result = await this.json(`https://www.wikidata.org/w/api.php?${params}`, signal);
    if (!Array.isArray(result.search)) throw new Error("ui-error-wikidata-search-unavailable");
    return result.search.filter(person => /^Q[1-9]\d*$/.test(person.id));
  }
  async entities(ids: string[], language: string, signal?: AbortSignal): Promise<Record<string, WikidataEntity>> {
    const unique = [...new Set(ids.map(spWikidataID))];
    const entities: Record<string, WikidataEntity> = {};
    for (let i = 0; i < unique.length; i += 50) {
      const params = new URLSearchParams({ action: "wbgetentities", ids: unique.slice(i, i + 50).join("|"), props: "labels|descriptions|claims", format: "json" });
      const result = await this.json(`https://www.wikidata.org/w/api.php?${params}`, signal);
      if (!result.entities) throw new Error("ui-error-wikidata-entities-unavailable");
      for (const [id, entity] of Object.entries(result.entities)) if (!("missing" in entity)) entities[id] = entity;
    }
    return entities;
  }
  async graph(person: string, kind: GenealogyKind = "doctoral", language = "en", signal?: AbortSignal): Promise<GraphData> {
    const id = spWikidataID(person);
    const entities = await this.entities([id], language, signal);
    if (!entities[id]) throw new Error("ui-error-wikidata-person-not-found");
    if (!(entities[id].claims?.P31 || []).some(claim => claim.mainsnak?.datavalue?.value?.id === "Q5")) {
      throw new Error("ui-error-select-person");
    }
    const props = kind === "doctoral" ? ["P184", "P185"] : ["P1066", "P802"];
    const query = `SELECT DISTINCT ?person WHERE { { ?person wdt:${props[0]} wd:${id} } UNION { ?person wdt:${props[1]} wd:${id} } } ORDER BY ?person LIMIT 101`;
    // A relationship may be recorded only on the other person's entry.
    const incoming = await this.json(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" })}`, signal);
    if (!Array.isArray(incoming.results?.bindings)) throw new Error("ui-error-wikidata-relations-unavailable");
    const related = new Set(spGenealogyRelations(entities[id], kind).flatMap(edge => [edge.source, edge.target]));
    for (const row of incoming.results.bindings) related.add(spWikidataID(row.person?.value));
    related.delete(id);
    const ids = [...related].slice(0, 80);
    Object.assign(entities, await this.entities(ids, language, signal));
    return { ...spGenealogyGraph(entities, id, kind, language), truncated: related.size > 80 || incoming.results.bindings.length > 100 };
  }
}
