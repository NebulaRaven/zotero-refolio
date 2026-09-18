  // src/features/workspace/styleElement.ts
  export var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  export function syncStyleElement(doc, id, css) {
    const existing = doc.getElementById(id);
    if (!css) {
      existing?.remove();
      return undefined;
    }
    let style2;
    if (existing?.localName === "style") {
      style2 = existing;
    } else {
      existing?.remove();
      style2 = doc.createElementNS(HTML_NAMESPACE, "style");
      style2.id = id;
      style2.type = "text/css";
      (doc.head ?? doc.documentElement).appendChild(style2);
    }
    if (style2.textContent !== css) {
      style2.textContent = css;
    }
    return style2;
  }

