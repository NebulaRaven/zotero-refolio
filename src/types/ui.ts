export interface EditableText extends HTMLElement { value: string; placeholder: string; }
export interface TagElement extends HTMLElement { update(): void; }
export interface PreferenceRow extends HTMLElement { value: string | number | boolean; }
export interface TabPopup extends HTMLElement { _tabMenuBound?: EventListener; state: 'closed' | 'showing' | 'open' | 'hiding'; }
