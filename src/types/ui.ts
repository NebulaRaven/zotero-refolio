export interface EditableText extends HTMLElement { value: string; placeholder: string; }
export interface TagElement extends HTMLElement { update(): void; }
/** A toolbarbutton of the nested tags control bar; `timer` holds its pending hide timeout. */
export interface NestedTagsControlIcon extends XULElement { timer?: number; readonly parentNode: NestedTagsControlBar | null; }
/** The nested tags control bar: every child is a control icon. */
export interface NestedTagsControlBar extends HTMLElement { readonly childNodes: NodeListOf<NestedTagsControlIcon>; }
export interface TabPopup extends HTMLElement { _tabMenuBound?: EventListener; state: 'closed' | 'showing' | 'open' | 'hiding'; }
