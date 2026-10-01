// SPDX-License-Identifier: AGPL-3.0-or-later
export const spFeatureGroups = [
  ["journals", "ui-group-journals"], ["graph", "ui-group-graph"],
  ["columns", "ui-group-columns"], ["library", "ui-group-library"],
  ["reader", "ui-group-reader"], ["workspace", "ui-group-workspace"]
];
// Each entry is an actual switch consumed by the retained core or this fork.
export const spFeatureDefinitions = [
  ["publicationTagsColumn", "journals", "ui-feature-publicationTagsColumn"],
  ["IFColumn", "journals", "ui-feature-IFColumn"],
  ["manualJournalRanks", "journals", "ui-feature-manualJournalRanks"],
  ["graphView", "graph", "ui-feature-graphView"],
  ["citationGraph", "graph", "ui-feature-citationGraph"],
  ["genealogy", "graph", "ui-feature-genealogy"],
  ["titleColumn", "columns", "ui-feature-titleColumn"],
  ["tagsColumn", "columns", "ui-feature-tagsColumn"],
  ["textTagsColumn", "columns", "ui-feature-textTagsColumn"],
  ["publicationColumn", "columns", "ui-feature-publicationColumn"],
  ["creatorColumn", "columns", "ui-feature-creatorColumn"],
  ["dateAddedColumn", "columns", "ui-feature-dateAddedColumn"],
  ["statusColumn", "columns", "ui-feature-statusColumn"],
  ["ratingColumn", "columns", "ui-feature-ratingColumn"],
  ["remarkColumn", "columns", "ui-feature-remarkColumn"],
  ["annotationColumn", "columns", "ui-feature-annotationColumn"],
  ["readTimeColumn", "columns", "ui-feature-readTimeColumn"],
  ["tags", "library", "ui-feature-tags"],
  ["addTags", "library", "ui-feature-addTags"],
  ["relatedItems", "library", "ui-feature-relatedItems"],
  ["viewManager", "library", "ui-feature-viewManager"],
  ["collectionItemCount", "library", "ui-feature-collectionItemCount"],
  ["sortCollectionItem", "library", "ui-feature-sortCollectionItem"],
  ["favoriteCollections", "library", "ui-feature-favoriteCollections"],
  ["updateItemDateModified", "library", "ui-feature-updateItemDateModified"],
  ["PDFStyles", "reader", "ui-feature-PDFStyles"],
  ["annotationColors", "reader", "ui-feature-annotationColors"],
  ["showAnnotationColorName", "reader", "ui-feature-showAnnotationColorName"],
  ["addColorNameTag", "reader", "ui-feature-addColorNameTag"],
  ["reader.mergeAnnotations", "reader", "ui-feature-reader-mergeAnnotations"],
  ["reader.attachmentVersionSwitch", "reader", "ui-feature-reader-attachmentVersionSwitch"],
  ["tldr", "reader", "ui-feature-tldr"],
  ["fulltextTranslate", "reader", "ui-feature-fulltextTranslate"],
  ["toogleSidebar", "workspace", "ui-feature-toogleSidebar"],
  ["darkLightButton", "workspace", "ui-feature-darkLightButton"],
  ["tabMenu", "workspace", "ui-feature-tabMenu"],
  ["commands", "workspace", "ui-feature-commands"],
  ["prefsManager", "workspace", "ui-feature-prefsManager"],
  ["styleEditor", "workspace", "ui-feature-styleEditor"]
];

// Settings no code reads any more; startup clears their leftover values from profiles.
export const spRetiredPreferences = [
  "function.readStatus.enable", "function.ReadUnreadStatus.enable", "function.itemTypeFilter.enable", "function.renderItemAnnotations.enable",
  "function.renderItemNotes.enable", "graphView.show", "graphView.theme", "function.Recent.enable",
  "delayTime", "cookies.cnki", "titleColumn.odd", "titleColumn.even",
  "titleColumn.selected", "IFColumn.info", "nestedTags.sortord", "nestedTags.linkSymbol",
  "textTagsColumn.prefix", "annotationColumn.style", "annotationColumn.color", "annotationColumn.circle",
  "AIGenerateTags.prompt", "remarkColumn.prompt", "function.menuVisibility.enable"
];
