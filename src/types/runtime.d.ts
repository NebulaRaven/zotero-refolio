import type { Addon } from '../upstream/addon.ts';

declare global {
  const ZoteroPane: _ZoteroTypes.ZoteroPane;
  const Zotero_Tabs: _ZoteroTypes.Zotero_Tabs;
  const rootURI: string;
  const addon: InstanceType<typeof Addon>;
  const ztoolkit: any;
  const _globalThis: {
    rootURI: string;
    Zotero: typeof Zotero;
    addon: InstanceType<typeof Addon>;
    Services: typeof Services;
  };
}
