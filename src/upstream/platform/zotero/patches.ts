import { replaceOwnedProperty } from '../../utils/ownedResource.ts';
import { requireItemsView } from '../../utils/zoteroPane.ts';
import type { Cleanup } from '../../../types/addon.ts';

const sharedPatches = new WeakMap<object, Map<string, { users: number; release: Cleanup }>>();

function acquirePatch(target: object, key: string, install: () => Cleanup): Cleanup {
  let entries = sharedPatches.get(target);
  if (!entries) sharedPatches.set(target, entries = new Map());
  let entry = entries.get(key);
  if (!entry) entries.set(key, entry = { users: 0, release: install() });
  entry.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry.users === 0) {
      entries.delete(key);
      return entry.release();
    }
  };
}

export function patchAll(): Cleanup {
  const itemsView = requireItemsView();
  const prototype = Zotero.CollectionTreeRow.prototype;
  addon.data.patch.getItems ??= { data: [] };
  addon.data.patch._displayColumnPickerMenu ??= { data: [] };
  const releaseItems = acquirePatch(prototype, 'getItems', () => {
    let active = true;
    const original = prototype.getItems;
    const restore = replaceOwnedProperty(prototype, 'getItems', async function (options: { unfiltered?: boolean } = {}) {
      let items = await original.call(this, options);
      if (active && addon.data.alive && !options.unfiltered) {
        for (const filter of [...addon.data.patch.getItems.data]) {
          if (!active || !addon.data.alive) break;
          items = await filter(items, this);
        }
      }
      return items;
    });
    return () => { active = false; restore(); };
  });
  const releaseMenu = acquirePatch(itemsView, '_displayColumnPickerMenu', () => {
    let active = true;
    let timer: number | undefined;
    const ownerWindow = window;
    const original = itemsView._displayColumnPickerMenu;
    const restore = replaceOwnedProperty(itemsView, '_displayColumnPickerMenu', function (...args) {
      const result = original.apply(this, args);
      if (active && addon.data.alive && timer === undefined) {
        timer = ownerWindow.setTimeout(() => {
          timer = undefined;
          if (active && addon.data.alive) {
            for (const callback of addon.data.patch._displayColumnPickerMenu.data) callback();
          }
        }, 2);
      }
      return result;
    });
    return () => {
      active = false;
      if (timer !== undefined) ownerWindow.clearTimeout(timer);
      restore();
    };
  });
  return () => { releaseMenu(); releaseItems(); };
}
