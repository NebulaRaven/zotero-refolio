  // src/utils/date.ts
  export var DAYJS_LOCALES = [["zh-tw", "zh-tw"], ["zh-hant", "zh-tw"], ["zh", "zh-cn"], ["it", "it"], ["ru", "ru"]];
  export function getDayjsLocale(locale) {
    const normalized = locale.toLowerCase();
    return DAYJS_LOCALES.find(([prefix]) => normalized.startsWith(prefix))?.[1] || "en";
  }

