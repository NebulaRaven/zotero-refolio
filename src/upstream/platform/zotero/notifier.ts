import { config } from "../../config.ts";
  // Zotero calls observers in ascending priority order, 100 when none is given.
  export function registerNotify(types, onNotify, priority?: number) {
    let active = true;
    const callback = {
      notify: async (...data) => {
        if (!active) return;
        if (!addon?.data.alive) {
          unregister();
          return;
        }
        await onNotify(...data);
      }
    };
    const notifyID = priority === undefined
      ? Zotero.Notifier.registerObserver(callback, types)
      : Zotero.Notifier.registerObserver(callback, types, config.addonRef, priority);
    const unregister = () => {
      if (!active) {
        return;
      }
      active = false;
      window.removeEventListener("unload", unregister);
      Zotero.Notifier.unregisterObserver(notifyID);
    };
    window.addEventListener("unload", unregister, {
      once: true
    });
    return unregister;
  }
