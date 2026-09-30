import { getString, getPreferenceOptionLabel } from "../upstream/utils/locale.ts";
import { spElement, spSelect, spSelectOptions } from "./ui.ts";
import { spColorHex, type SettingDef } from "../core/settingsSchema.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later

type SettingInput = HTMLInputElement | HTMLTextAreaElement | XULMenuListElement;
export interface SettingControl {
  input: SettingInput;
  read(): string | boolean;
  write(value: unknown): void;
  setDisabled(disabled: boolean): void;
  onChange(listener: () => unknown): void;
}

export function spSettingLabel(setting: Pick<SettingDef, "label" | "labelArgs">): string {
  if (!setting.labelArgs) return getString(setting.label);
  const args = Object.fromEntries(Object.entries(setting.labelArgs)
    .map(([name, value]) => [name, value.startsWith("ui-") ? getString(value) : value]));
  return getString(setting.label, { args });
}

export function spChoiceLabel(value: string, label?: string): string {
  if (label === undefined) return getPreferenceOptionLabel(value);
  return label.startsWith("ui-") ? getString(label) : label;
}

function plainControl(input: SettingInput, label: string, read: () => string | boolean, write: (value: unknown) => void): SettingControl {
  input.setAttribute("aria-label", label);
  return {
    input, read, write,
    setDisabled(disabled) { input.disabled = disabled; },
    onChange(listener) { input.addEventListener("change", listener); }
  };
}

function colorControl(doc: Document, parent: Element, setting: SettingDef, label: string): SettingControl {
  const create = spElement.bind(null, doc);
  const wrap = create("span", parent); wrap.className = "sp-color";
  const color = create("input", wrap); color.type = "color"; color.setAttribute("aria-label", label);
  const shown = create("span", wrap); shown.className = "sp-color-value";
  let auto: HTMLInputElement | null = null;
  if (setting.allowAuto) {
    const autoLabel = create("label", wrap); autoLabel.className = "sp-check";
    auto = create("input", autoLabel); auto.type = "checkbox";
    create("span", autoLabel, getString("ui-color-auto"));
  }
  let disabled = false;
  const sync = () => {
    const isAuto = Boolean(auto?.checked);
    shown.textContent = isAuto ? getString("ui-color-auto") : color.value;
    color.disabled = disabled || isAuto;
    if (auto) auto.disabled = disabled;
  };
  color.addEventListener("input", sync);
  auto?.addEventListener("change", sync);
  return {
    input: color,
    read: () => auto?.checked ? "auto" : color.value,
    write(value) {
      if (auto) auto.checked = value === "auto";
      color.value = spColorHex(value === "auto" ? color.value : value);
      sync();
    },
    setDisabled(next) { disabled = next; sync(); },
    onChange(listener) { color.addEventListener("change", listener); auto?.addEventListener("change", listener); }
  };
}

export function spSettingControl(doc: Document, parent: Element, setting: SettingDef): SettingControl {
  const create = spElement.bind(null, doc);
  const label = spSettingLabel(setting);
  switch (setting.kind) {
    case "toggle": {
      const input = create("input", parent); input.type = "checkbox";
      return plainControl(input, label, () => input.checked, value => { input.checked = Boolean(value); });
    }
    case "choice": {
      const select = spSelect(doc, parent);
      spSelectOptions(select, (setting.choices ?? []).map(([value, text]) => [value, spChoiceLabel(value, text)] as [string, string]));
      return plainControl(select, label, () => select.value, value => { select.value = String(value ?? ""); });
    }
    case "code": {
      const area = create("textarea", parent); area.className = "sp-code"; area.rows = 4; area.spellcheck = false;
      return plainControl(area, label, () => area.value, value => { area.value = String(value ?? ""); });
    }
    case "color":
      return colorControl(doc, parent, setting, label);
    default: {
      const input = create("input", parent);
      input.type = setting.kind === "secret" ? "password" : setting.kind === "number" ? "number" : "text";
      if (setting.kind === "number") {
        input.className = "sp-number";
        input.step = setting.step === undefined ? "any" : String(setting.step);
        if (setting.min !== undefined) input.min = String(setting.min);
        if (setting.max !== undefined) input.max = String(setting.max);
      }
      if (setting.kind === "secret") input.autocomplete = "off";
      if (setting.kind === "list") input.className = "sp-wide";
      return plainControl(input, label, () => input.value, value => { input.value = String(value ?? ""); });
    }
  }
}
