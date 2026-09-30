import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse, Message } from '@fluent/syntax';
import { spFeatureDefinitions, spFeatureGroups, spInactivePreferences } from '../src/core/features.ts';
import { spFeatureSettings, spGroupSettings, spStatePreferences, spSettingValue, spColorHex, spSettingVisible, type SettingDef } from '../src/core/settingsSchema.ts';

const prefix = 'extensions.zotero.stylepersonal.';
async function defaults() {
  const values = new Map<string, unknown>();
  vm.runInNewContext(await fs.readFile(new URL('../addon/prefs.js', import.meta.url), 'utf8'),
    { pref: (key: string, value: unknown) => values.set(key.slice(prefix.length), value) });
  return values;
}
const allSettings = (): SettingDef[] => [...Object.values(spFeatureSettings).flatMap(spec => spec.settings), ...Object.values(spGroupSettings).flat()];

test('every default preference has exactly one place', async () => {
  const values = await defaults();
  const homes = new Map<string, string[]>();
  const add = (key: string, home: string) => homes.set(key, [...(homes.get(key) ?? []), home]);
  add('enable', 'master switch');
  for (const [key] of spFeatureDefinitions) add(`function.${key}.enable`, 'feature switch');
  for (const setting of allSettings()) if (setting.kind !== 'note') add(setting.key, 'settings page');
  for (const key of spStatePreferences) add(key, 'managed elsewhere');
  for (const key of spInactivePreferences) add(key, 'inactive');
  for (const key of values.keys()) assert.equal(homes.get(key)?.length, 1, `${key}: ${homes.get(key)?.join(', ') ?? 'nowhere'}`);
  for (const key of homes.keys()) assert.ok(values.has(key), `${key} has no default in prefs.js`);
});

test('schema entries match known features, groups and default values', async () => {
  const values = await defaults();
  const features = new Set(spFeatureDefinitions.map(([key]) => key));
  const groups = new Set(spFeatureGroups.map(([id]) => id));
  for (const key of Object.keys(spFeatureSettings)) assert.ok(features.has(key), key);
  for (const key of Object.keys(spGroupSettings)) assert.ok(groups.has(key), key);
  for (const setting of allSettings()) {
    if (setting.kind === 'note') continue;
    const value = values.get(setting.key);
    if (setting.kind === 'toggle') assert.equal(typeof value, 'boolean', setting.key);
    if (setting.kind === 'choice') assert.ok(setting.choices?.some(([choice]) => choice === String(value)), `${setting.key}: ${value}`);
    if (setting.kind === 'number') assert.doesNotThrow(() => spSettingValue(setting, value, value), setting.key);
    if (setting.kind === 'color') assert.ok(value === 'auto' ? setting.allowAuto : spColorHex(value) === String(value).toLowerCase(), `${setting.key}: ${value}`);
    if (setting.visibleWhen) {
      const owner = allSettings().find(other => other.key === setting.visibleWhen!.key);
      assert.ok(owner?.choices?.some(([choice]) => choice === setting.visibleWhen!.equals), setting.key);
    }
  }
});

test('every setting label and option label exists in English', async () => {
  const resource = parse(await fs.readFile(new URL('../addon/locale/en-US/stylepersonal-addon.ftl', import.meta.url), 'utf8'), { withSpans: false });
  const ids = new Set(resource.body.filter((entry): entry is Message => entry instanceof Message).map(entry => entry.id.name.replace(/^stylepersonal-/, '')));
  for (const setting of allSettings()) {
    assert.ok(ids.has(setting.label), setting.label);
    for (const [, label] of setting.choices ?? []) if (label?.startsWith('ui-')) assert.ok(ids.has(label), label);
    for (const arg of Object.values(setting.labelArgs ?? {})) if (arg.startsWith('ui-')) assert.ok(ids.has(arg), arg);
  }
});

test('setting values keep the type stored in prefs.js', () => {
  assert.equal(spSettingValue({ kind: 'number' }, ' 20 ', '15'), '20');
  assert.equal(spSettingValue({ kind: 'number' }, '12', 10), 12);
  assert.equal(spSettingValue({ kind: 'number' }, '', ''), '');
  assert.throws(() => spSettingValue({ kind: 'number' }, '', 10), { message: 'ui-error-invalid-number' });
  assert.throws(() => spSettingValue({ kind: 'number' }, '', '15'), { message: 'ui-error-invalid-number' });
  assert.throws(() => spSettingValue({ kind: 'number' }, 'abc', '15'), { message: 'ui-error-invalid-number' });
  assert.throws(() => spSettingValue({ kind: 'number', min: 0, max: 1 }, '1.5', '1'), { message: 'ui-error-invalid-number' });
  assert.equal(spSettingValue({ kind: 'toggle' }, 1, false), true);
  assert.equal(spSettingValue({ kind: 'text' }, undefined, ''), '');
  assert.equal(spSettingValue({ kind: 'color' }, 'auto', 'auto'), 'auto');
});

test('settings read only at startup are marked as needing a restart', () => {
  assert.deepEqual(allSettings().filter(setting => setting.restart).map(setting => setting.key).sort(), [
    'addTags.shortcut', 'readingProgress.recordingEnabled', 'recordInterval', 'relatedItems.link.shortcut',
    'titleTranslate.shortcut', 'toogleSidebar.left.shortcut', 'toogleSidebar.right.shortcut']);
});

test('colors are normalised for the native color picker', () => {
  assert.equal(spColorHex('#FFC6D3'), '#ffc6d3');
  assert.equal(spColorHex('#AbC'), '#aabbcc');
  assert.equal(spColorHex('auto'), '#000000');
  assert.equal(spColorHex(undefined), '#000000');
});

test('conditional settings follow the preference they depend on', () => {
  const setting = { visibleWhen: { key: 'publicationTagsColumn.source', equals: 'garden' } };
  assert.equal(spSettingVisible(setting, () => 'garden'), true);
  assert.equal(spSettingVisible(setting, () => 'easyscholar'), false);
  assert.equal(spSettingVisible({}, () => undefined), true);
});
