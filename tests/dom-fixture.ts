/** Minimal host DOM for resource-ownership tests; layout is a horizontal row. */
export function domFixture() {
  let nextFrame = 0, animationCount = 0, cancelledAnimations = 0;
  const frames = new Map<number, () => void>();
  class Element {
    nodeType = 1;
    children: Element[] = [];
    parentElement: Element | null = null;
    style: Record<string, string> = {};
    attributes = new Map<string, string>();
    dataset: Record<string, string> = {};
    listeners = new Map<string, Set<Function>>();
    className = ''; value = ''; textContent = ''; hidden = false;
    offsetWidth = 20; offsetHeight = 16;
    ownerDocument: any;
    tagName: string;
    constructor(tagName = 'div') { this.tagName = tagName; this.ownerDocument = document; }
    get parentNode() { return this.parentElement; }
    get childNodes() { return this.children; }
    get nextElementSibling() { const list = this.parentElement?.children || []; return list[list.indexOf(this) + 1]; }
    get classList() {
      return {
        contains: (name: string) => this.className.split(' ').includes(name),
        add: (...names: string[]) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' ').trim(); },
        remove: (...names: string[]) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); }
      };
    }
    append(...children: Element[]) { for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); } }
    appendChild(child: Element) { this.append(child); return child; }
    prepend(child: Element) { this.insertBefore(child, this.children[0]); }
    after(child: Element) { this.parentElement.insertBefore(child, this.nextElementSibling); }
    insertBefore(child: Element, before?: Element) {
      if (child === before) return child;
      child.remove(); child.parentElement = this;
      const index = before ? this.children.indexOf(before) : -1;
      this.children.splice(index < 0 ? this.children.length : index, 0, child); return child;
    }
    remove() {
      if (this.parentElement) { const list = this.parentElement.children; list.splice(list.indexOf(this), 1); this.parentElement = null; }
    }
    replaceChildren(...children: Element[]) { for (const child of [...this.children]) child.remove(); this.append(...children); }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    removeAttribute(key: string) { this.attributes.delete(key); }
    matches(selector: string) { return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : this.tagName === selector; }
    querySelectorAll(selector: string): Element[] {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector: string): Element | null { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
    contains(child: Element): boolean { return child === this || this.children.some(node => node.contains(child)); }
    cloneNode(deep = false) {
      const clone = new Element(this.tagName); clone.className = this.className;
      clone.attributes = new Map(this.attributes); clone.dataset = { ...this.dataset };
      if (deep) clone.append(...this.children.map(child => child.cloneNode(true))); return clone;
    }
    addEventListener(type: string, fn: Function) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type: string, fn: Function) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(event: { type: string }) { for (const fn of this.listeners.get(event.type) || []) fn(event); }
    fire(type: string, properties = {}) { this.dispatchEvent({ type, ...properties }); }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { const left = Math.max(0, this.parentElement?.children.indexOf(this) || 0) * 25; return { left, top: 0, right: left + 20, bottom: 16, width: 20, height: 16 }; }
    animate() {
      animationCount++; let finish: () => void;
      const finished = new Promise<void>(resolve => { finish = resolve; });
      return { finished, cancel() { cancelledAnimations++; finish(); } };
    }
  }
  const document: any = { activeElement: null,
    createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag),
    querySelector: () => null,
    defaultView: {
      Event: class { type: string; constructor(type: string) { this.type = type; } },
      requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; },
      cancelAnimationFrame(id) { frames.delete(id); }
    }
  };
  const host = new Element('document');
  for (const method of ['addEventListener', 'removeEventListener', 'dispatchEvent']) document[method] = host[method].bind(host);
  return { document, host, Element, frames, get animationCount() { return animationCount; }, get cancelledAnimations() { return cancelledAnimations; },
    frame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); } };
}
