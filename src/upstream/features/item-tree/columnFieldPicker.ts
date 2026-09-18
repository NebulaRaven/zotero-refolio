import { getElements } from "../../utils/dom.ts";
  // src/features/item-tree/columnFieldPicker.ts
  export function createFieldIcon(document2, kind) {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document2.createElementNS(namespace, "svg");
    icon.setAttribute("class", `field-icon field-${kind}`);
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("width", "12");
    icon.setAttribute("height", "12");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.6");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    const path = document2.createElementNS(namespace, "path");
    path.setAttribute("d", kind === "remove" ? "M4 4L12 12M12 4L4 12" : "M8 3V13M3 8H13");
    icon.append(path);
    return icon;
  }
  export function parseColumnFields(value: string): string[] {
    return [...new Set(value.split(",").map(field => field.trim()).filter(Boolean))];
  }
  export function toggleColumnField(fields, field) {
    if (fields.includes(field)) {
      return fields.filter(selected => selected !== field);
    } else {
      return [...fields, field];
    }
  }
  export function moveColumnField(fields, field, target) {
    const from = fields.indexOf(field);
    const to = fields.indexOf(target);
    if (from < 0 || to < 0 || from === to) {
      return [...fields];
    }
    const reordered = fields.filter(selected => selected !== field);
    reordered.splice(to, 0, field);
    return reordered;
  }
  export function mountColumnFieldPicker(input, options) {
    const document2 = input.ownerDocument;
    const view = document2.defaultView;
    if (!view || !input.parentNode) {
      return () => {};
    }
    const source = document2.querySelector(`[data-bind="${options.sourcePrefKey}"]`);
    const watchedControls = new Set([source, ...(options.watchPrefKeys ?? []).map(key => document2.querySelector(`[data-bind="${key}"]`))].filter(control => control !== null));
    const previousDisplay = input.style.display;
    const previousHidden = input.hidden;
    const previousPickerAttribute = input.getAttribute("data-field-picker-input");
    const root = document2.createElement("div");
    root.className = "style-column-field-picker";
    const style2 = document2.createElement("style");
    style2.textContent = `
    input[data-field-picker-input] { display: none !important; }
    .style-column-field-picker { position: relative; width: 100%; min-width: 0; font: inherit; color: var(--fill-primary); }
    .style-column-field-picker .field-selection { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; min-height: 32px; padding: 6px !important; border: var(--material-border); border-radius: 4px; background: var(--material-background); }
    .style-column-field-picker button { appearance: none; box-sizing: border-box; height: auto; min-height: 0; max-height: none; font: inherit; color: var(--fill-primary); cursor: pointer; border: var(--material-border-transparent); border-radius: 4px; padding: 3px 6px; margin: 0; text-align: left; }
    .style-column-field-picker button:is(:hover, :active, :focus) { background-image: none !important; box-shadow: none !important; outline: none; }
    .style-column-field-picker button:focus-visible { outline: none; }
    .style-column-field-picker .field-chip { background: var(--field-background, var(--material-mix-quinary)); color: var(--field-text, var(--fill-primary)); display: inline-flex; align-items: center; gap: 6px; border-radius: 4px; padding: 3px 6px; cursor: grab; }
    .style-column-field-picker .field-chip-unavailable { background: var(--material-mix-quinary); color: var(--fill-secondary); border: 1px dashed var(--color-border); }
    .style-column-field-picker .field-chip:is(:hover, :active, :focus) { background-color: var(--field-background, var(--material-mix-quinary)) !important; color: var(--field-text, var(--fill-primary)) !important; }
    .style-column-field-picker .field-chip-unavailable:is(:hover, :active, :focus) { background-color: var(--material-mix-quinary) !important; color: var(--fill-secondary) !important; }
    .style-column-field-picker .field-chip.is-dragging { opacity: .45; }
    .style-column-field-picker .field-drop-placeholder { opacity: .35; pointer-events: none; }
    .style-column-field-picker .field-icon { display: block; flex-shrink: 0; pointer-events: none; }
    .style-column-field-picker .field-remove { color: inherit; opacity: .65; cursor: pointer; padding: 0; border: 0; background: transparent; }
    .style-column-field-picker .field-chip-label { cursor: grab; user-select: none; }
    .style-column-field-picker .field-toggle { display: inline-flex; align-items: center; gap: 4px; background: var(--material-mix-quinary); color: var(--fill-secondary); }
    .style-column-field-picker .field-toggle:is(:hover, :active, :focus) { background-color: var(--material-mix-quinary) !important; color: var(--fill-secondary) !important; }
    .style-column-field-picker .field-options { display: block; box-sizing: border-box; position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 100; max-height: min(280px, 45vh); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; padding: 6px; border: var(--material-border); border-radius: 6px; background: var(--material-background); box-shadow: 0 2px 6px var(--fill-quarternary); }
    .style-column-field-picker .field-options[hidden] { display: none; }
    .style-column-field-picker .field-option { display: flex; gap: 12px; align-items: flex-start; width: 100%; background: var(--material-background); padding: 6px; }
    .style-column-field-picker .field-option:is(:hover, :active, :focus) { background-color: var(--material-background) !important; color: var(--fill-primary) !important; }
    .style-column-field-picker .field-option-label { flex-shrink: 0; background: var(--field-background, var(--material-mix-quinary)); color: var(--field-text, var(--fill-primary)); border-radius: 4px; padding: 3px 6px; }
    .style-column-field-picker .field-option-description { flex: 1; min-width: 0; overflow: hidden; color: var(--fill-secondary); font-size: .85em; font-weight: normal; line-height: 1.5; padding: 3px 0; text-overflow: ellipsis; white-space: nowrap; }
    .style-column-field-picker .field-empty { padding: 6px; color: var(--fill-secondary); }
  `;
    const selection = document2.createElement("div");
    selection.className = "field-selection";
    selection.setAttribute("role", "group");
    selection.setAttribute("aria-label", options.selectLabel);
    const panel = document2.createElement("div");
    panel.className = "field-options";
    panel.id = `field-options-${input.getAttribute("data-bind")}`;
    panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-multiselectable", "true");
    panel.setAttribute("aria-label", options.selectLabel);
    panel.hidden = true;
    root.append(style2, selection, panel);
    input.after(root);
    input.setAttribute("data-field-picker-input", "true");
    input.hidden = true;
    input.style.display = "none";
    let expanded = false;
    let draggedChip;
    let dragPlaceholder;
    let dragChanged = false;
    let dragStarted = false;
    let draggedStyle = "";
    let dragStartX = 0;
    let dragStartY = 0;
    let active = true;
    let moveFrame: number | undefined;
    let pendingMove: MouseEvent | undefined;
    const animations = new Map<HTMLElement, Animation>();
    const cancelAnimations = () => {
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
    };
    let toggle;
    const setExpanded = value => {
      expanded = value;
      panel.hidden = !value;
      toggle.setAttribute("aria-expanded", String(value));
    };
    const save = fields => {
      if (!active) {
        return;
      }
      input.value = fields.join(", ");
      input.dispatchEvent(new view.Event("input", {
        bubbles: true
      }));
    };
    const focusField = (container, field) => {
      getElements(container.querySelectorAll("button")).find(button => button.dataset.field === field)?.focus();
    };
    const render = () => {
      if (!active) {
        return;
      }
      const fields = parseColumnFields(input.value);
      const available = options.getOptions(source?.value, document2);
      const descriptions = new Map(available.map(option => [option.value, option.description]));
      const appearances = new Map<string, { backgroundColor: string; color: string }>(available.map(option => [option.value, option.appearance]));
      cancelAnimations();
      selection.replaceChildren();
      panel.replaceChildren();
      for (const field of fields) {
        const chip = document2.createElement("div");
        chip.className = descriptions.has(field) ? "field-chip" : "field-chip field-chip-unavailable";
        chip.dataset.field = field;
        const appearance = appearances.get(field);
        if (appearance) {
          chip.style.setProperty("--field-background", appearance.backgroundColor);
          chip.style.setProperty("--field-text", appearance.color);
        }
        chip.title = `${field}
${descriptions.get(field) ?? options.unavailableLabel}`;
        chip.setAttribute("role", "listitem");
        const label = document2.createElement("span");
        label.className = "field-chip-label";
        label.textContent = field;
        const remove = document2.createElement("button");
        remove.type = "button";
        remove.className = "field-remove";
        remove.setAttribute("aria-label", `${options.removeLabel}: ${field}`);
        remove.append(createFieldIcon(document2, "remove"));
        remove.addEventListener("click", () => {
          save(toggleColumnField(parseColumnFields(input.value), field));
          toggle.focus();
        });
        chip.addEventListener("keydown", event => {
          if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
            return;
          }
          event.preventDefault();
          const current = parseColumnFields(input.value);
          const target = current[current.indexOf(field) + (event.key === "ArrowLeft" ? -1 : 1)];
          if (target !== undefined) {
            save(moveColumnField(current, field, target));
          }
          focusField(selection, field);
        });
        chip.append(label, remove);
        selection.append(chip);
      }
      toggle = document2.createElement("button");
      toggle.type = "button";
      toggle.className = "field-toggle";
      const toggleLabel = document2.createElement("span");
      toggleLabel.textContent = options.selectLabel;
      toggle.append(createFieldIcon(document2, "add"), toggleLabel);
      toggle.setAttribute("aria-haspopup", "listbox");
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-controls", panel.id);
      toggle.addEventListener("click", () => setExpanded(!expanded));
      toggle.addEventListener("keydown", event => {
        if (event.key !== "ArrowDown") {
          return;
        }
        event.preventDefault();
        setExpanded(true);
        panel.querySelector("button")?.focus();
      });
      selection.append(toggle);
      const remaining = available.filter(option => !fields.includes(option.value));
      if (remaining.length === 0) {
        const empty = document2.createElement("div");
        empty.className = "field-empty";
        empty.textContent = options.emptyLabel;
        empty.setAttribute("role", "status");
        panel.append(empty);
      }
      for (const [index, option] of remaining.entries()) {
        const button = document2.createElement("button");
        button.type = "button";
        button.className = "field-option";
        button.dataset.field = option.value;
        const label = document2.createElement("span");
        label.className = "field-option-label";
        label.textContent = option.value;
        if (option.appearance) {
          button.style.setProperty("--field-background", option.appearance.backgroundColor);
          button.style.setProperty("--field-text", option.appearance.color);
        }
        const description = document2.createElement("span");
        description.className = "field-option-description";
        description.textContent = option.description;
        button.append(label, description);
        button.title = `${option.value}
${option.description}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");
        button.addEventListener("click", () => {
          save(toggleColumnField(parseColumnFields(input.value), option.value));
          const buttons = getElements(panel.querySelectorAll("button"));
          (buttons[Math.min(index, buttons.length - 1)] ?? toggle).focus();
        });
        panel.append(button);
      }
    };
    const outsideClick = event => {
      if (!event.composedPath().includes(root)) {
        setExpanded(false);
      }
    };
    const onMouseDown = event => {
      if (event.button !== 0) {
        return;
      }
      const label = event.target.closest(".field-chip-label");
      const chip = label?.parentElement;
      if (!chip?.classList.contains("field-chip")) {
        return;
      }
      draggedChip = chip;
      document2.addEventListener("mousemove", onMouseMove);
      document2.addEventListener("mouseup", onMouseUp);
      dragChanged = false;
      dragStarted = false;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
    };
    const moveChip = (event: MouseEvent) => {
      if (!draggedChip) {
        return;
      }
      if (!dragStarted && Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) >= 4) {
        dragStarted = true;
        dragPlaceholder = draggedChip.cloneNode(true);
        dragPlaceholder.classList.add("field-drop-placeholder");
        dragPlaceholder.setAttribute("aria-hidden", "true");
        selection.insertBefore(dragPlaceholder, draggedChip);
        draggedStyle = draggedChip.getAttribute("style") ?? "";
        const bounds = draggedChip.getBoundingClientRect();
        draggedChip.style.position = "fixed";
        draggedChip.style.left = `${bounds.left}px`;
        draggedChip.style.top = `${bounds.top}px`;
        draggedChip.style.width = `${bounds.width}px`;
        draggedChip.style.zIndex = "1000";
        draggedChip.style.pointerEvents = "none";
        root.append(draggedChip);
        draggedChip.classList.add("is-dragging");
      }
      if (!dragStarted) {
        return;
      }
      draggedChip.style.left = `${event.clientX - draggedChip.offsetWidth / 2}px`;
      draggedChip.style.top = `${event.clientY - draggedChip.offsetHeight / 2}px`;
      const chips = getElements(selection.querySelectorAll(".field-chip")).filter(chip => chip !== dragPlaceholder);
      const positions = new Map([...chips, ...(dragPlaceholder ? [dragPlaceholder] : [])].map(chip => [chip, chip.getBoundingClientRect()]));
      const target = chips.find(chip => {
        if (chip === draggedChip) {
          return false;
        }
        const bounds = positions.get(chip);
        const inRow = event.clientY >= bounds.top && event.clientY <= bounds.bottom;
        return event.clientY < bounds.top || inRow && event.clientX < bounds.left + bounds.width / 2;
      });
      let reordered = false;
      if (target && target !== dragPlaceholder?.nextElementSibling) {
        selection.insertBefore(dragPlaceholder, target);
        reordered = dragChanged = true;
      } else if (!target && dragPlaceholder?.nextElementSibling !== toggle) {
        selection.insertBefore(dragPlaceholder, toggle);
        reordered = dragChanged = true;
      }
      if (reordered) {
        const moving = [...chips, dragPlaceholder].filter(Boolean);
        for (const chip of moving) {
          const before = positions.get(chip);
          if (!before) {
            continue;
          }
          const after = chip.getBoundingClientRect();
          const offsetX = before.left - after.left;
          const offsetY = before.top - after.top;
          if (!offsetX && !offsetY) {
            continue;
          }
          animations.get(chip)?.cancel();
          const animation = chip.animate([
            { transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: "none" }
          ], { duration: 280, easing: "ease-out" });
          animations.set(chip, animation);
          const release = () => { if (animations.get(chip) === animation) animations.delete(chip); };
          animation.finished.then(release, release);
        }
      }
      event.preventDefault();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!draggedChip || !active) return;
      event.preventDefault();
      pendingMove = event;
      if (moveFrame !== undefined) return;
      moveFrame = view.requestAnimationFrame(() => {
        moveFrame = undefined;
        const latest = pendingMove; pendingMove = undefined;
        if (active && latest) moveChip(latest);
      });
    };
    const stopTrackingDrag = () => {
      document2.removeEventListener("mousemove", onMouseMove);
      document2.removeEventListener("mouseup", onMouseUp);
      if (moveFrame !== undefined) view.cancelAnimationFrame(moveFrame);
      moveFrame = undefined;
    };
    const onMouseUp = () => {
      stopTrackingDrag();
      if (active && pendingMove) moveChip(pendingMove);
      pendingMove = undefined;
      if (!draggedChip) {
        return;
      }
      const moved = draggedChip.dataset.field;
      draggedChip.classList.remove("is-dragging");
      if (dragPlaceholder) {
        selection.insertBefore(draggedChip, dragPlaceholder);
        dragPlaceholder.remove();
      }
      if (draggedStyle) {
        draggedChip.setAttribute("style", draggedStyle);
      } else {
        draggedChip.removeAttribute("style");
      }
      draggedStyle = "";
      draggedChip = undefined;
      dragPlaceholder = undefined;
      dragStarted = false;
      if (!moved || !dragChanged) {
        return;
      }
      save(getElements(selection.querySelectorAll(".field-chip")).map(chip => chip.dataset.field));
      focusField(selection, moved);
    };
    const onWheel = event => {
      if (!expanded || event.ctrlKey || event.deltaY === 0) {
        return;
      }
      const maximum = panel.scrollHeight - panel.clientHeight;
      if (maximum <= 0) {
        return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? panel.clientHeight : 1;
      panel.scrollTop = Math.max(0, Math.min(maximum, panel.scrollTop + event.deltaY * unit));
      event.preventDefault();
      event.stopPropagation();
    };
    const onKeyDown = event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key) && panel.contains(event.target)) {
        event.preventDefault();
        const buttons = getElements(panel.querySelectorAll("button"));
        const current = buttons.indexOf(event.target);
        buttons[(current + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
      }
      if (event.key === "Escape" && expanded) {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(false);
        toggle.focus();
      }
    };
    input.addEventListener("input", render);
    input.addEventListener("change", render);
    for (const control of watchedControls) {
      control.addEventListener("input", render);
      control.addEventListener("change", render);
    }
    document2.addEventListener("click", outsideClick);
    root.addEventListener("mousedown", onMouseDown);
    panel.addEventListener("wheel", onWheel, {
      passive: false
    });
    root.addEventListener("keydown", onKeyDown);
    const cleanup = () => {
      if (!active) {
        return;
      }
      active = false;
      input.removeEventListener("input", render);
      input.removeEventListener("change", render);
      for (const control of watchedControls) {
        control.removeEventListener("input", render);
        control.removeEventListener("change", render);
      }
      document2.removeEventListener("click", outsideClick);
      panel.removeEventListener("wheel", onWheel);
      root.removeEventListener("mousedown", onMouseDown);
      stopTrackingDrag();
      pendingMove = undefined;
      cancelAnimations();
      root.removeEventListener("keydown", onKeyDown);
      root.remove();
      input.style.display = previousDisplay;
      input.hidden = previousHidden;
      if (previousPickerAttribute === null) {
        input.removeAttribute("data-field-picker-input");
      } else {
        input.setAttribute("data-field-picker-input", previousPickerAttribute);
      }
    };
    try {
      render();
    } catch (error) {
      cleanup();
      throw error;
    }
    return cleanup;
  }

