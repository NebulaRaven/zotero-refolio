import { config } from "../config.ts";

export interface LocaleOptions {
  branch?: string;
  args?: Record<string, string | number>;
}

export function initLocale() {
  const Localizer = typeof Localization === "undefined" ? ztoolkit.getGlobal("Localization") : Localization;
  addon.data.locale = {
    current: new Localizer([`${config.addonRef}-addon.ftl`], true, undefined,
      [...new Set([Zotero.locale, "en-US"])])
  };
}

export function getString(key: string, options: string | LocaleOptions = {}): string {
  const { branch, args } = typeof options === "string" ? { branch: options } : options;
  const id = `${config.addonRef}-${key}`;
  const message = addon.data.locale?.current.formatMessagesSync([{ id, args }])[0];
  const value = branch ? message?.attributes?.find(attribute => attribute.name === branch)?.value : message?.value;
  return value == null ? id : value.replace(/\\n/g, "\n");
}

export function getErrorMessage(error: unknown): string {
  const detail = error as { name?: string; message?: string; args?: LocaleOptions["args"] } | null;
  if (detail?.message?.startsWith("ui-error-")) return getString(detail.message, { args: detail.args });
  if (detail?.name === "SyntaxError") return getString("ui-error-invalid-json");
  return String(detail?.message || error);
}

const optionMessages: Record<string, string> = {
  absolute: "ui-option-absolute", relative: "ui-option-relative", system: "ui-system-time-zone",
  left: "ui-option-left", right: "ui-option-right", center: "ui-option-center",
  bar: "ui-option-bar", line: "ui-option-line", auto: "ui-automatic",
  extra: "ui-extra-field", tag: "ui-tag", tags: "ui-mode-tags",
  horizontal: "ui-horizontal", vertical: "ui-vertical",
  note: "ui-mode-notes", author: "ui-mode-authors", citations: "ui-mode-citations",
  genealogy: "ui-mode-genealogy", sciif: "ui-rank-if",
  sciif5: "ui-rank-five-year-if", "综合影响因子": "ui-rank-comprehensive-if", "复合影响因子": "ui-rank-composite-if"
};

export function getPreferenceOptionLabel(value: unknown): string {
  const key = String(value);
  if (key === "easyscholar") return "EasyScholar";
  if (key === "garden") return "Garden";
  return optionMessages[key] ? getString(optionMessages[key]) : key;
}
