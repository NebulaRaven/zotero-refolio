import type { AddonData,PreferenceRegistration } from '../../../types/addon.ts';
  // src/features/preferences/preferenceWindow.ts
  export function trackPreferenceWindow(owner: AddonData, preferenceWindow: Window) {
    owner.prefs?.release?.();
    let active = true;
    const registration: PreferenceRegistration = {
      window: preferenceWindow
    };
    const release = () => {
      if (!active) {
        return;
      }
      active = false;
      preferenceWindow.removeEventListener("unload", release);
      if (owner.prefs === registration) {
        delete owner.prefs;
      }
    };
    registration.release = release;
    owner.prefs = registration;
    preferenceWindow.addEventListener("unload", release, {
      once: true
    });
  }

