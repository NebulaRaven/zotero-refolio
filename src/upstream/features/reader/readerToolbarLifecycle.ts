  // src/features/reader/readerToolbarLifecycle.ts
  export async function reconcileReaderToolbarAfterInitialization(reader, isActive, getDocument, render) {
    try {
      await reader._initPromise;
    } catch {
      return false;
    }
    if (!isActive()) {
      return false;
    }
    const document2 = getDocument(reader);
    if (document2) {
      return render(reader, document2);
    } else {
      return false;
    }
  }

