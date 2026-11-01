  export async function reconcileReaderToolbarAfterInitialization(reader, isActive, getDocument, render) {
    try {
      await reader._initPromise;
    } catch {
      return false;
    }
    if (!isActive()) {
      return false;
    }
    const readerDocument = getDocument(reader);
    if (readerDocument) {
      return render(reader, readerDocument);
    } else {
      return false;
    }
  }

