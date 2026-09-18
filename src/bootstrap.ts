/**
 * Adapted from MuiseDestiny/zotero-addon-template, bootstrap branch.
 * Original template by windingwind, based on Zotero Make It Red.
 */
var chromeHandle: { destruct(): void } | null;
function install() {}
async function startup({rootURI, resourceURI}: { rootURI?: string; resourceURI: { spec: string } }, reason: number) {
  await Zotero.initializationPromise;
  rootURI ||= resourceURI.spec;
  const {AddonManager} = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
  const original = await AddonManager.getAddonByID("zoterostyle@polygon.org");
  if (original?.isActive) throw new Error("Disable official Style before enabling Refolio; both patch the same Zotero UI.");
  const service = Components.classes["@mozilla.org/addons/addon-manager-startup;1"].getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = service.registerChrome(Services.io.newURI(rootURI + "manifest.json"), [["content","stylepersonal",rootURI + "chrome/content/"]]);
  const context = {rootURI} as { rootURI: string; _globalThis: unknown }; context._globalThis = context;
  try {
    Services.scriptloader.loadSubScript(rootURI + "chrome/content/scripts/refolio.js", context);
    await Zotero.StylePersonal.hooks.onStartup();
  } catch (error) {
    await Zotero.StylePersonal?.hooks.onShutdown();
    chromeHandle?.destruct(); chromeHandle = null;
    throw error;
  }
}
async function onMainWindowLoad({window}: { window: _ZoteroTypes.MainWindow }) { await Zotero.StylePersonal?.hooks.onMainWindowLoad(window); }
async function onMainWindowUnload({window}: { window: _ZoteroTypes.MainWindow }) { await Zotero.StylePersonal?.hooks.onMainWindowUnload(window); }
async function shutdown() {
  try { await Zotero.StylePersonal?.hooks.onShutdown(); }
  finally { chromeHandle?.destruct(); chromeHandle = null; }
}
function uninstall() {}
