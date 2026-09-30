/* Native integration tests. Loaded only into the isolated test XPI. */
import type { nativeSmoke } from './native-entry.ts';

interface NativeReport {
  version: string; zotero: string; started: string; revision: string;
  tests: Array<{ name: string; status: 'running' | 'passed' | 'failed'; error?: string; stack?: string }>;
  fatal?: string; preferenceWindowReady?: boolean; graphNodeCount?: number;
  pdfPageCount?: number; ok?: boolean; finished?: string;
  journalQueries?: string[]; graphThemes?: Record<string, string>;
  graphRendering?: Record<string, unknown>;
  screenshots?: string[]; screenshotErrors?: string[]; conflictNotification?: boolean;
  citationQueries?: string[];
}

async function runRefolioNativeSmoke(options: { profile: string; dataDir: string; report: string; fixture: string; revision: string }) {
  const report: NativeReport = {
    version: (Zotero.StylePersonal.api as typeof Zotero.StylePersonal.api & { __nativeSmoke: typeof nativeSmoke }).__nativeSmoke.version,
    zotero: Zotero.version, started: new Date().toISOString(), revision: options.revision, tests: []
  };
  const normalize = value => String(value).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  const save = () => IOUtils.writeUTF8(options.report, JSON.stringify(report, null, 2));
  const check = async (name, run) => {
    const test: NativeReport['tests'][number] = { name, status: 'running' };
    report.tests.push(test); await save();
    try { await run(); test.status = 'passed'; }
    catch (error) { Object.assign(test, { status: 'failed', error: String(error), stack: error.stack }); }
    await save();
  };
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const waitFor = async (read, message) => {
    for (let i = 0; i < 200; i++) {
      const value = read(); if (value) return value;
      await Zotero.Promise.delay(100);
    }
    throw new Error(message);
  };
  // Refuse every test write unless both profile and data directory are isolated.
  if (normalize(Zotero.Profile.dir) !== normalize(options.profile) || normalize(Zotero.DataDirectory.dir) !== normalize(options.dataDir)) {
    report.fatal = "Profile or data directory differs from the isolated test directory. No test items were written.";
    await save(); return;
  }
  const addon = Zotero.StylePersonal;
  const api = (addon.api as typeof addon.api & { __nativeSmoke: typeof nativeSmoke }).__nativeSmoke;
  const win = Zotero.getMainWindow();
  const mainDocument = win.document as unknown as Document;
  const capture = async (name, targetWindow = win as any) => {
    try {
      const snapshot = await targetWindow.browsingContext.currentWindowGlobal.drawSnapshot(
        new targetWindow.DOMRect(0, 0, targetWindow.innerWidth, targetWindow.innerHeight), 1, 'white');
      const canvas = targetWindow.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
      canvas.width = snapshot.width; canvas.height = snapshot.height;
      canvas.getContext('2d').drawImage(snapshot, 0, 0); snapshot.close();
      const bytes = Uint8Array.from(String(targetWindow.atob(canvas.toDataURL('image/png').split(',')[1])), char => char.charCodeAt(0));
      await IOUtils.write(PathUtils.join(PathUtils.parent(options.report), `${name}.png`), bytes);
      (report.screenshots ??= []).push(`${name}.png`);
    } catch (error) { (report.screenshotErrors ??= []).push(`${name}: ${error}`); }
  };
  type GraphFrame = HTMLIFrameElement & { contentWindow: Window & { renderer?: { nodes: Array<{ id: string }> } } };
  const control = (root, label, tag = 'input') => {
    const element = root.querySelector(`${tag}[aria-label="${label}"]`);
    assert(element, `Missing control: ${label}`); return element;
  };
  const button = (root, key) => {
    const element = [...root.querySelectorAll('button')].find(node => node.textContent === api.getString(key));
    assert(element, `Missing button: ${key}`); return element;
  };
  const change = element => element.dispatchEvent(new element.ownerDocument.defaultView.Event('change', { bubbles: true }));
  const graphFrame = () => (Array.from(mainDocument.querySelectorAll('iframe')) as GraphFrame[]).find(frame => frame.getAttribute('src')?.includes('stylepersonal/content/dist/index.html'));
  const answerPrompt = (choice: 'accept' | 'cancel', remember: boolean, screenshot?: string) => {
    let seen = 0, error: unknown;
    const observer = { observe(subject) {
      const dialogWindow = subject as any;
      const doc = dialogWindow.document;
      if (doc.title !== 'Refolio') return;
      seen++;
      dialogWindow.setTimeout(async () => {
        const dialog = doc.querySelector('#commonDialog');
        try {
          const checkbox = doc.querySelector('#checkbox');
          assert(!doc.querySelector('#checkboxContainer').hidden, 'Remember-choice checkbox is hidden');
          assert(checkbox.label === api.getString('ui-remember-choice'), 'Remember-choice label is incorrect');
          checkbox.checked = remember;
          checkbox.dispatchEvent(new dialogWindow.Event('command', { bubbles: true }));
          if (screenshot) await capture(screenshot, dialogWindow);
        } catch (caught) { error = caught; }
        finally { dialog.getButton(choice).click(); }
      }, 100);
    } };
    Services.obs.addObserver(observer, 'common-dialog-loaded');
    return {
      get seen() { return seen; },
      verify() { assert(seen === 1, `Expected one native prompt, received ${seen}`); if (error) throw error; },
      dispose() { Services.obs.removeObserver(observer, 'common-dialog-loaded'); }
    };
  };
  let preferences;
  const collectionView = () => {
    const view = win.ZoteroPane.collectionsView;
    if (!view) throw new Error('Collection view is unavailable');
    return view;
  };
  const libraryID = Zotero.Libraries.userLibraryID;
  const doiSuffix = options.revision.slice(0, 8);
  api.setPref('citations.onAdd', 'skip'); api.setPref('citations.onEmpty', 'skip');
  await check("Empty collection starts and unloads without waiting for a table", async () => {
    await addon.hooks.onMainWindowUnload(win);
    api.setPref('graphView.enable', true);
    api.setPref('graphView.mode', 'citations');
    api.setPref('graphView.scope', 'all');
    api.setPref('graphView.minYear', ''); api.setPref('graphView.maxYear', '');
    const empty = new Zotero.Collection();
    Object.assign(empty, { libraryID, name: "Refolio empty-view test " + Date.now() });
    await empty.saveTx();
    await collectionView().selectCollection(empty.id);
    const timeout = async promise => {
      let timer;
      try { await Promise.race([promise, new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(new Error("Empty view lifecycle timed out")),10000);})]); }
      finally { win.clearTimeout(timer); }
    };
    await timeout(addon.hooks.onMainWindowLoad(win));
    await timeout(addon.hooks.onMainWindowUnload(win));
    await collectionView().selectLibrary(libraryID);
    await timeout(addon.hooks.onMainWindowLoad(win));
  });
  await check("Startup and core feature lifecycle", async () => {
    assert(!(addon.api.featureFailures || []).length, JSON.stringify(addon.api.featureFailures));
    assert(!('getProStatus' in addon.api), "Pro runtime is still present");
    assert(addon.api.storage?.constructor.name === "LocalStorage", "Expected local JSON storage");
  });
  await check("Installed XPI is active with secure release updates", async () => {
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const installed = await AddonManager.getAddonByID("style-personal@nebularaven.local");
    assert(installed?.isActive, "The test XPI was not installed and activated");
    assert(installed.providesUpdatesSecurely, "Zotero rejected the update URL scheme");
  });
  const paper = new Zotero.Item("journalArticle");
  paper.libraryID = libraryID;
  paper.setField("title", "Refolio native smoke: source paper");
  paper.setField("shortTitle", "Source theory");
  paper.setField("extra", "Graph Label: Dual continuum");
  paper.setField("DOI", `10.5555/refolio-${doiSuffix}-a`);
  paper.setField("date", "2025");
  for (const tag of ["#Smoke(A)+", "#Smoke(A)+/Child", "#Smoke(A)+Other"]) paper.addTag(tag);
  await paper.saveTx();
  const target = new Zotero.Item("journalArticle");
  target.libraryID = libraryID;
  target.setField("title", "Refolio native smoke: cited paper");
  target.setField("DOI", `10.5555/refolio-${doiSuffix}-b`);
  target.setField("date", "2023");
  await target.saveTx();
  paper.addRelatedItem(target); await paper.saveTx();
  await check('Native Related Items do not invent a citation direction', async () => {
    const graph = await api.spGetCitationGraph([paper, target]);
    assert(graph.citationEdges.length === 0, 'An undirected related item became a citation');
  });
  await check("Deferred item columns initialize when items are available", async () => {
    await addon.api.itemTreeReady;
    assert(!(addon.api.featureFailures || []).length, JSON.stringify(addon.api.featureFailures));
  });
  await check("Native tag rename: literal characters and hierarchy boundary", async () => {
    await api.spRenameTags(Zotero, libraryID, "#Smoke(A)+", "#Renamed^");
    const tags = (await Zotero.Tags.getAll(libraryID)).map(tag => tag.tag);
    assert(tags.includes("#Renamed^") && tags.includes("#Renamed^/Child"), "The hierarchy was not renamed");
    assert(tags.includes("#Smoke(A)+Other"), "A different prefix was renamed");
  });
  await check("Native tag removal is limited to the exact hierarchy", async () => {
    await api.spRemoveTags(Zotero, libraryID, "#Renamed^");
    const tags = (await Zotero.Tags.getAll(libraryID)).map(tag => tag.tag);
    assert(!tags.includes("#Renamed^") && !tags.includes("#Renamed^/Child"), "Target tags remain");
    assert(tags.includes("#Smoke(A)+Other"), "Unrelated tag was removed");
  });
  await check("Graph labels read native Zotero fields", async () => {
    assert(api.spGraphLabel(paper, "shortTitle") === "Source theory", "Short title mismatch");
    assert(api.spGraphLabel(paper, "extra") === "Dual continuum", "Extra label mismatch");
  });
  await check("Native date formatting honors UTC zero and system time zone", async () => {
    const input = "2026-01-15 00:00:00";
    assert(api.spDisplayDate(api.dayjs, input, 0).format("HH:mm") === "00:00", "UTC zero was replaced");
    const actual = api.spDisplayDate(api.dayjs, input, "system").format("HH:mm");
    const expected = new Intl.DateTimeFormat("en-GB", {hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(input.replace(" ","T")+"Z"));
    assert(actual === expected, `System time mismatch: ${actual} / ${expected}`);
  });
  await check("Core settings pane loads without paid UI", async () => {
    const prefs = preferences = Zotero.Utilities.Internal.openPreferences("stylepersonal-preferences");
    const container = await waitFor(() => prefs.document.querySelector('#stylepersonal-settings[data-loaded=true] [data-pref="publicationTagsColumn.aliases"]'), "Settings controls did not load");
    assert(typeof JSON.parse(container.value) === "object", "Custom journal aliases were not initialized");
    assert(prefs.document.querySelector("#stylepersonal-settings").textContent.includes("CSCD"), "Built-in journal directory information is missing");
    assert(!prefs.document.querySelector("#stylepersonal-settings").textContent.includes("Style Pro"), "Paid UI remains");
    report.preferenceWindowReady = true;
  });
  await check('Native settings dropdown opens and saves its selected option', async () => {
    const key = 'citations.onAdd', before = api.getPref(key);
    const menu = preferences.document.querySelector('[data-pref="citations.onAdd"]');
    const popup = menu.querySelector('menupopup');
    try {
      assert(menu.localName === 'menulist' && popup, 'Expected a native menulist');
      menu.scrollIntoView({ block: 'center' }); preferences.focus(); menu.focus();
      const rect = menu.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      preferences.windowUtils.sendMouseEvent('mousedown', x, y, 0, 1, 0);
      preferences.windowUtils.sendMouseEvent('mouseup', x, y, 0, 1, 0);
      await waitFor(() => popup.state === 'open', 'The settings dropdown did not open');
      await capture('settings-dropdown', preferences);
      popup.querySelector('menuitem[value="ask"]').dispatchEvent(new preferences.Event('command', { bubbles: true }));
      await waitFor(() => menu.value === 'ask' && api.getPref(key) === 'ask', 'The chosen setting did not save');
    } finally { popup.hidePopup(); api.setPref(key, before); }
  });
  await check('All five languages render native settings and validation messages', async () => {
    const original = addon.data.locale.current;
    const Localizer = original.constructor as new (...args: any[]) => typeof original;
    const expected = [
      ['en-US', 'Edit journal labels…'], ['zh-CN', '编辑期刊评级…'], ['zh-TW', '編輯期刊評級…'],
      ['it-IT', 'Modifica etichette della rivista…'], ['ru-RU', 'Изменить метки журнала…']
    ];
    try {
      for (const [locale, title] of expected) {
        addon.data.prefs?.release?.();
        addon.data.locale.current = new Localizer(['stylepersonal-addon.ftl'], true, undefined, [locale]);
        await addon.hooks.onPrefsEvent('load', { window: preferences });
        const panel = preferences.document.querySelector('#stylepersonal-settings');
        assert(api.getString('ui-edit-journal-labels') === title, `Wrong native Fluent language: ${locale}`);
        assert(panel.textContent.includes(title), `Journal settings were not translated: ${locale}`);
        for (const input of panel.querySelectorAll('[data-pref]')) {
          const label = input.closest('.sp-field, .sp-check, .sp-feature-head')?.querySelector('span')?.textContent;
          assert(label && !label.startsWith('stylepersonal-') && label !== input.dataset.pref,
            `Untranslated setting in ${locale}: ${input.dataset.pref}`);
        }
        const labelField = panel.querySelector('[data-pref="graphView.labelField"]');
        assert(labelField.querySelector('menuitem[value="title"]').getAttribute('label') === api.getString('ui-title'),
          `Graph option was not translated: ${locale}`);
        assert(labelField.value === (api.getPref('graphView.labelField') || 'authorYear'), `Graph option value changed: ${locale}`);
        const year = panel.querySelector('[data-pref="graphView.minYear"]');
        const before = api.getPref('graphView.minYear'), beforeMax = api.getPref('graphView.maxYear');
        api.setPref('graphView.maxYear', '2000');
        try {
          year.value = '2001'; change(year);
          assert(year.closest('.sp-field').querySelector('.sp-error')?.textContent === api.getString('ui-error-invalid-year-range'),
            `Validation message was not translated: ${locale}`);
          assert(api.getPref('graphView.minYear') === before, 'Invalid input changed the saved year');
        } finally { api.setPref('graphView.maxYear', beforeMax); year.value = String(before ?? ''); }
        await capture(`settings-${locale}`, preferences);
      }
    } finally {
      addon.data.prefs?.release?.();
      addon.data.locale.current = original;
      await addon.hooks.onPrefsEvent('load', { window: preferences });
    }
  });
  await check('Feature switches save through native settings controls', async () => {
    const panel = preferences.document.querySelector('#stylepersonal-settings');
    for (const [key] of api.spFeatureDefinitions) assert(panel.querySelector(`[data-pref="function.${key}.enable"]`), `Missing switch: ${key}`);
    const toggle = panel.querySelector('[data-pref="function.manualJournalRanks.enable"]');
    const before = api.getPref('function.manualJournalRanks.enable');
    toggle.checked = false; change(toggle);
    assert(api.getPref('function.manualJournalRanks.enable') === false, 'Switch did not persist');
    toggle.checked = before !== false; change(toggle);
    const search = preferences.document.getElementById('prefs-search');
    const groupHidden = id => preferences.document.querySelector(`#sp-group-${id}`).classList.contains('hidden-by-search');
    for (const id of ['general', 'journals', 'graph', 'columns', 'reader']) {
      preferences.document.querySelector(`#sp-group-${id}`).scrollIntoView({ block: 'start' });
      await capture(`settings-${id}`, preferences);
    }
    search.value = api.getString('pref-publicationTagsColumn-rankColors');
    search.dispatchEvent(new preferences.Event('command', { bubbles: true }));
    await waitFor(() => groupHidden('reader'), 'Zotero search did not hide unmatched Refolio groups');
    assert(!groupHidden('journals'), 'Zotero search hid the matching group');
    assert(panel.querySelector('#sp-group-journals details.sp-more').open, 'Matching advanced options stayed collapsed');
    await capture('settings-search', preferences);
    search.value = ''; search.dispatchEvent(new preferences.Event('command', { bubbles: true }));
    await waitFor(() => !groupHidden('reader'), 'Clearing the search left Refolio groups hidden');
    await preferences.Zotero_Preferences.navigateToPane('stylepersonal-preferences');
  });
  await check('Native journal controls merge bilingual ratings and display conflicts', async () => {
    const keys = ['publicationTagsColumn.automaticUpdates', 'publicationTagsColumn.source', 'easyscholar.secretKey',
      'publicationTagsColumn.manualRanks', 'function.manualJournalRanks.enable'];
    const before = keys.map(key => [key, api.getPref(key)] as const);
    const originalGet = api.requests.get;
    const queried: string[] = [];
    try {
      api.setPref('publicationTagsColumn.automaticUpdates', false);
      api.setPref('publicationTagsColumn.source', 'easyscholar');
      api.setPref('function.manualJournalRanks.enable', true);
      api.setPref('easyscholar.secretKey', 'REFOLIO_NATIVE_FIXTURE');
      api.requests.get = async url => {
        const name = new URL(url).searchParams.get('publicationName'); queried.push(name);
        const ranks = { 'Acta Psychologica Sinica': { sciif: '2', ssci: 'Q1' },
          '心理学报': { sciif: '3', pku: '北核', cscd: 'CSCD' },
          'Human Nature-An Interdisciplinary Biosocial Perspective': { sciif: '2.0', ssci: 'Q1' } };
        assert(Object.hasOwn(ranks, name), `Unexpected test query: ${name}`);
        return { data: { officialRank: { all: ranks[name] } } };
      };
      const storage = addon.api.journalStorage;
      assert(storage, 'Journal storage was not registered'); await storage.lock.promise;
      await api.updatePublicationTags(storage, 'Acta Psychologica Sinica', 'settings');
      const popup = await waitFor(() => Array.from(Services.wm.getEnumerator(null)).find((window: any) =>
        window.document?.documentURI?.includes('progressWindow') && window.document.documentElement.textContent.includes('心理学报 = 3')),
        'Conflict notification did not display its source values') as Window;
      report.conflictNotification = true;
      await capture('journal-conflict-notification', popup);
      const merged = api.spGetAutomaticJournalRanks(storage, 'Acta Psychologica Sinica');
      assert(merged.sciif === '2' && merged.pku === '北核' && merged.cscd === 'CSCD', 'Bilingual merge failed');
      assert(api.spGetJournalLookup(storage, 'Acta Psychologica Sinica').conflicts.length === 1, 'Conflict was not recorded');
      addon.api.openManualJournal('Acta Psychologica Sinica');
      const panel = preferences.document.querySelector('#stylepersonal-manual-journals');
      const text = panel.querySelector('.sp-journal-conflicts').textContent;
      assert(text.includes('Acta Psychologica Sinica: 2') && text.includes('心理学报: 3'), 'Conflict sources are absent from the settings table');
      const mode = control(panel, api.getString('ui-field-mode', { args: { field: 'IF' } }), 'menulist');
      const value = control(panel, api.getString('ui-field-value', { args: { field: 'IF' } }));
      mode.value = 'override'; change(mode); value.value = '9';
      const saveButton = button(panel, 'ui-save-journal-settings'); saveButton.click();
      await waitFor(() => !saveButton.disabled, 'Manual rating save did not finish');
      assert(api.spGetJournalRanks(storage, '心理学报').sciif === '9', 'Manual override did not apply to the Chinese alias');
      assert(panel.querySelector('.sp-journal-conflicts').textContent.includes('9 ('), 'The chosen manual value is missing');
      await capture('journal-settings', preferences);
      addon.api.openManualJournal('Human Nature');
      control(panel, api.getString('ui-query-journal-name')).value = 'Human Nature-An Interdisciplinary Biosocial Perspective';
      saveButton.click(); await waitFor(() => !saveButton.disabled, 'Query-name save did not finish');
      assert(api.spGetAutomaticJournalRanks(storage, 'Human Nature').sciif === '2.0', 'Saved query name was not used');
      addon.api.openManualJournal('Acta Psychologica Sinica'); addon.api.openManualJournal('Human Nature');
      assert(control(panel, api.getString('ui-query-journal-name')).value.startsWith('Human Nature-An'), 'Query name did not reload');
      await storage.flush();
      const disk = JSON.parse(await IOUtils.readUTF8(storage.filename));
      assert(disk['Human Nature'].rankLookup.names[0].startsWith('Human Nature-An'), 'Journal lookup did not persist to disk');
      report.journalQueries = queried;
    } finally {
      api.requests.get = originalGet;
      for (const [key, value] of before) if (value !== undefined) api.setPref(key, value);
    }
  });
  await check("Graph frontend and library items render", async () => {
    await collectionView().selectLibrary(libraryID);
    const itemsView = win.ZoteroPane.itemsView;
    if (!itemsView) throw new Error('Item view is unavailable');
    await itemsView.refreshAndMaintainSelection();
    api.setPref('graphView.scope', 'all');
    type GraphFrame = HTMLIFrameElement & { contentWindow: Window & { renderer?: { nodes: unknown[] } } };
    const frame = await waitFor(() => (Array.from(win.document.querySelectorAll("iframe")) as GraphFrame[]).find(frame => frame.getAttribute("src")?.includes("stylepersonal/content/dist/index.html") && frame.contentWindow?.renderer), "Graph iframe did not initialize");
    await addon.api.refreshGraphView();
    assert(frame.contentWindow.renderer.nodes.length >= 2, "Graph did not render the test items");
    report.graphNodeCount = frame.contentWindow.renderer.nodes.length;
  });
  await check('Native confirmation remembers each choice independently', async () => {
    const library = Zotero.Libraries.get(libraryID);
    if (!library) throw new Error('Test library is unavailable');
    api.setPref('citations.onEmpty', 'ask');
    const prompt = answerPrompt('cancel', true, 'citation-prompt');
    try {
      assert(!api.spConfirmCitationUpdate('empty', 2, library.name), 'Skip returned update');
      prompt.verify();
      assert(api.getPref('citations.onEmpty') === 'skip', 'Remembered skip was not saved');
      assert(api.getPref('citations.onAdd') === 'skip', 'Empty-view choice changed the new-item policy');
      assert(!api.spConfirmCitationUpdate('empty', 2, library.name), 'Remembered skip changed');
      prompt.verify();
    } finally { prompt.dispose(); api.setPref('citations.onEmpty', 'skip'); }
  });
  await check('Manual citation controls save direction and native relations without DOIs', async () => {
    const source = new Zotero.Item('journalArticle'), cited = new Zotero.Item('journalArticle');
    for (const [item, title] of [[source, 'Manual citation source'], [cited, 'Manual citation target']] as const) {
      item.libraryID = libraryID; item.setField('title', title); await item.saveTx();
    }
    const container = mainDocument.querySelector('#graph');
    button(container, 'ui-add-citation').click();
    const panel = await waitFor(() => container.querySelector<HTMLElement>('.sp-manual-citation:not([hidden])'), 'Manual citation panel did not open');
    const citingSelect = control(panel, api.getString('ui-citing-paper'), 'menulist');
    const citedSelect = control(panel, api.getString('ui-cited-paper'), 'menulist');
    citingSelect.value = String(cited.id); citedSelect.value = String(source.id);
    button(panel, 'ui-swap-direction').click();
    assert(citingSelect.value === String(source.id) && citedSelect.value === String(cited.id), 'Swap did not reverse the selected papers');
    await capture('manual-citation');
    button(panel, 'ui-save').click();
    await waitFor(() => panel.hidden, 'Manual citation did not finish saving');
    assert(source.relatedItems.includes(cited.key) && cited.relatedItems.includes(source.key), 'Native reciprocal relations were not saved');
    const graph = await api.spGetCitationGraph([source, cited]);
    assert(graph.citationEdges.length === 1 && graph.citationEdges[0].source === source.id && graph.citationEdges[0].target === cited.id,
      'Manual citation direction is incorrect');
    const disk = JSON.parse(await IOUtils.readUTF8(PathUtils.join(options.dataDir, 'stylepersonal-citations.json')));
    assert(disk[`manual:${libraryID}`][source.key].includes(cited.key), 'Manual citation did not persist to disk');
  });
  await check('Adding papers prompts once and saves fetched citation directions', async () => {
    const source = new Zotero.Item('journalArticle'), cited = new Zotero.Item('journalArticle');
    const sourceDOI = `10.5555/refolio-${doiSuffix}-added-a`, citedDOI = `10.5555/refolio-${doiSuffix}-added-b`;
    const originalRequest = Zotero.HTTP.request;
    const queried: string[] = [];
    Zotero.HTTP.request = (async (method, url, ...rest) => {
      if (!String(url).startsWith('https://api.crossref.org/works/')) return originalRequest.call(Zotero.HTTP, method, url, ...rest);
      const doi = decodeURIComponent(String(url).split('/works/')[1]); queried.push(doi);
      assert([sourceDOI, citedDOI].includes(doi), `Unexpected Crossref fixture query: ${doi}`);
      return { response: { status: 'ok', message: { reference: doi === sourceDOI ? [{ DOI: citedDOI }] : [] } } };
    }) as typeof Zotero.HTTP.request;
    const prompt = answerPrompt('accept', true);
    api.setPref('citations.onAdd', 'ask');
    try {
      await Zotero.DB.executeTransaction(async () => {
        for (const [item, title, doi] of [[source, 'Fetched citation source', sourceDOI], [cited, 'Fetched citation target', citedDOI]] as const) {
          item.libraryID = libraryID; item.setField('title', title); item.setField('DOI', doi); await item.save();
        }
      });
      const metadata = item => { const json = item.toJSON(); delete json.relations; return JSON.stringify(json); };
      const before = [metadata(source), metadata(cited)];
      await waitFor(() => addon.api.citationReport?.edges.some(edge => edge.source === source.id && edge.target === cited.id),
        'New-item notification did not fetch the citation relation');
      prompt.verify();
      assert(api.getPref('citations.onAdd') === 'update', 'Remembered update was not saved');
      assert(api.getPref('citations.onEmpty') === 'skip', 'New-item choice changed the empty-view policy');
      assert(queried.length === 2 && addon.api.citationReport.requested === 2, 'New items were not queried as one batch');
      assert(source.relatedItems.includes(cited.key) && cited.relatedItems.includes(source.key), 'Fetched citations did not save native relations');
      assert(before[0] === metadata(source) && before[1] === metadata(cited), 'Citation saving changed bibliographic metadata');
      const disk = JSON.parse(await IOUtils.readUTF8(PathUtils.join(options.dataDir, 'stylepersonal-citations.json')));
      assert(disk.references[sourceDOI].references.includes(citedDOI), 'Fetched citation did not persist');
      const graph = await api.spGetCitationGraph([source, cited]);
      assert(graph.citationEdges.length === 1 && graph.citationEdges[0].source === source.id, 'Fetched citation direction changed');
      report.citationQueries = queried;
    } finally { api.setPref('citations.onAdd', 'skip'); prompt.dispose(); Zotero.HTTP.request = originalRequest; }
  });
  await check('View visibility and graph actions stay separate', async () => {
    const container = mainDocument.querySelector('#graph');
    const tabs = container.querySelector('[role=tablist]');
    const actions = container.querySelector('.sp-graph-actions');
    for (const key of ['ui-fetch-citations', 'ui-add-citation', 'ui-fit']) {
      const action = button(actions, key);
      assert(!tabs.contains(action) && action.getAttribute('role') !== 'tab', `${key} is a view category`);
    }
    assert(!tabs.querySelector('[data-mode=related], [data-mode=link]'), 'Removed graph categories remain');
    const mode = api.getPref('graphView.mode'); button(actions, 'ui-fit').click();
    assert(api.getPref('graphView.mode') === mode, 'Fit changed graph category');
    const keys = ['citations', 'note', 'author', 'tag', 'genealogy'];
    const panel = preferences.document.querySelector('#stylepersonal-settings');
    const toggle = (key, value) => { const input = panel.querySelector(`[data-pref="graphView.modes.${key}"]`); input.checked = value; change(input); };
    try {
      for (const key of keys) toggle(key, false);
      await addon.api.refreshGraphView();
      assert([...tabs.querySelectorAll('[data-mode]')].every((tab: HTMLElement) => tab.hidden), 'A hidden category remains visible');
      assert(button(actions, 'ui-fit').disabled && container.querySelector<HTMLElement>('.sp-graph-filters').hidden,
        'All-hidden graph still exposes active controls');
      toggle('citations', true); await addon.api.refreshGraphView();
      assert(tabs.querySelector('[data-mode=citations]').getAttribute('aria-selected') === 'true', 'Restored category was not selected');
      assert(!button(actions, 'ui-fit').disabled, 'Fit did not recover');
    } finally { for (const key of keys) toggle(key, true); await addon.api.refreshGraphView(); }
  });
  await check('Graph follows Zotero light and dark themes', async () => {
    const before = Zotero.Prefs.get('browser.theme.toolbar-theme', true);
    const container = mainDocument.querySelector<HTMLElement>('#graph');
    report.graphThemes = {};
    report.graphRendering = {};
    try {
      for (const [theme, value] of [['dark', 0], ['light', 1]] as const) {
        Zotero.Prefs.set('browser.theme.toolbar-theme', value, true);
        await waitFor(() => container.style.colorScheme === theme, `Graph did not switch to ${theme}`);
        const frame = graphFrame();
        if (theme === 'light') await waitFor(() => frame.contentDocument.body.style.backgroundColor !== report.graphThemes.dark,
          'Graph colors did not update after the host theme changed');
        assert(frame.contentDocument.documentElement.style.colorScheme === theme, 'Graph iframe uses the wrong theme');
        report.graphThemes[theme] = frame.contentDocument.body.style.backgroundColor;
        await Zotero.Promise.delay(800);
        const renderer = frame.contentWindow.renderer as any;
        report.graphRendering[theme] = { colors: renderer.colors, scale: renderer.scale, textAlpha: renderer.textAlpha,
          nodes: renderer.nodes.slice(0, 2).map(node => ({ labelAlpha: node.text?.alpha, labelColor: node.text?.style.fill, nodeAlpha: node.circle?.alpha })) };
        await capture(`graph-${theme}`);
      }
      assert(report.graphThemes.dark !== report.graphThemes.light, 'Graph colors did not change with the host theme');
    } finally { if (before !== undefined) Zotero.Prefs.set('browser.theme.toolbar-theme', before, true); }
  });
  await check('Graph filters and keyboard resizing operate in Zotero', async () => {
    const container = mainDocument.querySelector<HTMLElement>('#graph');
    const year = control(container, api.getString('ui-from-year'));
    year.value = '2024'; change(year);
    await waitFor(() => !graphFrame().contentWindow.renderer.nodes.some(node => String(node.id) === String(target.id)), 'Year filter did not remove the older paper');
    assert(graphFrame().contentWindow.renderer.nodes.some(node => String(node.id) === String(paper.id)), 'Year filter removed the newer paper');
    year.value = ''; change(year);
    await waitFor(() => graphFrame().contentWindow.renderer.nodes.some(node => String(node.id) === String(target.id)), 'Clearing the year filter did not restore the paper');
    const handle = container.querySelector('.sp-graph-resizer');
    const height = Math.round(container.getBoundingClientRect().height);
    handle.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    assert(parseInt(api.getPref('graphView.height')) === height + 20, 'Keyboard graph resizing did not persist');
  });
  await check('Manual genealogy supports add, delete and undo in the native panel', async () => {
    const before = api.getPref('genealogy.manualData');
    const container = mainDocument.querySelector<HTMLElement>('#graph');
    try {
      container.querySelector<HTMLButtonElement>('[data-mode=genealogy]').click();
      const panel = container.querySelector<HTMLElement>('.sp-genealogy');
      await waitFor(() => !panel.hidden, 'Genealogy panel did not open');
      const details = panel.querySelector('.sp-genealogy-editor').closest<HTMLDetailsElement>('details'); details.open = true;
      control(details, api.getString('ui-mentor-name')).value = 'Native Test Mentor';
      control(details, api.getString('ui-student-name')).value = 'Native Test Student';
      button(details, 'ui-add-relationship').click();
      const relationCount = () => Object.keys(JSON.parse(api.getPref('genealogy.manualData')).relations).length;
      const initial = before ? Object.keys(JSON.parse(before).relations).length : 0;
      await waitFor(() => relationCount() === initial + 1 && details.textContent.includes('Native Test Mentor → Native Test Student'), 'Manual relationship did not save');
      assert(graphFrame().contentWindow.renderer.nodes.length >= 2, 'Manual genealogy did not render');
      await capture('manual-genealogy');
      const row = [...details.querySelectorAll('.sp-genealogy-row')].find(node => node.textContent.includes('Native Test Mentor → Native Test Student'));
      button(row, 'ui-delete').click(); await waitFor(() => relationCount() === initial, 'Manual deletion failed');
      button(details, 'ui-undo-deletion').click(); await waitFor(() => relationCount() === initial + 1, 'Manual undo failed');
      assert(panel.querySelector('a').href === 'https://academictree.org/', 'Academic Family Tree link is restricted to one discipline');
    } finally {
      if (before !== undefined) api.setPref('genealogy.manualData', before);
      container.querySelector<HTMLButtonElement>('[data-mode=citations]').click();
    }
  });
  await check("PDF reader opens with Refolio toolbar and reading recording disabled", async () => {
    const attachment = await Zotero.Attachments.importFromFile({file:options.fixture,parentItemID:paper.id});
    const opened = await Zotero.Reader.open(attachment.id);
    if (!opened) throw new Error('PDF reader did not open');
    const reader = opened as _ZoteroTypes.ReaderInstance<'pdf'> & { close(): void };
    try {
      await reader._initPromise;
      await waitFor(() => reader._iframeWindow?.document.querySelector(".pdf-styles"), "PDF style toolbar did not load");
      const view = await waitFor(() => reader._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication, "PDF viewer did not initialize");
      await waitFor(() => view.pagesCount === 1, "Expected a one-page test PDF");
      assert(Zotero.Prefs.get("stylepersonal.readingProgress.recordingEnabled") === false, "Reading recording is enabled");
      assert(!await addon.api.storage.get(paper, "readingTime"), "Disabled recording wrote reading time");
      report.pdfPageCount = view.pagesCount;
    } finally { reader.close(); }
  });
  if (preferences && !preferences.closed) preferences.close();
  await check('Reload releases graph DOM, storage and hooks without duplicates', async () => {
    const storage = addon.api.journalStorage;
    const frame = graphFrame();
    const hookCount = addon.data.patch.getItems?.data.length;
    await addon.hooks.onMainWindowUnload(win);
    assert(storage.disposed, 'Old journal storage remains active');
    assert(!frame.isConnected && !win.document.querySelector('#graph'), 'Old graph DOM remains attached');
    assert(!addon.api.refreshGraphView, 'Old graph callback remains registered');
    await addon.hooks.onMainWindowLoad(win); await addon.api.itemTreeReady;
    await waitFor(() => graphFrame()?.contentWindow?.renderer, 'Reloaded graph did not initialize');
    assert(win.document.querySelectorAll('#graph').length === 1, 'Duplicate graph panels');
    assert(win.document.querySelectorAll('#stylepersonal-settings-panel').length === 1, 'Duplicate settings menu');
    assert(addon.data.patch.getItems?.data.length === hookCount, 'Item-filter hooks accumulated on reload');
    assert(addon.api.journalStorage !== storage, 'Reload reused disposed journal storage');
    assert(!(addon.api.featureFailures || []).length, JSON.stringify(addon.api.featureFailures));
  });
  report.ok = report.tests.every(test => test.status === "passed");
  report.finished = new Date().toISOString();
  await save();
  Zotero.debug(`Refolio native tests: ${report.tests.filter(test => test.status === "passed").length}/${report.tests.length} passed. ${options.report}`);
}
