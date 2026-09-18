// SPDX-License-Identifier: AGPL-3.0-or-later
export type JsonRecord = Record<string, unknown>;
export type RankValues = Record<string, string>;
export type GenealogyKind = 'doctoral' | 'general';
export type NodeID = string | number;
export type Delay = (milliseconds: number) => Promise<unknown>;
export type JsonRequest = (url: string) => Promise<unknown>;

export interface Creator {
  firstName?: string;
  lastName?: string;
  name?: string;
}
export interface GraphItem {
  id: number;
  key?: string;
  getField(name: string): unknown;
  getCreators?(): Creator[];
  getDisplayTitle?(): string;
}
export interface GraphNode {
  links: Record<string, boolean>;
  type?: string;
  label?: string;
  description?: string;
  title?: string;
  url?: string;
  year?: number | null;
  fullLabel?: string;
  x?: number;
  y?: number;
}
export interface GraphEdge { source: NodeID; target: NodeID; }
export interface ManualSource { id: string; sourceURL: string; note: string; }
export interface GenealogyEdge {
  source: string;
  target: string;
  kind: GenealogyKind;
  referenced: boolean;
  references: string[];
  statements: string[];
  wikidata?: boolean;
  manualRecords?: ManualSource[];
}
export interface GraphData {
  nodes: Record<string, GraphNode>;
  context?: string;
  totalNodes?: number;
  noSelection?: boolean;
  yearFiltered?: boolean;
  citationEdges?: GraphEdge[];
  genealogyEdges?: GenealogyEdge[];
  center?: string;
  kind?: GenealogyKind;
  sourceMode?: 'wikidata' | 'manual';
  truncated?: boolean;
}
export interface GraphFilter {
  scope?: string;
  depth?: number | string;
  minYear?: number | string;
  maxYear?: number | string;
  hideIsolated?: boolean;
}
export interface JournalName {
  zh?: string | null;
  en?: string | null;
  aliases?: string[];
}
export type JournalIndex = Map<string, Set<JournalName>>;
export interface EasyScholarRankInfo {
  uuid?: string;
  abbName?: string;
  oneRankText?: string;
  twoRankText?: string;
  threeRankText?: string;
  fourRankText?: string;
  fiveRankText?: string;
}
export interface EasyScholarResponse {
  data?: {
    officialRank?: { all?: Record<string, unknown> };
    customRank?: { rank?: unknown[]; rankInfo?: EasyScholarRankInfo[] };
  };
}
export interface ManualRankRecord { names: string[]; fields: Record<string, string | null>; queryTitle?: string; }
export type ManualRanks = Record<string, ManualRankRecord>;
export interface JournalRankValue { name: string; kind: 'official' | 'custom'; value: string; }
export interface JournalRankConflict { field: string; values: JournalRankValue[]; }
export interface JournalRankMerge { rank: RankValues; conflicts: JournalRankConflict[]; }
export interface JournalQuery { provider: string; names: string[]; identity: string; redirected: boolean; }
export interface JournalLookup extends JournalQuery {
  checkedAt: string;
  conflicts: JournalRankConflict[];
  failedNames: string[];
}
export interface PersonRecord { label: string; description: string; }
export interface PersonDraft { id?: string; label: string; description?: string; }
export interface ManualRelation { mentor: string; student: string; kind: GenealogyKind; sourceURL: string; note: string; }
export interface ManualGenealogy { version: 1; people: Record<string, PersonRecord>; relations: Record<string, ManualRelation>; }
export interface RelationDraft {
  id?: string;
  mentor: PersonDraft;
  student: PersonDraft;
  kind: GenealogyKind;
  sourceURL?: string;
  note?: string;
}
export interface DeletedRelation { id: string; relation: ManualRelation; people: Record<string, PersonRecord>; }
export interface WikidataClaim {
  rank?: string;
  mainsnak?: { datavalue?: { value?: { id?: string } } };
  references?: Array<{ snaks?: {
    P854?: Array<{ datavalue?: { value?: unknown } }>;
    P248?: Array<{ datavalue?: { value?: { id?: string } } }>;
  } }>;
}
export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, WikidataClaim[]>;
  missing?: string;
}
export interface WikidataPerson { id: string; label?: string; description?: string; }
export interface WikidataResponse {
  search?: WikidataPerson[];
  entities?: Record<string, WikidataEntity>;
  results?: { bindings?: Array<{ person?: { value?: string } }> };
}
export interface WikidataRelation {
  source: string;
  target: string;
  kind: GenealogyKind;
  property: string;
  owner: string;
  referenced: boolean;
  references: string[];
  statement: string;
}
export interface TagHost {
  Libraries: { get(id: number): { editable: boolean } | false | undefined };
  Tags: {
    getAll(id: number): Promise<Array<{ tag: string }>>;
    rename(id: number, from: string, to: string): Promise<unknown>;
    getID(name: string): number | false | undefined;
    removeFromLibrary(id: number, ids: number[]): Promise<unknown>;
  };
}

export function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isGenealogyKind(value: unknown): value is GenealogyKind {
  return value === 'doctoral' || value === 'general';
}
