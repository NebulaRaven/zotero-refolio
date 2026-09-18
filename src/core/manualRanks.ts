import type { ManualRanks,ManualRankRecord,RankValues } from "./models.ts";
type NormalizeName = (name: string) => string;
// SPDX-License-Identifier: AGPL-3.0-or-later
export const spManualRankFields: Array<[string, string]> = [
  ["sciif", "ui-rank-if"], ["sci", "ui-rank-sci"], ["ssci", "ui-rank-ssci"],
  ["sciBase", "ui-rank-cas-basic"], ["sciUp", "ui-rank-cas-upgraded"], ["pku", "ui-rank-pku"],
  ["cssci", "ui-rank-cssci"], ["cscd", "ui-rank-cscd"], ["utd24", "ui-rank-utd24"], ["复合影响因子", "ui-rank-composite-if"]
];

export function spReadManualRanks(raw: unknown): ManualRanks {
  const records: unknown = typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
  if (!records || typeof records !== "object" || Array.isArray(records)) throw new Error("ui-error-invalid-manual-ranks");
  return records as ManualRanks;
}

export function spManualJournalKey(names: string[], normalize: NormalizeName): string {
  return [...new Set(names.map(normalize).filter(Boolean))].sort()[0] || "";
}

export function spManualRankRecord(raw: unknown, names: string[], normalize: NormalizeName): ManualRankRecord | undefined {
  const records = spReadManualRanks(raw);
  const keys = names.map(normalize);
  const canonical = spManualJournalKey(names, normalize);
  if (Object.hasOwn(records, canonical)) return records[canonical];
  // Also find earlier entries after the user edits a journal's alias group.
  return Object.values(records).find(record => Array.isArray(record.names) && record.names.some(name => keys.includes(normalize(name))));
}

export function spEffectiveRanks(automatic: RankValues | undefined, record?: Pick<ManualRankRecord, "fields">): RankValues | undefined {
  if (!record?.fields || !Object.keys(record.fields).length) return automatic;
  const result = { ...(automatic && typeof automatic === "object" ? automatic : {}) };
  for (const [field, value] of Object.entries(record.fields)) {
    if (value === null) delete result[field];
    else result[field] = String(value);
  }
  return result;
}

export function spValidateManualRank(field: string, raw: unknown): string {
  const value = String(raw).trim();
  if (!field.trim() || ["__proto__", "prototype", "constructor"].includes(field)) throw new Error("ui-error-invalid-field-name");
  if (!value) throw new Error("ui-error-rank-value");
  if (["sciif", "sciif5", "IF", "5YIF", "JCI", "jci", "复合影响因子"].includes(field) && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new Error("ui-error-impact-factor-nonnegative");
  }
  if (["sci", "ssci", "JCR"].includes(field) && !/^(Q[1-4]|SCI|SSCI)$/i.test(value)) throw new Error("ui-error-quartile");
  return ["sci", "ssci", "JCR"].includes(field) ? value.toUpperCase() : value;
}

export function spSaveManualRankRecord(raw: unknown, names: string[], fields: Record<string, unknown>, normalize: NormalizeName, queryTitle?: string): ManualRanks {
  const records = { ...spReadManualRanks(raw) };
  const query = (queryTitle ?? spManualRankRecord(records, names, normalize)?.queryTitle ?? '').trim();
  if (/[\r\n\u0000]/.test(query)) throw new Error("ui-error-single-journal");
  const key = spManualJournalKey(names, normalize);
  if (!key) throw new Error("ui-error-journal-name");
  const normalized = new Set(names.map(normalize));
  for (const [id, record] of Object.entries(records)) {
    if (id === key || record.names?.some(name => normalized.has(normalize(name)))) delete records[id];
  }
  const checked: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(fields)) {
    if (!field.trim() || ["__proto__", "prototype", "constructor"].includes(field)) throw new Error("ui-error-invalid-field-name");
    checked[field] = value === null ? null : spValidateManualRank(field, value);
  }
  if (Object.keys(checked).length || query) records[key] = { names, fields: checked, ...(query ? { queryTitle: query } : {}) };
  return records as ManualRanks;
}
