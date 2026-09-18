/* Isolated test runner; never included in the production XPI. */
declare const runnerOptions: { profile: string; dataDir: string; request: string; candidate: string; status: string };
var runnerTimer, runnerBusy = false, runnerRevision;
function install() {}
function uninstall() {}
async function startup() {
  const { setInterval } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  await Promise.all([Zotero.initializationPromise, Zotero.uiReadyPromise]);
  const same = (a, b) => String(a).replace(/\\/g, "/").toLowerCase() === String(b).replace(/\\/g, "/").toLowerCase();
  if (!same(Zotero.Profile.dir, runnerOptions.profile) || !same(Zotero.DataDirectory.dir, runnerOptions.dataDir)) {
    throw new Error("Test runner refuses a non-isolated profile or data directory");
  }
  const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
  const self = await AddonManager.getAddonByID("style-test-runner@nebularaven.local");
  self.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DISABLE;
  const run = async () => {
    if (runnerBusy) return;
    runnerBusy = true;
    try {
      const request = JSON.parse(await IOUtils.readUTF8(runnerOptions.request));
      if (request.revision === runnerRevision) return;
      runnerRevision = request.revision;
      const previousRun = (Zotero.StylePersonal?.api as { __nativeRun?: Promise<void> })?.__nativeRun;
      await previousRun?.catch(error => Zotero.logError(error));
      await IOUtils.writeUTF8(runnerOptions.status, JSON.stringify({stage:"installing",revision:runnerRevision}));
      const file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      file.initWithPath(runnerOptions.candidate);
      const candidate = await AddonManager.getInstallForFile(file);
      if (candidate.addon?.id !== "style-personal@nebularaven.local") throw new Error("Unexpected test package ID");
      await candidate.install();
      const installed = await AddonManager.getAddonByID("style-personal@nebularaven.local");
      await IOUtils.writeUTF8(runnerOptions.status, JSON.stringify({stage:"installed",revision:runnerRevision,active:installed.isActive,appDisabled:installed.appDisabled}));
    } catch (error) {
      await IOUtils.writeUTF8(runnerOptions.status, JSON.stringify({stage:"failed",revision:runnerRevision,error:String(error),stack:error.stack}));
    } finally { runnerBusy = false; }
  };
  runnerTimer = setInterval(run, 2000);
  await run();
}
function shutdown() {
  const { clearInterval } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  clearInterval(runnerTimer);
}
