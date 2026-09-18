import { readFileSync, existsSync } from 'node:fs';
import { FluentBundle, FluentResource } from '@fluent/bundle';
import vm from 'node:vm';
import { script } from './source.mts';

export function testLocalizer(locales = ['en-US'], resources = ['stylepersonal-addon.ftl']) {
  const bundles = locales.map(locale => {
    const bundle = new FluentBundle(locale, { useIsolating: false });
    for (const resource of resources) {
      const file = new URL(`../addon/locale/${locale}/${resource}`, import.meta.url);
      if (!existsSync(file)) continue;
      const errors = bundle.addResource(new FluentResource(readFileSync(file, 'utf8')));
      if (errors.length) throw new AggregateError(errors, `Invalid translations: ${file}`);
    }
    return bundle;
  });
  return {
    formatMessagesSync(keys: Array<{ id: string; args?: Record<string, string | number> }>) {
      return keys.map(({ id, args }) => {
        for (const bundle of bundles) {
          const message = bundle.getMessage(id);
          if (!message) continue;
          const errors: Error[] = [];
          const value = message.value === null ? null : bundle.formatPattern(message.value, args, errors);
          const attributes = Object.entries(message.attributes).map(([name, pattern]) => ({ name, value: bundle.formatPattern(pattern, args, errors) }));
          if (errors.length) throw new AggregateError(errors, id);
          return { value, attributes };
        }
        return null;
      });
    }
  };
}

const english = testLocalizer();
export function testGetString(key: string, options: { args?: Record<string, string | number> } = {}) {
  const message = english.formatMessagesSync([{ id: `stylepersonal-${key}`, args: options.args }])[0];
  if (message?.value == null) throw new Error(`Missing English message: ${key}`);
  return message.value.replace(/\\n/g, '\n');
}

const localeRuntime = await script(new URL('../src/upstream/utils/locale.ts', import.meta.url));
export function testLocaleAPI(locale = 'en-US') {
  const context: vm.Context = {
    config: { addonRef: 'stylepersonal' },
    addon: { data: { locale: { current: testLocalizer([locale]) } } }
  };
  vm.runInNewContext(localeRuntime, context);
  return context;
}
const englishAPI = testLocaleAPI();
export const testGetErrorMessage = englishAPI.getErrorMessage;
export const testGetPreferenceOptionLabel = englishAPI.getPreferenceOptionLabel;
