import type { Addon } from '../upstream/addon.ts';
import type { AddonItem } from '../upstream/platform/persistence/storage.ts';

// Internal host APIs and optional integrations used by the Zotero 10 adapters.
declare global {
  namespace Zotero {
    let StylePersonal: Addon;
    let _AddonItemGlobal: AddonItem | undefined;
    const CollectionTreeRow: { prototype: CollectionTreeRow };
    const TagSelector: { init(container: Element, options: { container: string; onSelection: (data: unknown) => Promise<void> }): Promise<_ZoteroTypes.RefolioTagSelector> };
    const BetterNotes: { data: { workspace: { mainId: string } } } | undefined;
    const PDFTranslate: { api: { translate(text: string, options: { pluginID: string; langto?: string }): Promise<{ status: string; result: string }> } } | undefined;
    const FullText: { getPages(id: number): Promise<{ total: number } | undefined> };
    const Fulltext: { indexItems(ids: number[]): Promise<void> };
    interface Item { _displayTitle: string; }
    interface CollectionTreeRow {
      isFeeds(): boolean;
      getItems(options?: { unfiltered?: boolean }): Promise<Item[]>;
    }
  }
  namespace _ZoteroTypes {
    interface RefolioTagSelector {
      selectedTags: Set<string>;
      collectionTreeRows: Zotero.CollectionTreeRow[];
      contextTag: { tag: string };
      searchBoxRef: { current: { value: string; focus(): void; handleClear(): void } };
      destroy(): void;
      onItemViewChanged(data: unknown): void;
      setState(state: Record<string, unknown>): void;
      getTagsAndScope(): Promise<{ tags: Array<{ tag: string }>; [key: string]: unknown }>;
    }
    interface ItemTree { getRow(index: number): TreeRow & { ref: Zotero.Item }; }
    interface ReaderInstance<T extends keyof Reader.ViewTypeMap = 'pdf' | 'epub' | 'snapshot'> { currentPDFStyle?: string; }
    namespace Tags { interface TagJson { color?: string; position?: number; } }
    interface Tags { removeFromLibrary(libraryID: number, tagIDs: number[], onProgress?: Function, types?: number[]): Promise<void>; }
    interface Zotero_Tabs { _history: Array<Array<{ data?: { itemID?: number } }>>; }
    interface ItemTreeManager {
      _columnManager: { _optionsCache: Record<string, { label?: string; dataProvider(item: Zotero.Item, key: string): string; renderCell(index: number, data: string, column: { className: string }, first?: boolean, doc?: Document): HTMLElement }> };
    }
  }
}
