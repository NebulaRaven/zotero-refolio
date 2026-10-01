export interface EditableText extends HTMLElement { value: string; placeholder: string; }
export interface TagElement extends HTMLElement { update(): void; }
export interface TabPopup extends HTMLElement { _tabMenuBound?: EventListener; state: 'closed' | 'showing' | 'open' | 'hiding'; }
