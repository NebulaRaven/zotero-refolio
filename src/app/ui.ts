import { getString } from "../upstream/utils/locale.ts";
import { config } from "../upstream/config.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later

export function spElement<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, parent?: Element | null, text = ""): HTMLElementTagNameMap[K] {
  const element = doc.createElementNS("http://www.w3.org/1999/xhtml", tag) as HTMLElementTagNameMap[K];
  if (text) element.textContent = text;
  parent?.append(element as Node);
  return element;
}

export function spSelectOptions(select: HTMLSelectElement, choices: ReadonlyArray<readonly [string, string]>, value?: string | number) {
  const options = choices.map(([key, label]) => {
    const option = spElement(select.ownerDocument, "option", null, label);
    option.value = key;
    return option;
  });
  select.replaceChildren(...options);
  if (value !== undefined) select.value = String(value);
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
