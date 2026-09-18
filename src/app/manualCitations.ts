import { spAddManualCitation,spCitationLibraryItems } from "./citations.ts";
import { getString,getErrorMessage } from "../upstream/utils/locale.ts";
import { getFirstSelectedLibraryID } from "../upstream/utils/zoteroSelection.ts";
import { spElement,spSelect,spSelectOptions } from "./ui.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spBuildManualCitationControls(view, container: HTMLElement) {
  const create = spElement.bind(null, container.ownerDocument);
  const panel = create("div", container); panel.className = "sp-manual-citation"; panel.hidden = true;
  let generation = 0, libraryID: number;
  const close = () => { generation++; panel.hidden = true; panel.replaceChildren(); };
  view.cleanups.push(close);
  return {
    sync() { if (view.mode !== "citations" || libraryID !== getFirstSelectedLibraryID()) close(); },
    async open() {
      close(); const own = generation;
      libraryID = getFirstSelectedLibraryID();
      const items = await spCitationLibraryItems(libraryID);
      if (!view.active || own !== generation || view.mode !== "citations" || libraryID !== getFirstSelectedLibraryID()) return;
      const choices: Array<[string, string]> = [["", getString("ui-select-paper")], ...items
        .map(item => [String(item.id), item.getDisplayTitle() || item.key] as [string, string])
        .sort((a, b) => a[1].localeCompare(b[1]))];
      create("strong", panel, getString("ui-add-citation"));
      const form = create("div", panel); form.className = "sp-citation-fields";
      const field = (label: string) => {
        const row = create("label", form, label), select = spSelect(container.ownerDocument, row);
        select.setAttribute("aria-label", label); spSelectOptions(select, choices, ""); return select;
      };
      const source = field(getString("ui-citing-paper")), target = field(getString("ui-cited-paper"));
      const selected = ZoteroPane.getSelectedItems().filter(item => item.libraryID === libraryID && item.isRegularItem());
      source.value = selected[0] ? String(selected[0].id) : "";
      target.value = selected[1] ? String(selected[1].id) : "";
      const actions = create("div", panel); actions.className = "sp-actions";
      const swap = create("button", actions, getString("ui-swap-direction")); swap.type = "button";
      swap.addEventListener("click", () => { const value = source.value; source.value = target.value; target.value = value; });
      const save = create("button", actions, getString("ui-save")); save.type = "button";
      const cancel = create("button", actions, getString("ui-cancel")); cancel.type = "button";
      cancel.addEventListener("click", close);
      const status = create("p", panel); status.setAttribute("role", "status");
      save.addEventListener("click", async () => {
        if (save.disabled) return;
        save.disabled = true;
        try {
          if (!source.value || !target.value || source.value === target.value) throw new Error("ui-error-citation-select-two");
          if (await spAddManualCitation(Number(source.value), Number(target.value))) {
            close();
            if (view.active) view.status.textContent = getString("ui-citation-saved");
          }
        } catch (error) { status.textContent = getErrorMessage(error); }
        finally { save.disabled = false; }
      });
      panel.hidden = false; source.focus();
    }
  };
}
