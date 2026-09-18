import { spElement } from "./ui.ts";
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spReadGraphTheme(container) {
  const doc = container.ownerDocument;
  const probe = spElement(doc, "span", container);
  probe.hidden = true;
  const read = (token, fallback) => {
    probe.style.color = `var(${token}, ${fallback})`;
    const css = doc.defaultView.getComputedStyle(probe).color;
    const channels = css.match(/[\d.]+/g).map(Number);
    return { css, a: channels[3] ?? 1, rgb: (Math.round(channels[0]) << 16) | (Math.round(channels[1]) << 8) | Math.round(channels[2]) };
  };
  try {
    const background = read("--material-background", "Canvas");
    const border = read("--color-border", "ThreeDShadow");
    const definitions: Record<string, [string, string]> = {
      fill: ["--fill-secondary", "CanvasText"], fillFocused: ["--accent-blue", "Highlight"],
      fillTag: ["--accent-teal", "CanvasText"], fillUnresolved: ["--fill-secondary", "GrayText"],
      fillAttachment: ["--accent-orange", "CanvasText"], arrow: ["--fill-primary", "CanvasText"],
      circle: ["--accent-blue", "Highlight"], line: ["--fill-secondary", "CanvasText"],
      text: ["--fill-primary", "CanvasText"], fillHighlight: ["--accent-green", "Highlight"],
      lineHighlight: ["--accent-blue", "Highlight"]
    };
    const values = Object.fromEntries(Object.entries(definitions).map(([name, args]) => [name, read(...args)]));
    const colors = Object.fromEntries(Object.entries(values).map(([name, { rgb, a }]) => [name, { rgb, a }]));
    return { colors, background: background.css, border: border.css, text: values.text.css,
      fontFamily: doc.defaultView.getComputedStyle(container).fontFamily };
  } finally { probe.remove(); }
}
