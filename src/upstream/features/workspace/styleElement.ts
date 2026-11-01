  export var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  export function syncStyleElement(doc, id, css) {
    const existing = doc.getElementById(id);
    if (!css) {
      existing?.remove();
      return undefined;
    }
    let style;
    if (existing?.localName === "style") {
      style = existing;
    } else {
      existing?.remove();
      style = doc.createElementNS(HTML_NAMESPACE, "style");
      style.id = id;
      style.type = "text/css";
      (doc.head ?? doc.documentElement).appendChild(style);
    }
    if (style.textContent !== css) {
      style.textContent = css;
    }
    return style;
  }

