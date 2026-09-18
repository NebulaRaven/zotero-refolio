  // src/features/preferences/defaultPreferences.ts
  export function readDefaultPreferences() {
    const preferences = /* @__PURE__ */new Map();
    const registerPreference = (key, value) => {
      if (preferences.has(key)) {
        throw new Error(`Duplicate default preference: ${key}`);
      }
      preferences.set(key, value);
    };
    Services.scriptloader.loadSubScript(`${rootURI}prefs.js`, { pref: registerPreference });
    return preferences;
  }
  export async function restoreMissingDefaultPreferences() {
    const preferences = readDefaultPreferences();
    let restoredCount = 0;
    for (const [key, value] of preferences) {
      if (Zotero.Prefs.get(key, true) !== undefined) {
        continue;
      }
      Zotero.Prefs.set(key, value, true);
      restoredCount += 1;
    }
    return restoredCount;
  }
