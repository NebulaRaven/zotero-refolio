  // src/utils/browserGlobals.ts
  export var WINDOW_METHOD_GLOBAL_NAMES = /* @__PURE__ */new Set(["atob", "btoa", "cancelAnimationFrame", "clearInterval", "clearTimeout", "createImageBitmap", "fetch", "getComputedStyle", "queueMicrotask", "requestAnimationFrame", "setInterval", "setTimeout"]);
  export var BROWSER_GLOBAL_NAMES = ["AbortController", "AbortSignal", "Blob", "cancelAnimationFrame", "clearInterval", "clearTimeout", "createImageBitmap", "CustomEvent", "DecompressionStream", "fetch", "FileReader", "getComputedStyle", "navigator", "Node", "NodeFilter", "NodeList", "queueMicrotask", "ReadableStream", "requestAnimationFrame", "ResizeObserver", "Response", "setInterval", "setTimeout", "TextDecoder", "TextEncoder", "URL", "URLSearchParams", "atob", "btoa", "crypto"];
  export function resolveBrowserGlobal(browserWindow, name) {
    const value = browserWindow[name];
    if (typeof value === "function" && WINDOW_METHOD_GLOBAL_NAMES.has(name)) {
      return (...args) => browserWindow[name](...args);
    }
    return value;
  }

