  // src/features/item-tree/itemTreeLifecycle.ts
  export async function awaitItemTreeReady(itemTree) {
    try {
      await itemTree.ready;
      return itemTree;
    } catch (error) {
      itemTree.destroy();
      throw error;
    }
  }
  export function attachItemTreeExtensionHost(context, host) {
    context.itemTreeExtensionHost = host;
    return () => {
      if (context.itemTreeExtensionHost === host) {
        delete context.itemTreeExtensionHost;
      }
    };
  }
  export function startDeferredItemTree(context, itemTree, onFailure) {
    let active = true, detachHost;
    // Empty views have no tree. Waiting must not block plugin startup or shutdown.
    const ready = awaitItemTreeReady(itemTree).then(() => {
      if (active) detachHost = attachItemTreeExtensionHost(context, itemTree);
    }).catch(error => {
      onFailure({ featureID: "item-tree", phase: "start", error });
    });
    context.addon.api.itemTreeReady = ready;
    return async () => {
      active = false;
      detachHost?.();
      itemTree.destroy();
      await ready;
      if (context.addon.api.itemTreeReady === ready) delete context.addon.api.itemTreeReady;
    };
  }
  export async function startItemTreeContributions(contributions, onFailure: (failure: { id: string; error: unknown }) => void = () => {}, shouldContinue = () => true) {
    const cleanups = [];
    for (const contribution of contributions) {
      if (!shouldContinue()) {
        break;
      }
      try {
        if (contribution.isEnabled && !contribution.isEnabled()) {
          continue;
        }
        const cleanup = await contribution.start();
        if (cleanup) {
          if (shouldContinue()) {
            cleanups.push(cleanup);
          } else {
            try {
              cleanup();
            } catch {}
          }
        }
      } catch (error) {
        try {
          onFailure({
            id: contribution.id,
            error
          });
        } catch {}
      }
    }
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      for (const cleanup of cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {}
      }
    };
  }
