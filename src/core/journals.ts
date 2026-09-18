import type { JournalName,JournalIndex,EasyScholarResponse,JournalRankMerge,JournalRankValue,JournalRankConflict,JournalQuery } from "./models.ts";
import { spManualRankRecord } from "./manualRanks.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
import spJournalDatabase from "../../data/journals.json" with { type: "json" };

export function spNormalizeJournalName(value: string): string {
  return value.normalize("NFKC").replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, " ")
    .replace(/\s*([():;,])\s*/g, "$1").trim().toLowerCase();
}

export function spCreateJournalIndex(journals: readonly JournalName[]): JournalIndex {
  const index: JournalIndex = new Map();
  for (const journal of journals) {
    const names = [journal.zh, journal.en, ...(journal.aliases || [])].filter((name): name is string => Boolean(name));
    for (const name of names) {
      const key = spNormalizeJournalName(name);
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(journal);
    }
  }
  return index;
}

let spBuiltInJournalIndex: JournalIndex | undefined;
export function spBuiltInJournalNames(title: string, index?: JournalIndex): string[] {
  index ||= spBuiltInJournalIndex ||= spCreateJournalIndex(spJournalDatabase.journals);
  const matches = index.get(spNormalizeJournalName(title));
  if (matches?.size !== 1) return [];
  const journal = [...matches][0];
  // Names shared by separate journals or editions cannot safely be queried as aliases.
  return [journal.zh, journal.en, ...(journal.aliases || [])].filter((name): name is string =>
    Boolean(name) && index.get(spNormalizeJournalName(name!))?.size === 1);
}

export function spPublicationNames(title: string, rawAliases: unknown = "{}"): string[] {
  const aliases = typeof rawAliases === "string" ? JSON.parse(rawAliases || "{}") : rawAliases;
  if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) throw new Error("ui-error-aliases-object");
  let names = [title];
  const normalize = spNormalizeJournalName;
  let customMatch = false;
  for (const [canonical, alternatives] of Object.entries(aliases)) {
    if (!Array.isArray(alternatives) || !alternatives.every(name => typeof name === "string")) {
      throw new Error("ui-error-aliases-array");
    }
    const group = [canonical, ...alternatives];
    if (group.some(name => normalize(name) === normalize(title))) {
      customMatch = true;
      names.push(...group);
    }
  }
  if (!customMatch) names.push(...spBuiltInJournalNames(title));
  const seen = new Set();
  return names.filter(name => {
    const key = normalize(name);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 6);
}

export function spJournalQuery(title: string, rawAliases: unknown, rawManual: unknown, provider = 'easyscholar'): JournalQuery {
  const originalNames = spPublicationNames(title, rawAliases);
  const queryTitle = spManualRankRecord(rawManual, originalNames, spNormalizeJournalName)?.queryTitle?.trim();
  const names = queryTitle ? spPublicationNames(queryTitle, rawAliases) : originalNames;
  return { provider, names, redirected: Boolean(queryTitle), identity: JSON.stringify([provider, names.map(spNormalizeJournalName)]) };
}

function comparableRank(value: string): string {
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  return /^\d+(?:\.\d+)?$/.test(normalized) ? String(Number(normalized)) : normalized;
}

export function spMergeRanks(sources: Array<{ name: string; response: EasyScholarResponse | null | undefined }>): JournalRankMerge {
  const rank = new Map<string, string>();
  const values = new Map<string, JournalRankValue[]>();
  const put = (key: string, value: unknown, name: string, kind: JournalRankValue['kind']) => {
    if (!key || value === undefined || value === null || !String(value).trim()) return;
    const text = String(value).trim();
    if (!rank.has(key)) rank.set(key, text);
    if (!values.has(key)) values.set(key, []);
    values.get(key)!.push({ name, kind, value: text });
  };
  for (const { name, response } of sources) {
    const data = response?.data;
    for (const [key, value] of Object.entries(data?.officialRank?.all || {})) put(key, value, name, 'official');
    const custom = data?.customRank;
    for (const entry of Array.isArray(custom?.rank) ? custom.rank : []) {
      const [uuid, rank] = String(entry).split("&&&");
      const field = ([null, "oneRankText", "twoRankText", "threeRankText", "fourRankText", "fiveRankText"] as const)[Number(rank)];
      const info = (Array.isArray(custom?.rankInfo) ? custom.rankInfo : []).find(info => info.uuid === uuid);
      const key = info?.abbName || (uuid === "1630108408394477568" ? "university" : "");
      if (field && key) put(key, `${String(info?.[field] || key).trim()}[rank=${rank}]`, name, 'custom');
    }
  }
  const conflicts = [...values].filter(([, entries]) => new Set(entries.map(entry => comparableRank(entry.value))).size > 1)
    .map(([field, entries]) => ({ field, values: entries }));
  return { rank: Object.fromEntries(rank), conflicts };
}

export function spJournalConflictSignature(conflicts: JournalRankConflict[]): string {
  return JSON.stringify(conflicts.map(({ field, values }) => [field,
    values.map(({ name, kind, value }) => [spNormalizeJournalName(name), kind, comparableRank(value)])
  ]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

export function spRedactURL(value: unknown): string {
  return String(value).replace(/([?&](?:secretKey|api_key|apikey|token|key)=)[^&#\s]*/gi, "$1[redacted]");
}
