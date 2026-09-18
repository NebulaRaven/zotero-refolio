import { getString, getErrorMessage } from "../upstream/utils/locale.ts";
import { spElement,spLoadUIStyles,spSelectOptions } from "./ui.ts";
import { spLoadCitationGraph } from "./citations.ts";
import { getPref,setPref } from "../upstream/utils/prefs.ts";
import { spFilterGraph } from "../core/graph.ts";
import { spBuildGenealogyControls } from "./genealogy.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spBuildGraphControls(view, container) {
  const doc = container.ownerDocument;
  const create = spElement.bind(null, doc);
  spLoadUIStyles(container);
  container.classList.add("sp-graph");
  const toolbar = create("div", container); toolbar.className = "sp-graph-toolbar";
  const labels: Record<string, string> = { default: "ui-mode-links", related: "ui-mode-related", note: "ui-mode-notes", author: "ui-mode-authors", tag: "ui-mode-tags", citations: "ui-mode-citations", genealogy: "ui-mode-genealogy" };
  const modeButtons = new Map();
  const run = async fn => { try { await fn(); } catch (error) { if (view.active) view.status.textContent = getErrorMessage(error); } };
  for (const mode of Object.keys(view.modeFunction)) {
    const button = create("button", toolbar, getString(labels[mode])); button.type = "button";
    button.className = "option"; button.dataset.mode = mode; button.setAttribute("aria-pressed", String(mode === view.mode));
    button.addEventListener("click", () => run(async () => {
      if (view.busyMode) return;
      if (mode === "citations") {
        view.busyMode = true;
        try { if (!await spLoadCitationGraph()) return; }
        finally { view.busyMode = false; }
      }
      if (!view.active) return;
      view.cancelGenealogy?.();
      view.mode = mode; setPref("graphView.mode", mode);
      view.syncControls(); await view.refreshGraphView(); view.setTheme();
      if (mode === "genealogy") view.schedule(() => view.fitGraph(), 150);
    }));
    modeButtons.set(mode, button);
  }
  const fit = create("button", toolbar, getString("ui-fit")); fit.type = "button";
  fit.addEventListener("click", () => view.fitGraph());
  const filters = create("div", container); filters.className = "sp-graph-filters";
  const select = (label, choices) => {
    const row = create("label", filters, label); const input = create("select", row);
    input.setAttribute("aria-label", label);
    spSelectOptions(input, choices);
    return input;
  };
  const scope = select(getString("ui-scope"), [["selected", getString("ui-selected-items")], ["all", getString("ui-current-view")]]);
  const depth = select(getString("ui-depth"), [["1", "1"], ["2", "2"]]);
  const expand = create("button", filters, getString("ui-expand-one-level")); expand.type = "button";
  const minYear = create("input", create("label", filters, getString("ui-year"))); minYear.type = "number"; minYear.placeholder = getString("ui-from"); minYear.setAttribute("aria-label", getString("ui-from-year"));
  const maxYear = create("input", create("label", filters, "–")); maxYear.type = "number"; maxYear.placeholder = getString("ui-to"); maxYear.setAttribute("aria-label", getString("ui-to-year"));
  const isolatedLabel = create("label", filters, getString("ui-hide-isolated")); const isolated = create("input", isolatedLabel); isolated.type = "checkbox";
  isolatedLabel.prepend(isolated);
  const refresh = create("button", filters, getString("ui-refresh")); refresh.type = "button";
  const sync = () => {
    for (const [mode, button] of modeButtons) button.setAttribute("aria-pressed", String(mode === view.mode));
    const literature = !["default", "genealogy"].includes(view.mode); filters.hidden = !literature;
    scope.value = getPref("graphView.scope") || "selected"; depth.value = getPref("graphView.depth") || "1";
    minYear.value = getPref("graphView.minYear") || ""; maxYear.value = getPref("graphView.maxYear") || "";
    isolated.checked = Boolean(getPref("graphView.hideIsolated")); depth.disabled = scope.value === "all";
    expand.disabled = depth.disabled || depth.value === "2";
    if (view.genealogyPanel) view.genealogyPanel.hidden = view.mode !== "genealogy";
  };
  const change = () => run(async () => {
    if (!minYear.checkValidity() || !maxYear.checkValidity()) throw new Error(getString("ui-enter-valid-years"));
    spFilterGraph({ nodes: {} }, [], { minYear: minYear.value, maxYear: maxYear.value });
    for (const [key, value] of [["scope", scope.value], ["depth", depth.value], ["minYear", minYear.value], ["maxYear", maxYear.value], ["hideIsolated", isolated.checked]]) setPref(`graphView.${key}`, value);
    sync(); await view.refreshGraphView();
  });
  for (const input of [scope, depth, minYear, maxYear, isolated]) input.addEventListener("change", change);
  expand.addEventListener("click", () => { depth.value = "2"; change(); });
  refresh.addEventListener("click", () => run(() => view.refreshGraphView()));
  view.status = create("p", container); view.status.className = "sp-graph-status"; view.status.setAttribute("role", "status");
  view.tooltip = create("div", container); view.tooltip.className = "sp-graph-tooltip"; view.tooltip.hidden = true;
  view.syncControls = sync;
  if (view.modeFunction.genealogy) spBuildGenealogyControls(view, container);
  sync();
}

export function spMakeGraphResizable(view, container, handle, minimum) {
  let drag;
  const height = () => Math.round(container.getBoundingClientRect().height || parseFloat(container.style.height) || minimum);
  const describeHeight = value => {
    const available = Math.max(minimum, container.parentElement.clientHeight);
    handle.setAttribute("aria-valuemin", Math.round(minimum / available * 100));
    handle.setAttribute("aria-valuenow", Math.round(Math.min(1, value / available) * 100));
    handle.setAttribute("aria-valuetext", getString("ui-graph-height-pixels", { args: { value } }));
  };
  const resize = value => {
    const next = Math.max(minimum, value);
    container.style.height = `${next}px`;
    describeHeight(next);
  };
  const save = () => setPref("graphView.height", container.style.height);
  const down = event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, y: event.clientY, height: height() };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = event => {
    if (drag?.id === event.pointerId) resize(drag.height - event.clientY + drag.y);
  };
  const up = () => {
    if (!drag) return;
    const { id } = drag; drag = undefined;
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    save();
  };
  const key = event => {
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); resize(height() + (event.key === "ArrowUp" ? 20 : -20)); save();
  };
  handle.tabIndex = 0;
  for (const [name, value] of Object.entries({ role: "separator", "aria-orientation": "horizontal",
    "aria-label": getString("ui-graph-height"), "aria-valuemax": 100 })) handle.setAttribute(name, value);
  describeHeight(height());
  const events = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up, keydown: key, focus: () => describeHeight(height()) };
  for (const [event, handler] of Object.entries(events)) handle.addEventListener(event, handler);
  view.cleanups.push(() => {
    for (const [event, handler] of Object.entries(events)) handle.removeEventListener(event, handler);
    if (drag && handle.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id);
    drag = undefined;
  });
}
