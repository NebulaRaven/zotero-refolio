export {};

declare global {
  namespace Zotero {
    const Profile: { dir: string };
  }
  interface nsIWindowMediator {
    // nsIWindowMediator.idl: a null window type enumerates the windows of every type.
    getEnumerator(aWindowType: string | null): nsISimpleEnumerator;
  }
}
