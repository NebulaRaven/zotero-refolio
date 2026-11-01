import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The graph renderer runs inside an iframe. pixi.js-legacy 6.4.2 attaches the interaction manager's
// move, up and cancel listeners to the global document, which never sees the iframe's pointer events,
// so dragging stalls; these replacements attach them to the canvas element's own document instead.
const PATCH: Array<[string, string]> = [
  ['this.supportsPointerEvents?(globalThis.document.addEventListener("pointermove",',
    'this.ownerDocument=this.interactionDOMElement.ownerDocument,this.supportsPointerEvents?(this.ownerDocument.addEventListener("pointermove",'],
  ['globalThis.addEventListener("pointercancel",', 'this.ownerDocument.addEventListener("pointercancel",'],
  ['globalThis.addEventListener("pointerup",', 'this.ownerDocument.addEventListener("pointerup",'],
  ['this._eventListenerOptions)):(globalThis.document.addEventListener("mousemove",', 'this._eventListenerOptions)):(this.ownerDocument.addEventListener("mousemove",'],
  ['globalThis.addEventListener("mouseup",', 'this.ownerDocument.addEventListener("mouseup",'],
  ['this.supportsPointerEvents?(globalThis.document.removeEventListener("pointermove",', 'this.supportsPointerEvents?(this.ownerDocument.removeEventListener("pointermove",'],
  ['globalThis.removeEventListener("pointercancel",', 'this.ownerDocument.removeEventListener("pointercancel",'],
  ['globalThis.removeEventListener("pointerup",', 'this.ownerDocument.removeEventListener("pointerup",'],
  ['this._eventListenerOptions)):(globalThis.document.removeEventListener("mousemove",', 'this._eventListenerOptions)):(this.ownerDocument.removeEventListener("mousemove",'],
  ['globalThis.removeEventListener("mouseup",', 'this.ownerDocument.removeEventListener("mouseup",'],
  ['this.interactionDOMElement=null,this.eventsAdded=!1', 'this.interactionDOMElement=null,this.ownerDocument=null,this.eventsAdded=!1'],
  // The source map is not shipped.
  ['\n//# sourceMappingURL=pixi-legacy.min.js.map', '']
];

export function applyPixiPatch(source: string): string {
  for (const [from, to] of PATCH) {
    const count = source.split(from).length - 1;
    if (count !== 1) throw new Error(`The pixi patch expects one occurrence of ${JSON.stringify(from)}, found ${count}.`);
    source = source.replace(from, () => to);
  }
  return source;
}

export async function pixiBundle(): Promise<string> {
  return applyPixiPatch(await fs.readFile(path.join(root, 'node_modules/pixi.js-legacy/dist/browser/pixi-legacy.min.js'), 'utf8'));
}
