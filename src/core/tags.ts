import type { TagHost } from "./models.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spTagWithin(tag: string, parent: string, separator = "/") {
  return tag === parent || tag.startsWith(parent + separator);
}

export function spRenamePlan(tags: Iterable<string>, oldName: string, newName: string, separator = "/") {
  if (!oldName || typeof newName !== "string" || !newName.trim()) {
    throw new Error("ui-error-empty-tag");
  }
  newName = newName.trim();
  if (oldName === newName) return [];
  const plan = [...new Set(tags)].filter(tag => spTagWithin(tag, oldName, separator))
    .map(from => ({ from, to: newName + from.slice(oldName.length) }));
  const existing = new Set(tags);
  for (const { to } of plan) {
    if (existing.has(to)) throw Object.assign(new Error("ui-error-tag-exists"), { args: { tag: to } });
  }
  return plan;
}

export async function spRenameTags(zotero: { Libraries: TagHost["Libraries"]; Tags: Pick<TagHost["Tags"], "getAll" | "rename"> }, libraryID: number, oldName: string, newName: string, separator = "/") {
  const library = zotero.Libraries.get(libraryID);
  if (!library || !library.editable) throw new Error("ui-error-library-read-only");
  // Zotero.Tags.rename owns its transaction. An outer executeTransaction deadlocks.
  const tags = (await zotero.Tags.getAll(libraryID)).map(tag => tag.tag);
  const plan = spRenamePlan(tags, oldName, newName, separator);
  const completed = [];
  try {
    for (const step of plan) {
      await zotero.Tags.rename(libraryID, step.from, step.to);
      completed.push(step);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const step of completed.reverse()) {
      try { await zotero.Tags.rename(libraryID, step.to, step.from); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) throw new Error("ui-error-tag-restore");
    throw error;
  }
  return plan.length;
}

export async function spRemoveTags(zotero: { Libraries: TagHost["Libraries"]; Tags: Pick<TagHost["Tags"], "getAll" | "getID" | "removeFromLibrary"> }, libraryID: number, parent: string, separator = "/") {
  const library = zotero.Libraries.get(libraryID);
  if (!library || !library.editable) throw new Error("ui-error-library-read-only");
  const ids = (await zotero.Tags.getAll(libraryID))
    .filter(tag => spTagWithin(tag.tag, parent, separator))
    .map(tag => zotero.Tags.getID(tag.tag)).filter((id): id is number => typeof id === "number" && Number.isInteger(id));
  if (ids.length) await zotero.Tags.removeFromLibrary(libraryID, ids);
}
