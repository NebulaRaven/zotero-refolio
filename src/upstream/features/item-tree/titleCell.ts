  // src/features/item-tree/titleCell.ts
  export var MANAGED_RATING_CLASS = "stylepersonal-title-rating";
  export function removeAll(elements) {
    elements.forEach(element => element.remove());
  }
  export function removeLegacyRatingTags(cell, legacyTagNames) {
    if (legacyTagNames.length === 0) {
      return;
    }
    const names = new Set(legacyTagNames);
    cell.querySelectorAll(".tag-swatch.emoji").forEach(element => {
      if (names.has(element.textContent?.trim() ?? "")) {
        element.remove();
      }
    });
  }
  export function insertRatingBesideNativeTags(parent: HTMLElement, title: Node, rating: Node, tagsAfterTitle: boolean) {
    const nativeDecorations = Array.from(parent.children).filter(element => element.classList.contains("colored-tag-swatches") || element.classList.contains("tag-swatch") && element.classList.contains("emoji"));
    const lastDecoration = nativeDecorations[nativeDecorations.length - 1];
    const referenceNode = lastDecoration ? lastDecoration.nextSibling : tagsAfterTitle ? title.nextSibling : title;
    parent.insertBefore(rating, referenceNode);
  }
  export function reconcileTitleCellDecorations(cell, options) {
    const title = cell.querySelector(".cell-text");
    if (!title?.parentElement) {
      return;
    }
    removeAll(cell.querySelectorAll(`.${MANAGED_RATING_CLASS}`));
    removeLegacyRatingTags(cell, options.rating.legacyTagNames);
    if (!options.showColoredTags) {
      removeAll(cell.querySelectorAll(".colored-tag-swatches"));
      removeAll(cell.querySelectorAll(".tag-swatch.colored"));
    }
    if (!options.showEmojiTags) {
      removeAll(cell.querySelectorAll(".tag-swatch.emoji"));
      return;
    }
    if (options.rating.source === null || options.rating.value === 0) {
      return;
    }
    const star = options.selectedStar || "⭐";
    const rating = cell.ownerDocument.createElement("span");
    rating.classList.add("tag-swatch", "emoji", MANAGED_RATING_CLASS);
    rating.textContent = star.repeat(options.rating.value);
    rating.setAttribute("aria-label", `${options.rating.value}/5`);
    insertRatingBesideNativeTags(title.parentElement, title, rating, options.tagsAfterTitle);
  }
  export function isTitleColumnItem(value) {
    if (!value || typeof value !== "object") {
      return false;
    }
    const item = value;
    return typeof item.getDisplayTitle === "function" && typeof item.getTags === "function" && typeof item.libraryID === "number";
  }

