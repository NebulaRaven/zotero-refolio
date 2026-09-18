  // src/features/collections/collectionItemCountPatch.ts
  export function installIdempotentRenderItemPatch({
    createPatchedRenderItem,
    host,
    legacyOriginalKey,
    onCleanup,
    onInstall,
    patchKey
  }) {
    const previousState = host[patchKey];
    if (previousState && host.renderItem === previousState.patchedRenderItem) {
      return previousState.cleanup;
    }
    previousState?.cleanup();
    const legacyOriginal = legacyOriginalKey ? host[legacyOriginalKey] : undefined;
    const originalRenderItem = typeof legacyOriginal === "function" ? legacyOriginal : host.renderItem;
    if (legacyOriginalKey) {
      delete host[legacyOriginalKey];
    }
    let active = true;
    const patchedRenderItem = createPatchedRenderItem(originalRenderItem, () => active);
    const cleanup = () => {
      if (!active) {
        return;
      }
      active = false;
      if (host.renderItem === patchedRenderItem) {
        host.renderItem = originalRenderItem;
      }
      if (host[patchKey] === state) {
        delete host[patchKey];
      }
      onCleanup();
    };
    const state = {
      cleanup,
      patchedRenderItem
    };
    host[patchKey] = state;
    host.renderItem = patchedRenderItem;
    onInstall?.();
    return cleanup;
  }

