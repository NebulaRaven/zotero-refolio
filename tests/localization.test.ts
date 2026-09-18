import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse, Message, Term } from '@fluent/syntax';
import { script } from './source.mts';
import { testLocalizer, testLocaleAPI } from './localization.ts';
import { spFeatureDefinitions, spFeatureGroups, spInactivePreferences } from '../src/core/features.ts';
import { spManualRankFields } from '../src/core/manualRanks.ts';
import { spFilterGraph } from '../src/core/graph.ts';
import { domFixture } from './dom-fixture.ts';

const directory = new URL('../addon/locale/', import.meta.url);
const locales = ['en-US', 'zh-CN', 'zh-TW', 'it-IT', 'ru-RU'];
const variables = entry => [...new Set([...JSON.stringify(entry).matchAll(/"type":"VariableReference","id":\{"type":"Identifier","name":"([^"]+)"/g)].map(match => match[1]))].sort();
async function messages(locale: string, filename = 'stylepersonal-addon.ftl') {
  const resource = parse(await fs.readFile(new URL(`${locale}/${filename}`, directory), 'utf8'), { withSpans: false });
  return new Map(resource.body.filter((entry): entry is Message => entry instanceof Message).map(entry => [entry.id.name, entry]));
}

test('all shipped Fluent resources parse without duplicate message IDs', async () => {
  for (const locale of await fs.readdir(directory)) {
    for (const filename of await fs.readdir(new URL(`${locale}/`, directory))) {
      if (!filename.endsWith('.ftl')) continue;
      const resource = parse(await fs.readFile(new URL(`${locale}/${filename}`, directory), 'utf8'), { withSpans: false });
      assert.equal(resource.body.filter(entry => entry.type === 'Junk').length, 0, `${locale}/${filename}`);
      const ids = resource.body.filter((entry): entry is Message | Term => entry instanceof Message || entry instanceof Term).map(entry => entry.id.name);
      assert.equal(new Set(ids).size, ids.length, `${locale}/${filename}: duplicate IDs`);
    }
  }
});

test('every shipped language covers all messages, attributes and variables without fallback', async () => {
  for (const filename of await fs.readdir(new URL('en-US/', directory))) {
    if (!filename.endsWith('.ftl')) continue;
    const english = await messages('en-US', filename);
    for (const locale of locales) {
      const translated = await messages(locale, filename);
      assert.deepEqual([...translated.keys()].sort(), [...english.keys()].sort(), `${locale}/${filename}: message coverage`);
      const localizer = testLocalizer([locale], [filename]);
      for (const [id, entry] of english) {
        const translation = translated.get(id)!;
        assert.deepEqual(variables(translation), variables(entry), `${locale}: ${id}: variables`);
        assert.equal(translation.value === null, entry.value === null, `${locale}: ${id}: value`);
        assert.deepEqual(translation.attributes.map(attr => attr.id.name).sort(), entry.attributes.map(attr => attr.id.name).sort(), `${locale}: ${id}: attributes`);
        const args = Object.fromEntries(variables(entry).map(name => [name, 2]));
        const formatted = localizer.formatMessagesSync([{ id, args }])[0];
        assert.ok(formatted, `${locale}: ${id}`);
        if (entry.value) assert.ok(formatted.value?.trim(), `${locale}: ${id}: empty value`);
        for (const attribute of formatted.attributes) assert.ok(attribute.value.trim(), `${locale}: ${id}.${attribute.name}: empty attribute`);
      }
    }
  }
});

test('runtime controls and validation errors reference complete translation entries', async () => {
  const english = await messages('en-US');
  for (const key of [...spFeatureGroups.map(group => group[1]), ...spFeatureDefinitions.map(feature => feature[2]), ...spManualRankFields.map(field => field[1])]) {
    assert.ok(english.has(`stylepersonal-${key}`), key);
  }
  for (const dir of ['app', 'core', 'upstream']) {
    const base = new URL(`../src/${dir}/`, import.meta.url);
    for (const file of await fs.readdir(base, { recursive: true })) {
      if (!file.endsWith('.ts')) continue;
      const text = await fs.readFile(new URL(file.replaceAll('\\', '/'), base), 'utf8');
      assert.ok(!/\bspText\(/.test(text), `${file}: inline language switch`);
      for (const match of text.matchAll(/["']((?:ui-|pref-)[\w-]+)["']/g)) {
        if (!match[1].endsWith('-')) assert.ok(english.has(`stylepersonal-${match[1]}`), `${file}: ${match[1]}`);
      }
    }
  }
});

test('production localization follows Zotero, falls back to English and reads Fluent attributes', async () => {
  const source = await script(new URL('../src/upstream/utils/locale.ts', import.meta.url));
  for (const [locale, title, mode] of [
    ['en-US', 'Journal settings', 'IF mode'], ['zh-CN', '期刊设置', 'IF 方式'],
    ['zh-TW', '期刊設定', 'IF 模式'], ['it-IT', 'Impostazioni delle riviste', 'Modalità IF'],
    ['ru-RU', 'Настройки журналов', 'Режим поля IF'], ['fr-FR', 'Journal settings', 'IF mode']
  ]) {
    let requested: string[] = [];
    const ctx: vm.Context = { config: { addonRef: 'stylepersonal' }, Zotero: { locale }, addon: { data: {} },
      Localization: class { constructor(resources: string[], sync: boolean, _registry: unknown, locales: string[]) {
        assert.equal(sync, true); requested = locales; return testLocalizer(locales, resources);
      } } };
    vm.runInNewContext(source, ctx); ctx.initLocale();
    assert.deepEqual([...requested], locale === 'en-US' ? ['en-US'] : [locale, 'en-US']);
    assert.equal(ctx.getString('ui-journal-settings'), title);
    assert.equal(ctx.getString('ui-field-mode', { args: { field: 'IF' } }), mode);
    ctx.addon.data.locale.current = testLocalizer(['en-US'], ['stylepersonal-preferences.ftl']);
    assert.equal(ctx.getString('Merge-Annotations', 'label'), 'Merge Annotations');
  }
});

test('settings render translated labels and preserve stored option values in all five languages', async () => {
  const defaults = new Map<string, string | number | boolean>();
  const prefix = 'extensions.zotero.stylepersonal';
  vm.runInNewContext(await fs.readFile(new URL('../addon/prefs.js', import.meta.url), 'utf8'), { pref: (key, value) => defaults.set(key, value) });
  const sources = await Promise.all(['app/ui.ts', 'upstream/features/preferences/preferenceWindow.ts', 'app/preferences.ts'].map(file => script(new URL(`../src/${file}`, import.meta.url))));
  for (const locale of locales) {
    const dom = domFixture(), container = new dom.Element();
    const win: any = new dom.Element('window'); win.document = dom.document; dom.document.defaultView = win;
    dom.document.querySelector = selector => selector === '#stylepersonal-settings' ? container : null;
    const api = testLocaleAPI(locale), saved = [];
    const context: vm.Context = {
      ...api, addon: { data: {}, api: {} }, config: { prefsPrefix: prefix },
      getPref: key => defaults.get(`${prefix}.${key}`), setPref: (key, value) => saved.push([key, value]),
      readDefaultPreferences: () => defaults, spFeatureDefinitions, spFeatureGroups, spInactivePreferences,
      spRenderManualRanks: () => () => {}, spFilterGraph,
      Zotero: { Prefs: { registerObserver() { return 1; }, unregisterObserver() {} } }
    };
    vm.createContext(context);
    for (const source of sources) vm.runInContext(source, context);
    await context.registerPrefsScripts(win);
    const descendants = element => element.children.flatMap(child => [child, ...descendants(child)]);
    const all = descendants(container);
    const inputs = all.filter(element => element.dataset.pref);
    for (const input of inputs) {
      const label = input.parentElement.children.find(element => element.tagName === 'span')?.textContent;
      assert.ok(label && !label.startsWith('stylepersonal-') && label !== input.dataset.pref, `${locale}: ${input.dataset.pref}: ${label}`);
    }
    const graphMode = inputs.find(input => input.dataset.pref === 'graphView.mode')!;
    assert.equal(graphMode.value, 'related');
    assert.equal(graphMode.children.find(option => option.value === 'note').textContent, api.getString('ui-mode-notes'));
    assert.equal(graphMode.children.find(option => option.value === 'default').textContent, api.getString('ui-mode-links'));
    for (const value of ['note', 'default']) {
      graphMode.value = value;
      await [...graphMode.listeners.get('change')!][0]();
      assert.equal(saved.at(-1)[1], value);
    }
    const minYear = inputs.find(input => input.dataset.pref === 'graphView.minYear')!;
    minYear.value = 'invalid';
    await [...minYear.listeners.get('change')!][0]();
    assert.equal(container.children.find(element => element.getAttribute('role') === 'status').textContent, api.getString('ui-error-invalid-year-range'));
    context.addon.data.prefs.release();
  }
});

test('validation messages and supplied values are formatted in the selected language', () => {
  for (const locale of locales) {
    const api = testLocaleAPI(locale);
    assert.equal(api.getErrorMessage(new Error('ui-error-invalid-doi')), api.getString('ui-error-invalid-doi'));
    assert.equal(api.getErrorMessage(new SyntaxError('JSON parser details')), api.getString('ui-error-invalid-json'));
    const message = api.getErrorMessage(Object.assign(new Error('ui-error-tag-exists'), { args: { tag: '#Example' } }));
    assert.ok(message.includes('#Example') && !message.startsWith('ui-error-'));
    assert.equal(api.getErrorMessage(new Error('HTTP 503')), 'HTTP 503');
  }
});
