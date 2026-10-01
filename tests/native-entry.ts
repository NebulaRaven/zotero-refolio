import '../src/index.ts';
import { spRenameTags, spRemoveTags } from '../src/core/tags.ts';
import { spGraphLabel } from '../src/core/graph.ts';
import { spDisplayDate } from '../src/core/dates.ts';
import { import_dayjs } from '../src/upstream/features/item-tree/itemTree.ts';
import { getPref, setPref } from '../src/upstream/utils/prefs.ts';
import { registerShortcut, requests, updatePublicationTags } from '../src/upstream/utils/base.ts';
import { spGetJournalLookup, spGetAutomaticJournalRanks } from '../src/app/journalLookup.ts';
import { spGetJournalRanks } from '../src/app/manualRanks.ts';
import { getString } from '../src/upstream/utils/locale.ts';
import { spFeatureDefinitions } from '../src/core/features.ts';
import { version2 } from '../src/upstream/config.ts';
import { spGetCitationGraph, spConfirmCitationUpdate } from '../src/app/citations.ts';

interface DayjsValue { format(template: string): string; local(): DayjsValue; utcOffset(minutes: number): DayjsValue; }
export const nativeSmoke = { spRenameTags, spRemoveTags, spGraphLabel, spDisplayDate,
  getPref, setPref, requests, updatePublicationTags, registerShortcut, spGetJournalLookup, spGetAutomaticJournalRanks,
  spGetJournalRanks, spGetCitationGraph, spConfirmCitationUpdate, getString, spFeatureDefinitions, version: version2,
  dayjs: import_dayjs.default as { utc(value: unknown): DayjsValue } };
(addon.api as typeof addon.api & { __nativeSmoke: typeof nativeSmoke }).__nativeSmoke = nativeSmoke;
