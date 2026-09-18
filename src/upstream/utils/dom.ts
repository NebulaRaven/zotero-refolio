  // src/utils/dom.ts
  export function getNodes<T extends Node>(nodes: Iterable<T | null> | ArrayLike<T | null>): T[] {
    return Array.from(nodes).filter(node => node !== null);
  }
  export function isElement(value: unknown): value is HTMLElement {
    return typeof value === "object" && value !== null && 'nodeType' in value && value.nodeType === 1;
  }
  export function getElements<T extends HTMLElement = HTMLElement>(nodes: Iterable<Node> | ArrayLike<Node>): T[] {
    return getNodes(nodes).filter(isElement) as T[];
  }
  export function removeElementsExcept(nodes, keep?) {
    const removed = [];
    for (const element of getElements(nodes)) {
      if (element === keep) {
        continue;
      }
      element.remove();
      removed.push(element);
    }
    return removed;
  }
