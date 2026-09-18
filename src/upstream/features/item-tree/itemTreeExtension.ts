  // src/features/item-tree/itemTreeExtension.ts
  export var STYLE_MENU_POPUP_SELECTOR = "#style-plugin-menu > menupopup";
  export function registerStyleMenuItemContribution(document2, registrar, descriptor) {
    const popup = document2.querySelector(STYLE_MENU_POPUP_SELECTOR);
    if (!popup) {
      throw new Error("The Style item-menu popup is unavailable.");
    }
    if (registrar.register(popup, descriptor) === false) {
      throw new Error(`Unable to register Style menu item: ${descriptor.id}`);
    }
    let registered = true;
    return () => {
      if (!registered) {
        return;
      }
      registered = false;
      registrar.unregister(descriptor.id);
    };
  }

