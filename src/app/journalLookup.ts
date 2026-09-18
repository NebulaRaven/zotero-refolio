import { getString } from "../upstream/utils/locale.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { JournalLookup, JournalQuery, JournalRankMerge, RankValues } from '../core/models.ts';
import { spJournalQuery, spJournalConflictSignature, spPublicationNames, spNormalizeJournalName } from '../core/journals.ts';
import { spManualRankRecord } from '../core/manualRanks.ts';
import { getPref } from '../upstream/utils/prefs.ts';


export interface JournalStorage {
  readonly disposed?: boolean;
  get(item: { key: string }, field: string): unknown;
  set(item: { key: string }, field: string, value: unknown): Promise<unknown>;
}

export function spGetJournalQuery(title: string): JournalQuery {
  return spJournalQuery(title, getPref('publicationTagsColumn.aliases') || '{}',
    getPref('publicationTagsColumn.manualRanks'), getPref('publicationTagsColumn.source') || 'easyscholar');
}

export function spGetJournalLookup(storage: JournalStorage, title: string): JournalLookup | undefined {
  const report = storage.get({ key: title }, 'rankLookup') as JournalLookup | undefined;
  return report?.identity === spGetJournalQuery(title).identity ? report : undefined;
}

export function spGetAutomaticJournalRanks(storage: JournalStorage, title: string): RankValues | undefined {
  const query = spGetJournalQuery(title);
  const report = storage.get({ key: title }, 'rankLookup') as JournalLookup | undefined;
  if (report ? report.identity !== query.identity : query.redirected) return undefined;
  const rank = storage.get({ key: title }, 'rank');
  return rank === '' ? {} : rank as RankValues | undefined;
}

export function spJournalChosenValue(title: string, field: string, automatic: string): string {
  if (getPref('function.manualJournalRanks.enable') !== false) {
    const names = spPublicationNames(title, getPref('publicationTagsColumn.aliases') || '{}');
    const value = spManualRankRecord(getPref('publicationTagsColumn.manualRanks'), names, spNormalizeJournalName)?.fields[field];
    if (value === null) return getString("ui-hidden-manually");
    if (value !== undefined) return `${value} (${getString("ui-manual-2")})`;
  }
  return automatic;
}

const notices = new WeakMap<JournalStorage, Map<string, string>>();

export async function spStoreJournalLookup(storage: JournalStorage, title: string, query: JournalQuery,
  result: JournalRankMerge, failedNames: string[], trigger: string): Promise<boolean> {
  if (storage.disposed || query.identity !== spGetJournalQuery(title).identity) return false;
  const previous = spGetJournalLookup(storage, title);
  const report: JournalLookup = { ...query, conflicts: result.conflicts, failedNames, checkedAt: new Date().toISOString() };
  await storage.set({ key: title }, 'rank', Object.keys(result.rank).length ? result.rank : '');
  await storage.set({ key: title }, 'rankLookup', report);
  let seen = notices.get(storage);
  if (!seen) notices.set(storage, seen = new Map());
  if (!report.conflicts.length) { seen.delete(title); return true; }
  const signature = query.identity + spJournalConflictSignature(report.conflicts);
  const unchanged = previous && spJournalConflictSignature(previous.conflicts) === spJournalConflictSignature(report.conflicts);
  if (trigger === 'automatic' && (unchanged || seen.get(title) === signature)) return true;
  if (seen.size >= 200) seen.delete(seen.keys().next().value);
  seen.set(title, signature);
  const popup = new ztoolkit.ProgressWindow(getString("ui-journal-rating-conflicts"), { closeTime: 12000 }).show();
  popup.createLine({ text: title, type: 'default' });
  for (const conflict of report.conflicts) {
    popup.createLine({ text: `${conflict.field}: ${conflict.values.map(value => `${value.name}${value.kind === 'custom' ? ` (${getString("ui-custom")})` : ''} = ${value.value}`).join(' / ')} → ${getString("ui-using")} ${spJournalChosenValue(title, conflict.field, result.rank[conflict.field])}`, type: 'fail' });
  }
  return true;
}
