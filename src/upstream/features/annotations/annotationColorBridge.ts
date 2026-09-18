  // src/features/annotations/annotationColorBridge.ts
  export var BRIDGE_KEY = "__zoteroStyleAnnotationColorBridge";
  export function encodeBridgePayload(colors) {
    return encodeURIComponent(JSON.stringify(colors));
  }
  export function buildAnnotationColorBridgeSource(colors) {
    const payload = encodeBridgePayload(colors);
    return `(() => {
    "use strict";
    const bridgeKey = ${JSON.stringify(BRIDGE_KEY)};
    const nextColors = JSON.parse(decodeURIComponent(${JSON.stringify(payload)}));
    let bridge = window[bridgeKey];
    if (!bridge || bridge.version !== 1) {
      if (bridge && typeof bridge.destroy === "function") bridge.destroy();
      const originalMethods = {
        find: Array.prototype.find,
        findIndex: Array.prototype.findIndex,
        map: Array.prototype.map,
        slice: Array.prototype.slice,
      };
      const nativeColorLabels = new Set([
        "general-yellow", "general-red", "general-green", "general-blue",
        "general-purple", "general-magenta", "general-orange", "general-gray",
        "general.yellow", "general.red", "general.green", "general.blue",
        "general.purple", "general.magenta", "general.orange", "general.gray",
      ]);
      const normalizeColor = (value) =>
        typeof value === "string" ? value.trim().toLowerCase() : "";
      const copyRows = (rows) => originalMethods.map.call(
        rows,
        (row) => [row[0], row[1]],
      );

      bridge = {
        version: 1,
        colors: [],
        palette: null,
        nativeRows: null,
        reader: null,
        originalOpenContextMenu: null,
        menuWrapper: null,
        patchedMethods: {},

        isNativePalette(value) {
          if (!Array.isArray(value) || value.length < 5) return false;
          for (const row of value) {
            if (
              !Array.isArray(row) ||
              row.length < 2 ||
              !nativeColorLabels.has(row[0]) ||
              !/^#[0-9a-f]{6}$/i.test(row[1])
            ) {
              return false;
            }
          }
          return true;
        },

        capturePalette(value) {
          if (this.palette || !this.isNativePalette(value)) return;
          this.palette = value;
          this.nativeRows = copyRows(value);
          this.restoreMethodHooks();
          this.applyPalette();
        },

        applyPalette() {
          if (!this.palette || !this.nativeRows || !this.nativeRows.length) return;
          const rows = [];
          if (this.colors.length) {
            for (let index = 0; index < this.colors.length; index += 1) {
              const configuredName = this.colors[index][0];
              const normalizedName = String(configuredName).replace(".", "-");
              let localizationID;
              if (nativeColorLabels.has(configuredName)) {
                for (const nativeRow of this.nativeRows) {
                  if (String(nativeRow[0]).replace(".", "-") === normalizedName) {
                    localizationID = nativeRow[0];
                    break;
                  }
                }
              }
              localizationID =
                localizationID ??
                this.nativeRows[index % this.nativeRows.length][0];
              rows.push([localizationID, this.colors[index][1]]);
            }
          } else {
            rows.push(...copyRows(this.nativeRows));
          }
          this.palette.splice(0, this.palette.length, ...rows);
        },

        findName(color) {
          const normalized = normalizeColor(color);
          for (const entry of this.colors) {
            if (normalizeColor(entry[1]) === normalized) return entry[0];
          }
          return undefined;
        },

        renameMenuItems(params) {
          const groups = params && params.itemGroups;
          if (!Array.isArray(groups)) return;
          for (const group of groups) {
            if (!Array.isArray(group)) continue;
            for (const item of group) {
              if (!item || typeof item !== "object") continue;
              const name = this.findName(item.color);
              if (name && !nativeColorLabels.has(name)) item.label = name;
            }
          }
        },

        restoreReader() {
          if (
            this.reader &&
            this.menuWrapper &&
            this.reader._onOpenContextMenu === this.menuWrapper
          ) {
            this.reader._onOpenContextMenu = this.originalOpenContextMenu;
          }
          this.reader = null;
          this.originalOpenContextMenu = null;
          this.menuWrapper = null;
        },

        patchReader() {
          const reader = window._reader;
          if (!reader || typeof reader._onOpenContextMenu !== "function") return;
          if (reader === this.reader && reader._onOpenContextMenu === this.menuWrapper) {
            return;
          }
          this.restoreReader();
          const original = reader._onOpenContextMenu;
          const owner = this;
          const wrapper = function (params) {
            owner.renameMenuItems(params);
            return original.call(this, params);
          };
          this.reader = reader;
          this.originalOpenContextMenu = original;
          this.menuWrapper = wrapper;
          reader._onOpenContextMenu = wrapper;
        },

        restoreMethodHooks() {
          for (const name of Object.keys(originalMethods)) {
            if (Array.prototype[name] === this.patchedMethods[name]) {
              Array.prototype[name] = originalMethods[name];
            }
          }
        },

        update(next) {
          this.colors = Array.isArray(next) ? copyRows(next) : [];
          this.applyPalette();
          this.patchReader();
        },

        destroy() {
          this.restoreMethodHooks();
          if (this.palette && this.nativeRows) {
            this.palette.splice(
              0,
              this.palette.length,
              ...copyRows(this.nativeRows),
            );
          }
          this.restoreReader();
          if (window[bridgeKey] === this) delete window[bridgeKey];
        },
      };

      for (const name of Object.keys(originalMethods)) {
        const patched = function (...args) {
          bridge.capturePalette(this);
          return originalMethods[name].apply(this, args);
        };
        bridge.patchedMethods[name] = patched;
        Array.prototype[name] = patched;
      }
      window[bridgeKey] = bridge;
    }
    bridge.update(nextColors);
  })();`;
  }
  export function buildAnnotationColorBridgeCleanupSource() {
    return `(() => {
    const bridge = window[${JSON.stringify(BRIDGE_KEY)}];
    if (bridge && typeof bridge.destroy === "function") bridge.destroy();
  })();`;
  }

