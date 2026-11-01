  export function registerNotify(types, onNotify) {
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
    const notifyID = Zotero.Notifier.registerObserver(callback, types);
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
