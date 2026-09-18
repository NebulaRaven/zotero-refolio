  // src/features/annotations/annotationColorNames.ts
  export var BUILT_IN_COLOR_NAME_PATTERN = /^general[.-](yellow|red|green|blue|purple|magenta|orange|gray)$/;
  export function isAnnotationColorLocalizationID(value) {
    return typeof value === "string" && BUILT_IN_COLOR_NAME_PATTERN.test(value.trim());
  }
  export function normalizeAnnotationColor(value) {
    if (typeof value !== "string") {
      return;
    }
    const color = value.trim().toLowerCase();
    const shortHex = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
    if (shortHex) {
      return `#${shortHex.slice(1).map(channel => channel.repeat(2)).join("")}`;
    }
    if (/^#[0-9a-f]{6}$/.test(color)) {
      return color;
    } else {
      return undefined;
    }
  }
  export function parseAnnotationColorNames(value) {
    let parsed = value;
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    const colors = [];
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length < 2) {
        continue;
      }
      const name = typeof entry[0] === "string" ? entry[0].trim() : "";
      const color = normalizeAnnotationColor(entry[1]);
      if (name && color) {
        colors.push([name, color]);
      }
    }
    return colors;
  }
  export function findAnnotationColorName(value, annotationColor) {
    const color = normalizeAnnotationColor(annotationColor);
    if (!color) {
      return;
    }
    return parseAnnotationColorNames(value).find(entry => entry[1] === color)?.[0];
  }

