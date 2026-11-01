import type { Addon } from '../upstream/addon.ts';
import type { AddonItem } from '../upstream/platform/persistence/storage.ts';

// Internal host APIs and optional integrations used by the Zotero 10 adapters.
declare global {
  namespace Zotero {
    let StylePersonal: Addon;
    let _AddonItemGlobal: AddonItem | undefined;
    // zotero-types declares getChildren() as returning one Collection or Feed; collectionTreeRow.js returns the child collections or feeds.
    const CollectionTreeRow: { prototype: Omit<CollectionTreeRow, "getChildren"> & { getChildren(): Collection[] | Feed[] | undefined } };
    const TagSelector: { init(container: Element, options: { container: string; onSelection: (data: unknown) => Promise<void> }): Promise<_ZoteroTypes.RefolioTagSelector> };
    const BetterNotes: { data: { workspace: { mainId: string } } } | undefined;
    const PDFTranslate: { api: { translate(text: string, options: { pluginID: string; langto?: string }): Promise<{ status: string; result: string }> } } | undefined;
    const FullText: { getPages(id: number): Promise<{ total: number } | undefined> };
    const Fulltext: { indexItems(ids: number[]): Promise<void> };
    // Zotero.logError() logs err.message, or err.toString() for values without one, so catch blocks can pass their
    // unknown error; like the original Error signature, it still throws for null or undefined.
    function logError(err: unknown): void;
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
    interface DB {
      // With onRow, db.js passes each mozIStorageRow and a cancel function to the callback and resolves to undefined.
      queryAsync(sql: string, params: DB.QueryParams | undefined, options: { inBackup?: boolean; noParseParams?: boolean; noCache?: boolean; onRow: (row: mozIStorageRow, cancel: () => void) => void }): Promise<undefined>;
    }
    interface Tags { removeFromLibrary(libraryID: number, tagIDs: number[], onProgress?: Function, types?: number[]): Promise<void>; }
    interface Zotero_Tabs { _history: Array<Array<{ data?: { itemID?: number } }>>; }
    interface ItemTreeManager {
      _columnManager: { _optionsCache: Record<string, { label?: string; dataProvider(item: Zotero.Item, key: string): string; renderCell(index: number, data: string, column: { className: string }, first?: boolean, doc?: Document): HTMLElement }> };
    }
  }
  interface nsIPromptService {
    // nsIPromptService.idl takes wstring titles, and a null title leaves that button or checkbox out; the generated types only accept strings.
    confirmEx(aParent: mozIDOMWindowProxy, aDialogTitle: string, aText: string, aButtonFlags: u32, aButton0Title: string | null, aButton1Title: string | null, aButton2Title: string | null, aCheckMsg: string | null, aCheckState: InOutParam<boolean>): i32;
  }
}
