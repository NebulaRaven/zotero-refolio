import { createZToolkit } from "./utils/ztoolkit.ts";
import { hooks_default } from "../app/hooks.ts";
import { Requests } from "./utils/requests.ts";
import type { AddonAPI,AddonData } from '../types/addon.ts';
  // src/addon.ts
  export class Addon {
    declare data: AddonData;
    declare hooks: { onStartup: () => Promise<void>; onShutdown: () => Promise<void>; onMainWindowLoad: (win: any) => Promise<void>; onMainWindowUnload: (win: any) => Promise<void>; onPrefsEvent: (type: any, data: any) => Promise<void>; onCollectionSelect: () => Promise<void>; };
    declare api: AddonAPI;

    constructor() {
      this.data = {
        alive: true,
        env: "production",
        ztoolkit: createZToolkit(),
        patch: {},
        cache: {},
        author: "polygon"
      };
      this.hooks = hooks_default;
      this.api = {
        requests: new Requests()
      };
    }
  };
  export var addon_default = Addon;
