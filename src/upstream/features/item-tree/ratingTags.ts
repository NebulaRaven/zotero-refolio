  // src/features/item-tree/ratingTags.ts
  export var LEGACY_RATING_STAR = "⭐";
  export var MAX_RATING = 5;
  export var DEFAULT_RATING_STORAGE_LOCATION = "extra";
  export function parseRatingStorageLocation(value) {
    if (value === "tag") {
      return "tag";
    } else {
      return DEFAULT_RATING_STORAGE_LOCATION;
    }
  }
  export function parseRatingValue(value) {
    if (typeof value !== "string" && typeof value !== "number") {
      return 0;
    }
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) {
      return 0;
    }
    const rating = Number(text);
    if (rating >= 1 && rating <= MAX_RATING) {
      return rating;
    } else {
      return 0;
    }
  }
  export function isLegacyRatingTagName(tagName) {
    const chars = Array.from(tagName);
    return chars.length >= 1 && chars.length <= MAX_RATING && chars.every(char => char === LEGACY_RATING_STAR);
  }
  export function resolveRating(extraValue, tags, coloredTagNames, preferredStorage = DEFAULT_RATING_STORAGE_LOCATION) {
    const legacyTags = tags.filter(({
      tag
    }) => isLegacyRatingTagName(tag) && !coloredTagNames.has(tag));
    const legacyTagNames = legacyTags.map(({
      tag
    }) => tag);
    const extraRating = parseRatingValue(extraValue);
    const [legacyTag] = legacyTags;
    if (parseRatingStorageLocation(preferredStorage) === "tag" && legacyTag) {
      return {
        value: Array.from(legacyTag.tag).length,
        source: "legacy",
        legacyTagNames
      };
    }
    if (extraRating) {
      return {
        value: extraRating,
        source: "extra",
        legacyTagNames
      };
    }
    if (legacyTag) {
      return {
        value: Array.from(legacyTag.tag).length,
        source: "legacy",
        legacyTagNames
      };
    }
    return {
      value: 0,
      source: null,
      legacyTagNames: []
    };
  }
  export function buildRatingStorageUpdate(options) {
    const selectedValue = parseRatingValue(options.selectedValue);
    const nextValue = parseRatingValue(options.currentValue) === selectedValue ? 0 : selectedValue;
    const storage = parseRatingStorageLocation(options.storage);
    const legacyTagNamesToRemove = options.tags.filter(({
      tag
    }) => isLegacyRatingTagName(tag) && !options.coloredTagNames.has(tag)).map(({
      tag
    }) => tag);
    return {
      value: nextValue,
      extraValue: storage === "extra" && nextValue ? String(nextValue) : "",
      legacyTagNamesToRemove,
      legacyTagNameToAdd: storage === "tag" && nextValue ? LEGACY_RATING_STAR.repeat(nextValue) : null
    };
  }
  export function isStatusTagName(tagName) {
    return tagName.startsWith("/");
  }

