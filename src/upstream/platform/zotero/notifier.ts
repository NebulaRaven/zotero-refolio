  // src/platform/zotero/notifier.ts
  export function registerNotify(types, onNotify) {
    let active = true;
    const callback = {
      notify: async (...data) => {
        if (!active) return;
        if (!addon?.data.alive) {
          unregister2();
          return;
        }
        await onNotify(...data);
      }
    };
    const notifyID = Zotero.Notifier.registerObserver(callback, types);
    const unregister2 = () => {
      if (!active) {
        return;
      }
      active = false;
      window.removeEventListener("unload", unregister2);
      Zotero.Notifier.unregisterObserver(notifyID);
    };
    window.addEventListener("unload", unregister2, {
      once: true
    });
    return unregister2;
  }
