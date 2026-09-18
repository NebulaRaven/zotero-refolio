import { testGetString, testGetErrorMessage } from './localization.ts';
import { script } from './source.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { assemble, filesIn, root, validateManifest, compileScript, createUpdateManifest, sourceFiles } from '../scripts/build.mts';
import { createHash } from 'node:crypto';
import { zip } from '../scripts/zip.mts';
import { spPublicationNames, spNormalizeJournalName, spMergeRanks, spJournalQuery, spJournalConflictSignature } from '../src/core/journals.ts';
import { spManualRankRecord } from '../src/core/manualRanks.ts';

test('assembled plugin parses, has its own namespace, and contains no Pro authorization runtime', async()=>{
  const source=await assemble(); new vm.Script(source);
  assert.ok(source.includes('addonInstance: "StylePersonal"'));
  assert.ok(!/pro\.muisedestiny|ethereal-pro-|ProtectedPro|enrollmentToken|createProRuntime/.test(source));
  assert.ok(!source.includes('rename(1, tag2'));
  assert.ok(source.includes('io._lastButtonId === "tag-rename"'));
});
test('defaults stay within the fork namespace and do not create a reading-progress library item',async()=>{
  const prefs=new Map();vm.runInNewContext(await fs.readFile(root+'/addon/prefs.js','utf8'),{pref:(key,value)=>prefs.set(key,value)});
  assert.ok([...prefs.keys()].every(key=>key.startsWith('extensions.zotero.stylepersonal.')));
  assert.equal(prefs.get('extensions.zotero.stylepersonal.storage.in'),'file');
  assert.equal(prefs.get('extensions.zotero.stylepersonal.readingProgress.recordingEnabled'),false);
  assert.equal(prefs.get('extensions.zotero.stylepersonal.dateAddedColumn.deltaHour'),'system');
});
test('package excludes encrypted assets and upstream auto-updates',async()=>{
  const files=await filesIn(root+'/addon');
  assert.ok(!files.some(([name])=>name.includes('/pro/')||name.endsWith('.enc')));
  const manifest=JSON.parse(await fs.readFile(root+'/addon/manifest.json','utf8'));
  assert.equal(manifest.applications.zotero.id,'style-personal@nebularaven.local');
  validateManifest(manifest);
  const missing = structuredClone(manifest);
  delete missing.applications.zotero.update_url;
  assert.throws(()=>validateManifest(missing), /Zotero requires/);
  const remote = structuredClone(manifest);
  remote.applications.zotero.update_url='https://example.org/updates.json';
  assert.throws(()=>validateManifest(remote), /Refolio release manifest/);
  remote.applications.zotero.update_url='data:application/json,%7B%7D';
  assert.throws(()=>validateManifest(remote), /Refolio release manifest/);
  const bootstrap=await compileScript('src/bootstrap.ts');
  assert.ok(!bootstrap.includes('applyBackgroundUpdates'));
  assert.deepEqual(zip([['a.txt','test']]),zip([['a.txt','test']]));
});
test('release updates point to the matching XPI, checksum and Zotero compatibility', async()=>{
  const manifest=JSON.parse(await fs.readFile(root+'/addon/manifest.json','utf8'));
  const archive=zip([['manifest.json',JSON.stringify(manifest)]]);
  const update=createUpdateManifest(manifest,archive).addons[manifest.applications.zotero.id].updates[0];
  assert.equal(update.version,manifest.version);
  assert.equal(update.update_link,`https://github.com/NebulaRaven/zotero-refolio/releases/download/v${manifest.version}/refolio-${manifest.version}.xpi`);
  assert.equal(update.update_hash,'sha256:'+createHash('sha256').update(archive).digest('hex'));
  assert.deepEqual(update.applications.zotero,{
    strict_min_version:manifest.applications.zotero.strict_min_version,
    strict_max_version:manifest.applications.zotero.strict_max_version
  });
  assert.throws(()=>validateManifest({...manifest,version:'0.0.0'}), /match the plugin configuration/);
});
test('release source archive includes build inputs and excludes local profiles and output', async()=>{
  const files=await sourceFiles();
  const names=files.map(([name])=>name);
  for(const name of ['src/index.ts','scripts/build.mts','pnpm-lock.yaml','LICENSE','.github/workflows/check.yml']) {
    assert.ok(names.includes(name),name);
  }
  assert.ok(!names.some(name=>/^(work|dist|node_modules|\.git)\//.test(name)||name==='native-test-location.json'));
});
test('shutdown unregisters the preference pane by pane ID, not plugin ID',async()=>{
  let removed;
  const addon={data:{alive:true},api:{}};
  const context: vm.Context = {addon,spCitationAbort:undefined,config:{addonID:'style-personal@nebularaven.local',addonInstance:'StylePersonal'},
    Zotero:{StylePersonal:addon,PreferencePanes:{unregister:id=>{removed=id;}}},ztoolkit:{unregisterAll:()=>{}}};
  vm.runInNewContext(await script(root+'/src/app/hooks.ts')+';globalThis.stop=onShutdown;',context);
  await context.stop();assert.equal(removed,'stylepersonal-preferences');assert.equal(addon.data.alive,false);
});
test('packaged default settings use the script loader and preserve existing preferences',async()=>{
  const values=new Map([['extensions.zotero.stylepersonal.existing',false]]);
  const packageURI='jar:file:///isolated/style.xpi!/';
  const context: vm.Context = {rootURI:packageURI,Services:{scriptloader:{loadSubScript:(uri,target)=>{
    assert.equal(uri,packageURI+'prefs.js');
    target.pref('extensions.zotero.stylepersonal.existing',true);
    target.pref('extensions.zotero.stylepersonal.missing','system');
  }}},Zotero:{Prefs:{get:key=>values.get(key),set:(key,value)=>values.set(key,value)}}};
  vm.runInNewContext(await script(root+'/src/upstream/features/preferences/defaultPreferences.ts'),context);
  assert.equal(await context.restoreMissingDefaultPreferences(),1);
  assert.equal(values.get('extensions.zotero.stylepersonal.existing'),false);
  assert.equal(values.get('extensions.zotero.stylepersonal.missing'),'system');
});
test('an empty item tree does not block startup and can be cancelled before it becomes ready',async()=>{
  const context: vm.Context = {addon:{api:{}}};let finish, destroyed=0;
  const itemTree={ready:new Promise(resolve=>{finish=resolve;}),destroy:()=>{destroyed++;finish();}};
  const sandbox: vm.Context = {};
  vm.runInNewContext(await script(root+'/src/upstream/features/item-tree/itemTreeLifecycle.ts'),sandbox);
  const stop=sandbox.startDeferredItemTree(context,itemTree,error=>assert.fail(String(error.error)));
  assert.equal(typeof stop,'function');assert.equal(context.itemTreeExtensionHost,undefined);
  await stop();assert.equal(destroyed,1);assert.equal(context.itemTreeExtensionHost,undefined);
  assert.equal(context.addon.api.itemTreeReady,undefined);
});
test('graph refresh tolerates labels whose Pixi graphics have not been created yet',async()=>{
  const sandbox: vm.Context = {};
  vm.runInNewContext(await script(root+'/src/upstream/features/collections/graphView.ts'),sandbox);
  const node: {text?: {text: string}; _getDisplayText: () => string; getDisplayText: () => string}={_getDisplayText:()=>'',getDisplayText:()=>'Refreshed label'};
  let changed=0;
  const host={active:true,getItemDisplayText:()=>'',renderer:{nodes:[node],setData:()=>{},changed:()=>changed++,onResize:()=>{}}};
  sandbox.GraphView.prototype.setData.call(host,{});
  node.text={text:'Old label'};
  sandbox.GraphView.prototype.setData.call(host,{});
  assert.equal(node.text.text,'Refreshed label');assert.equal(changed,2);
});
async function journalHarness(responseByName, oldRank={}, title='Acta Psychologica Sinica') {
  const code=await script(root+'/src/upstream/utils/base.ts', 'updatePublicationTags');
  let stored;const urls=[]; const cache: Record<string, unknown> = {rank:oldRank};
  const context: vm.Context = {spPublicationNames,spNormalizeJournalName,spMergeRanks,spJournalQuery,spJournalConflictSignature,spManualRankRecord,
    getString: testGetString,getErrorMessage: testGetErrorMessage,ztoolkit:{ProgressWindow:class {show(){return this;} createLine(){return this;}}},getPref:key=>({
    'publicationTagsColumn.source':'easyscholar','easyscholar.secretKey':'TEST_KEY',
    'publicationTagsColumn.aliases':'{}'
  })[key],getPublicationTagNotificationPolicy:()=>({showError:false,showResult:false}),getHTTPStatus:()=>500,
  publicationRequestScheduler:{run:(_key,fn)=>fn()},requests:{get:async url=>{
    urls.push(url);const name=new URL(url).searchParams.get('publicationName');
    const response=responseByName[name];if(response instanceof Error)throw response;return response;
  }}};
  vm.runInNewContext(await script(root+'/src/app/journalLookup.ts'),context);
  vm.runInNewContext(code+';globalThis.run=updatePublicationTags;',context);
  await context.run({get:(_item,field)=>cache[field],set:async(item,field,value)=>{assert.equal(item.key,title);cache[field]=value;if(field==='rank')stored=value;}},title);
  return {stored:stored&&JSON.parse(JSON.stringify(stored)),urls};
}
test('actual journal updater merges English IF with Chinese PKU labels',async()=>{
  const {stored,urls}=await journalHarness({'Acta Psychologica Sinica':{data:{officialRank:{all:{sciif:2.4}}}},'心理学报':{data:{officialRank:{all:{pku:'北大中文核心'}}}}});
  assert.deepEqual(stored,{sciif:'2.4',pku:'北大中文核心'});assert.equal(urls.length,2);
});

test('actual journal updater uses the built-in CSCD names and leaves primary ranks intact',async()=>{
  const {stored,urls}=await journalHarness({
    'Acta Metrologica Sinica':{data:{officialRank:{all:{sciif:1.2}}}},
    '计量学报':{data:{officialRank:{all:{sciif:0.8,pku:'北大中文核心',cscd:'核心库'}}}}
  },{},'Acta Metrologica Sinica');
  assert.deepEqual(stored,{sciif:'1.2',pku:'北大中文核心',cscd:'核心库'});
  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('publicationName')),['Acta Metrologica Sinica','计量学报']);
});
test('actual journal updater preserves old fields on partial alias failure and never erases cache on total failure',async()=>{
  let result=await journalHarness({'Acta Psychologica Sinica':{data:{officialRank:{all:{sciif:2.4}}}},'心理学报':new Error('network')},{pku:'北核',sciif:'2.0'});
  assert.deepEqual(result.stored,{pku:'北核',sciif:'2.4'});
  result=await journalHarness({'Acta Psychologica Sinica':new Error('network'),'心理学报':new Error('network')},{pku:'北核'});
  assert.equal(result.stored,undefined);
});
