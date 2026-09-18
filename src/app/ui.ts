import { getString } from "../upstream/utils/locale.ts";
import { config } from "../upstream/config.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later

export function spElement<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, parent?: Element | null, text = ""): HTMLElementTagNameMap[K] {
  const element = doc.createElementNS("http://www.w3.org/1999/xhtml", tag) as HTMLElementTagNameMap[K];
  if (text) element.textContent = text;
  parent?.append(element as Node);
  return element;
}

export function spSelect(doc: Document, parent: Element): XULMenuListElement {
  const select = doc.createXULElement("menulist") as XULMenuListElement;
  select.setAttribute("native", "true");
  select.classList.add("sp-select");
  select.append(doc.createXULElement("menupopup"));
  select.addEventListener("command", event => {
    const option = event.target as Element;
    if (option.localName === "menuitem") select.value = option.getAttribute("value");
    select.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  });
  parent.append(select);
  return select;
}

export function spSelectOptions(select: XULMenuListElement, choices: ReadonlyArray<readonly [string, string]>, value?: string | number) {
  const options = choices.map(([key, label]) => {
    const option = select.ownerDocument.createXULElement("menuitem");
    option.setAttribute("label", label);
    option.setAttribute("value", key);
    return option;
  });
  select.querySelector("menupopup").replaceChildren(...options);
  select.value = String(value ?? choices[0]?.[0] ?? "");
}

export function spGenealogyOptions(): Array<[string, string]> {
  return [["doctoral", getString("ui-doctoral-supervision")], ["general", getString("ui-teacher-student")]];
}

export function spLoadUIStyles(container: HTMLElement) {
  container.classList.add("stylepersonal-ui");
  const sheet = spElement(container.ownerDocument, "link", container);
  sheet.rel = "stylesheet";
  sheet.href = `chrome://${config.addonRef}/content/stylepersonal.css`;
  return sheet;
}
