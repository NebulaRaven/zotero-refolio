  // src/utils/reader.ts
  export function getReaderViewWindow(view) {
    return view?._iframeWindow;
  }
  export async function getSelectedReaderAnnotations(view) {
    const getSelectedAnnotations = view?.getSelectedAnnotations;
    if (getSelectedAnnotations) {
      return await getSelectedAnnotations.call(view);
    } else {
      return [];
    }
  }
  export function getReaderInternals(reader) {
    if (reader && typeof reader === "object") {
      return reader;
    } else {
      return undefined;
    }
  }
  export function getReaderOuterWindow(reader) {
    return getReaderInternals(reader)?._iframeWindow;
  }
  export function getReaderOuterDocument(reader) {
    return getReaderOuterWindow(reader)?.document;
  }
  export function executeReaderOuterScript(reader, source) {
    const outerWindow = getReaderOuterWindow(reader);
    const contentWindow = outerWindow?.wrappedJSObject ?? outerWindow;
    const head = contentWindow?.document.head;
    if (!contentWindow || !head) {
      return false;
    }
    const script = contentWindow.document.createElement("script");
    script.textContent = source;
    head.appendChild(script);
    script.remove();
    return true;
  }
  export function setReaderToolColors(reader, color) {
    const tools = getReaderInternals(reader)?._internalReader?._tools;
    if (!tools) {
      return;
    }
    for (const tool of Object.values(tools as Record<string, {color?: string}>)) {
      if (tool?.color) {
        tool.color = color;
      }
    }
  }
  export function getReaderInstances(readerAPI = Zotero.Reader) {
    const readers = readerAPI?._readers;
    if (!readers) {
      return [];
    }
    const instances = [];
    for (let index = 0; index < readers.length; index += 1) {
      const reader = readers[index];
      if (reader && typeof reader === "object") {
        instances.push(reader);
      }
    }
    return instances;
  }
  export function unregisterReaderEventListenersByPluginID(pluginID, readerAPI = Zotero.Reader) {
    const registry = readerAPI;
    const unregister2 = registry?._unregisterEventListenerByPluginID;
    if (typeof unregister2 !== "function") {
      return false;
    }
    try {
      unregister2.call(registry, pluginID);
      return true;
    } catch {
      return false;
    }
  }

