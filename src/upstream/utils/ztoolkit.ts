import { ZoteroToolkit } from "../../vendor/index.js";
import { config } from "../config.ts";
import { installBoundedElementRecord } from "./weakRecordList.ts";
  // src/utils/ztoolkit.ts
  export function createZToolkit() {
    const _ztoolkit = new ZoteroToolkit();
    initZToolkit(_ztoolkit);
    return _ztoolkit;
  }
  export function initZToolkit(_ztoolkit) {
    const env = "production";
    _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
    _ztoolkit.basicOptions.log.disableConsole = env === "production";
    installBoundedElementRecord(_ztoolkit.UI);
    _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = false;
    _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = false;
    _ztoolkit.basicOptions.debug.disableDebugBridgePassword = false;
    _ztoolkit.basicOptions.api.pluginID = config.addonID;
    _ztoolkit.ProgressWindow.setIconURI("default", `chrome://${config.addonRef}/content/icons/refolio.svg`);
    _ztoolkit.ProgressWindow.setIconURI("success", `chrome://${config.addonRef}/content/icons/tick.png`);
    _ztoolkit.ProgressWindow.setIconURI("fail", `chrome://${config.addonRef}/content/icons/cross.png`);
  }

