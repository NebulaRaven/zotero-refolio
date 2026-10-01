import type { GraphEdge } from '../core/models.ts';
import type { Requests } from '../upstream/utils/requests.ts';
import type { LocalStorage,AddonItem } from '../upstream/platform/persistence/storage.ts';
import type { Tags,AddTags } from '../upstream/features/tags/tags.ts';
import type { createZToolkit } from '../upstream/utils/ztoolkit.ts';

export type Cleanup = () => void | Promise<void>;
export interface FeatureFailure { featureID: string; phase: 'start' | 'stop'; error: unknown; }
export interface PreferenceRegistration { window: Window; release?: Cleanup; }
export interface AddonData {
  alive: boolean;
  env: string;
  author: string;
  ztoolkit: ReturnType<typeof createZToolkit>;
  patch: {
    getItems?: { data: Array<(items: Zotero.Item[], row: Zotero.CollectionTreeRow) => Zotero.Item[] | Promise<Zotero.Item[]>> };
    _displayColumnPickerMenu?: { data: Array<() => void> };
  };
  cache: Record<string, number>;
  prefs?: PreferenceRegistration;
  dialog?: { window?: Window };
  locale?: { current: { formatMessagesSync(messages: Array<{ id: string; args?: Record<string, string | number> }>): Array<{ value?: string | null; attributes?: Array<{ name: string; value: string }> | null } | null> } };
}
export interface TabGroup { name: string; itemIDs: number[]; }
export interface AddonAPI {
  requests: Requests;
  storage?: LocalStorage | AddonItem;
  journalStorage?: LocalStorage;
  citationReferences?: Map<string, string[]>;
  citationReport?: { requested: number; available: number; failures: Array<{ doi: string; message: string }>; edges: GraphEdge[] };
  featureFailures?: Array<{ feature: string; phase: string; message: string }>;
  pendingManualJournal?: string;
  openManualJournal?: (journal?: string) => void;
  refreshGraphView?: () => Promise<void>;
  tagsUI?: InstanceType<typeof Tags>;
  addTagsUI?: AddTags;
  itemTreeReady?: Promise<unknown>;
  renderCell?: (item: Zotero.Item, key: string) => HTMLElement;
  tabManager?: { getTabGroups(): Promise<TabGroup[]>; setTabGroups(groups: TabGroup[]): Promise<void> };
}
