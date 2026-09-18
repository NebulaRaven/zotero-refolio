import { isRecord,isGenealogyKind } from "./models.ts";
import type { ManualGenealogy,PersonRecord,PersonDraft,ManualRelation,RelationDraft,DeletedRelation,GraphData,GraphNode,GenealogyEdge,GenealogyKind,ManualSource } from "./models.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export const spLocalPersonID = /^(Q[1-9]\d*|local:[a-zA-Z0-9-]+)$/;
export const spLocalRelationID = /^relation:[a-zA-Z0-9-]+$/;
export const spGenealogyKinds = new Set(["doctoral", "general"]);

export function spGenealogySourceURL(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { throw new Error("ui-error-source-url"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("ui-error-source-url");
  return url.href;
}

export function spReadManualGenealogy(raw?: unknown): ManualGenealogy {
  const data: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (data == null) return { version: 1, people: {}, relations: {} };
  if (!isRecord(data) || data.version !== 1 || !isRecord(data.people) || !isRecord(data.relations)) {
    throw new Error("ui-error-invalid-genealogy");
  }
  const people: Record<string, PersonRecord> = {}, relations: Record<string, ManualRelation> = {};
  for (const [id, person] of Object.entries(data.people)) {
    if (!spLocalPersonID.test(id) || !isRecord(person) || typeof person.label !== "string" || !person.label.trim()) throw new Error("ui-error-invalid-saved-person");
    people[id] = { label: person.label.trim(), description: String(person.description || "") };
  }
  for (const [id, relation] of Object.entries(data.relations)) {
    if (!spLocalRelationID.test(id) || !isRecord(relation) || typeof relation.mentor !== "string" || typeof relation.student !== "string" || !spLocalPersonID.test(relation.mentor) || !spLocalPersonID.test(relation.student) || !people[relation.mentor] || !people[relation.student] ||
      relation.mentor === relation.student || !isGenealogyKind(relation.kind)) throw new Error("ui-error-invalid-saved-relationship");
    relations[id] = { mentor: relation.mentor, student: relation.student, kind: relation.kind,
      sourceURL: spGenealogySourceURL(relation.sourceURL), note: String(relation.note || "") };
  }
  return { version: 1, people, relations };
}

export function spSaveManualGenealogy(raw: unknown, draft: RelationDraft, newID: () => string) {
  const data = spReadManualGenealogy(raw);
  if (draft.id && !Object.hasOwn(data.relations, draft.id)) throw new Error("ui-error-relationship-missing");
  if (!spGenealogyKinds.has(draft.kind)) throw new Error("ui-error-relationship-type");
  const person = (input: PersonDraft) => {
    const label = String(input?.label || "").trim();
    if (!label) throw new Error("ui-error-person-names");
    const id = input.id || `local:${newID()}`;
    if (!spLocalPersonID.test(id)) throw new Error("ui-error-person-id");
    if (!input.id && Object.hasOwn(data.people, id)) throw new Error("ui-error-person-id-collision");
    // Names alone never establish identity; existing people must be selected explicitly.
    if (!Object.hasOwn(data.people, id) || id.startsWith("local:")) data.people[id] = { label, description: String(input.description || "").trim() };
    return id;
  };
  const mentor = person(draft.mentor), student = person(draft.student);
  if (mentor === student) throw new Error("ui-error-self-mentor");
  if (Object.entries(data.relations).some(([id, edge]) => id !== draft.id && edge.mentor === mentor && edge.student === student && edge.kind === draft.kind)) {
    throw new Error("ui-error-relationship-exists-edit");
  }
  const id = draft.id || `relation:${newID()}`;
  if (!spLocalRelationID.test(id) || (!draft.id && Object.hasOwn(data.relations, id))) throw new Error("ui-error-relationship-id-collision");
  data.relations[id] = { mentor, student, kind: draft.kind, sourceURL: spGenealogySourceURL(draft.sourceURL), note: String(draft.note || "").trim() };
  return { data, id };
}

export function spDeleteManualGenealogy(raw: unknown, id: string): { data: ManualGenealogy; removed: DeletedRelation } {
  const data = spReadManualGenealogy(raw);
  if (!Object.hasOwn(data.relations, id)) throw new Error("ui-error-relationship-missing");
  const removed = { id, relation: data.relations[id], people: data.people };
  delete data.relations[id];
  return { data, removed };
}

export function spRestoreManualGenealogy(raw: unknown, removed: DeletedRelation): ManualGenealogy {
  const data = spReadManualGenealogy(raw);
  if (Object.hasOwn(data.relations, removed.id)) throw new Error("ui-error-relationship-restored");
  const edge = removed.relation;
  if (Object.values(data.relations).some(other => other.mentor === edge.mentor && other.student === edge.student && other.kind === edge.kind)) {
    throw new Error("ui-error-relationship-exists");
  }
  for (const id of [edge.mentor, edge.student]) if (!data.people[id]) data.people[id] = removed.people[id];
  data.relations[removed.id] = edge;
  return spReadManualGenealogy(data);
}

export function spMergeManualGenealogy(base: GraphData | undefined, raw: unknown, kind: GenealogyKind = "doctoral"): GraphData {
  const data = spReadManualGenealogy(raw), nodes: Record<string, GraphNode> = {}, edges = new Map<string, GenealogyEdge & { manualRecords: ManualSource[] }>();
  if (!spGenealogyKinds.has(kind)) throw new Error("ui-error-relationship-type");
  for (const [id, node] of Object.entries(base?.nodes || {})) nodes[id] = { ...node, links: {} };
  for (const edge of base?.genealogyEdges || []) {
    if (edge.kind !== kind) continue;
    edges.set(`${edge.source}:${edge.target}`, { ...edge, wikidata: true, manualRecords: [] });
  }
  for (const [id, relation] of Object.entries(data.relations)) {
    if (relation.kind !== kind) continue;
    if (base?.center && relation.mentor !== base.center && relation.student !== base.center) continue;
    for (const personID of [relation.mentor, relation.student]) {
      nodes[personID] ||= { ...data.people[personID], type: "person", links: {},
        url: personID.startsWith("Q") ? `https://www.wikidata.org/wiki/${personID}` : "" };
    }
    const key = `${relation.mentor}:${relation.student}`;
    const edge = edges.get(key) || { source: relation.mentor, target: relation.student, kind,
      referenced: false, references: [], statements: [], wikidata: false, manualRecords: [] };
    edge.manualRecords.push({ id, sourceURL: relation.sourceURL, note: relation.note });
    edges.set(key, edge);
  }
  for (const edge of edges.values()) nodes[edge.source].links[edge.target] = true;
  return { ...base, nodes, genealogyEdges: [...edges.values()], kind, sourceMode: base?.sourceMode || (base ? "wikidata" : "manual") };
}
