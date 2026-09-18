import { isElement } from "../../utils/dom.ts";
  // src/features/reader/sidebarShortcut.ts
  export function isEditor(target) {
    if (!isElement(target)) {
      return false;
    }
    return target.isContentEditable || target.ownerDocument?.designMode === "on" || !!target.closest("input, textarea, textbox, [role=\"textbox\"]");
  }
  export function shouldIgnoreSidebarShortcut(event) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) {
      return true;
    }
    if ([event.target, ...(event.composedPath?.() ?? [])].some(isEditor)) {
      return true;
    }
    let doc = event.view?.document;
    while (doc) {
      if (doc.designMode === "on" || isEditor(doc.activeElement)) {
        return true;
      }
      const active = doc.activeElement;
      if (!active || !["iframe", "frame"].includes(active.localName)) {
        break;
      }
      try {
        doc = active.contentDocument ?? undefined;
      } catch {
        break;
      }
    }
    return false;
  }

