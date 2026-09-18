import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import type { GraphView } from '../upstream/features/collections/graphView.ts';
import { spElement,spGenealogyOptions,spSelectOptions } from "./ui.ts";
import { spDeleteManualGenealogy,spReadManualGenealogy,spRestoreManualGenealogy,spSaveManualGenealogy } from "../core/manualGenealogy.ts";
import { getPref,setPref } from "../upstream/utils/prefs.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spBuildManualGenealogyControls(view: GraphView, parent: HTMLElement, showManual) {
  const doc = parent.ownerDocument;
  const create = spElement.bind(null, doc);
  const section = create("details", parent);
  create("summary", section, getString("ui-manual-relationships"));
  create("p", section, getString("ui-select-an-existing-person-or-create-one-then-save")).className = "sp-help";
  const message = create("p", section); message.setAttribute("role", "status");
  const form = create("div", section); form.className = "sp-genealogy-editor";
  let editing = "", removed;
  const read = () => spReadManualGenealogy(getPref("genealogy.manualData"));
  const people = () => {
    const result = { ...read().people };
    for (const [id, person] of Object.entries(view.genealogyData?.nodes || {})) if (id.startsWith("Q") || !result[id]) result[id] = {label: person.label || id, description: person.description || ""};
    return result;
  };
  const field = (label, tag = "input") => {
    const row = create("label", form, label), input = create(tag, row); input.setAttribute("aria-label", label); return input;
  };
  const personFields = (role, nameLabel, descriptionLabel) => {
    const choice = field(role, "select"), name = field(nameLabel), description = field(descriptionLabel);
    const fill = value => {
      const options = people();
      const choices = Object.entries(options).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([id, person]): [string, string] =>
        [id, `${person.label}${person.description ? ` · ${person.description}` : ""} [${id.startsWith("Q") ? id : id.slice(-6)}]`]);
      spSelectOptions(choice, [["", getString("ui-new-person")], ...choices], options[value] ? value : "");
      update();
    };
    const update = () => {
      const selected = people()[choice.value];
      name.value = selected?.label || ""; description.value = selected?.description || "";
      name.disabled = description.disabled = choice.value.startsWith("Q");
    };
    choice.addEventListener("change", update);
    const value = () => ({ id: choice.value || undefined, label: name.value, description: description.value });
    const refresh = () => {
      const draft = value(); fill(choice.value);
      if (!name.disabled) { name.value = draft.label; description.value = draft.description; }
    };
    return { fill, value, refresh };
  };
  const mentor = personFields(getString("ui-mentor-identity"), getString("ui-mentor-name"), getString("ui-mentor-description-optional"));
  const student = personFields(getString("ui-student-identity"), getString("ui-student-name"), getString("ui-student-description-optional"));
  const kind = field(getString("ui-manual-relationship-type"), "select");
  spSelectOptions(kind, spGenealogyOptions());
  const source = field(getString("ui-source-url-optional")); source.type = "url";
  const note = field(getString("ui-source-or-notes-optional"), "textarea"); note.rows = 2;
  const actions = create("div", section); actions.className = "sp-genealogy-row";
  const save = create("button", actions, getString("ui-add-relationship")); save.type = "button";
  const cancel = create("button", actions, getString("ui-new-cancel-editing")); cancel.type = "button";
  const undo = create("button", actions, getString("ui-undo-deletion")); undo.type = "button"; undo.hidden = true;
  const list = create("div", section);
  const run = async fn => { try { await fn(); } catch (error) { message.textContent = getErrorMessage(error); } };
  const reset = (person = "") => {
    editing = ""; mentor.fill(person); student.fill(""); source.value = note.value = "";
    kind.value = view.genealogyData?.kind || "doctoral"; save.textContent = getString("ui-add-relationship");
  };
  const edit = id => run(() => {
    const record = read().relations[id]; if (!record) throw new Error(getString("ui-record-no-longer-exists"));
    editing = id; mentor.fill(record.mentor); student.fill(record.student); kind.value = record.kind;
    source.value = record.sourceURL; note.value = record.note;
    save.textContent = getString("ui-save-changes"); section.open = true; message.textContent = "";
    form.scrollIntoView({ block: "nearest" });
  });
  const renderList = () => {
    list.replaceChildren(); const data = read();
    create("strong", list, `${getString("ui-saved-relationships")} · ${Object.keys(data.relations).length}`);
    for (const [id, record] of Object.entries(data.relations)) {
      const row = create("div", list); row.className = "sp-genealogy-row";
      create("span", row, `${data.people[record.mentor].label} → ${data.people[record.student].label} · ${spGenealogyOptions().find(([key]) => key === record.kind)[1]}`);
      const editButton = create("button", row, getString("ui-edit")); editButton.type = "button"; editButton.addEventListener("click", () => edit(id));
      const removeButton = create("button", row, getString("ui-delete")); removeButton.type = "button";
      removeButton.addEventListener("click", () => run(async () => {
        const result = spDeleteManualGenealogy(getPref("genealogy.manualData"), id);
        setPref("genealogy.manualData", JSON.stringify(result.data)); removed = result.removed; undo.hidden = false;
        await showManual(record.kind);
        if (editing === id) reset(); else { mentor.refresh(); student.refresh(); }
        renderList();
        message.textContent = getString("ui-deleted-you-can-undo-this-deletion");
      }));
    }
  };
  save.addEventListener("click", () => run(async () => {
    const result = spSaveManualGenealogy(getPref("genealogy.manualData"), { id: editing || undefined,
      mentor: mentor.value(), student: student.value(), kind: kind.value, sourceURL: source.value, note: note.value }, () => doc.defaultView.crypto.randomUUID());
    setPref("genealogy.manualData", JSON.stringify(result.data));
    const savedKind = kind.value; await showManual(savedKind); reset(); renderList();
    message.textContent = getString("ui-relationship-saved-locally");
  }));
  cancel.addEventListener("click", () => run(() => { reset(); message.textContent = ""; }));
  undo.addEventListener("click", () => run(async () => {
    const data = spRestoreManualGenealogy(getPref("genealogy.manualData"), removed);
    setPref("genealogy.manualData", JSON.stringify(data)); const restoredKind = removed.relation.kind;
    removed = undefined; undo.hidden = true; await showManual(restoredKind); mentor.refresh(); student.refresh(); renderList();
    message.textContent = getString("ui-deletion-undone");
  }));
  section.addEventListener("toggle", () => {
    parent.style.maxHeight = section.open ? "65%" : "";
    if (section.open) run(() => { renderList(); mentor.refresh(); student.refresh(); });
    view.schedule(() => { if (view.mode === "genealogy") { view.renderer?.onResize(); view.fitGraph(); } }, 0);
  });
  run(() => { reset(); renderList(); });
  return { edit, add: id => run(() => { reset(id); section.open = true; form.scrollIntoView({ block: "nearest" }); }) };
}
