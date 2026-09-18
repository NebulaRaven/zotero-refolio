import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { assembleModule, addonFiles, compileScript, root, validateManifest } from './build.mts';
import { zip } from './zip.mts';
const args=process.argv.slice(2);
const arg=(name: string)=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const updating=args.includes('--update');
const previous=updating?JSON.parse(await fs.readFile(path.join(root,'native-test-location.json'),'utf8')):null;
if(updating&&!previous.runner)throw new Error('The existing test window has no reload runner. Start a new test window first.');
const testDirectory=arg('--test-dir');
const base=updating?previous.base:testDirectory?path.resolve(testDirectory):await fs.mkdtemp(path.join(os.tmpdir(),'refolio-native-'));
const profile=path.join(base,'profile'),dataDir=path.join(base,'data'),report=path.join(base,'native-report.json');
await fs.mkdir(base,{recursive:true});
const fixture=path.join(base,'reader-fixture.pdf');
const stream='BT /F1 18 Tf 72 720 Td (Refolio Reader Test) Tj ET\n';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
let pdf='%PDF-1.4\n';const offsets=[0];
for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
const xref=Buffer.byteLength(pdf);
pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await fs.writeFile(fixture,pdf);
try { if(!updating){await fs.access(path.join(profile,'prefs.js')); throw new Error('Use a fresh test directory. Existing profiles are not modified.');} }
catch(error) { if(!(error instanceof Error) || !('code' in error) || error.code!=='ENOENT')throw error; }
await fs.mkdir(path.join(profile,'extensions'),{recursive:true});await fs.mkdir(dataDir,{recursive:true});
const prefs={
  'extensions.zotero.useDataDir':true,'extensions.zotero.dataDir':dataDir,
  'extensions.zotero.firstRun2':false,'extensions.zotero.sync.autoSync':false,
  'extensions.autoDisableScopes':0,'extensions.enabledScopes':15,
  'extensions.installDistroAddons':false,'app.update.auto':false,'app.update.enabled':false,
  'extensions.logging.enabled':true,'browser.dom.window.dump.enabled':true,
  'extensions.update.enabled':false,
  'extensions.zotero.automaticScraperUpdates':false,'extensions.zotero.reportTranslationFailure':false,
  'extensions.zotero.stylepersonal.graphView.enable':true,
  'extensions.zotero.stylepersonal.graphView.mode':'related'
};
if(!updating)await fs.writeFile(path.join(profile,'user.js'),Object.entries(prefs).map(([key,value])=>`user_pref(${JSON.stringify(key)},${JSON.stringify(value)});`).join('\n'));
const entries=await addonFiles();
validateManifest(JSON.parse(entries.find(([name])=>name==='manifest.json')![1].toString()));
const source=await assembleModule('tests/native-entry.ts');
entries.push(['chrome/content/scripts/refolio.js',Buffer.from(source)]);
const testSource=await compileScript('tests/zotero-smoke.ts');
const bootstrap=entries.find(([name])=>name==='bootstrap.js')!;
let code=bootstrap[1].toString()+'\n'+testSource;
code=code.replace('  await Zotero.initializationPromise;', '  await IOUtils.writeUTF8('+JSON.stringify(report)+',JSON.stringify({stage:"bootstrap",ok:null}));\n  await Zotero.initializationPromise;');
code=code.replace('await Zotero.StylePersonal.hooks.onStartup();','await Zotero.StylePersonal.hooks.onStartup();\n    await runRefolioNativeSmoke('+JSON.stringify({profile,dataDir,report,fixture})+');');
code=code.replace('} catch (error) {','} catch (error) {\n    await IOUtils.writeUTF8('+JSON.stringify(report)+',JSON.stringify({ok:false,fatal:String(error),stack:error.stack}));');
bootstrap[1]=Buffer.from(code);
const candidate=path.join(base,'candidate.xpi'),request=path.join(base,'request.json'),status=path.join(base,'runner-status.json');
await fs.writeFile(candidate,zip(entries));
if(!updating){
  const manifest={manifest_version:2,name:'Refolio isolated test runner',version:'1.0',applications:{zotero:{id:'style-test-runner@nebularaven.local',strict_min_version:'10.0',strict_max_version:'10.*',update_url:'https://style-personal.invalid/test-runner.json'}}};
  const runner='var runnerOptions='+JSON.stringify({profile,dataDir,candidate,request,status})+';\n'+await compileScript('tests/zotero-runner.ts');
  await fs.writeFile(path.join(profile,'extensions','style-test-runner@nebularaven.local.xpi'),zip([['manifest.json',JSON.stringify(manifest)],['bootstrap.js',runner]]));
  await fs.writeFile(path.join(root,'native-test-location.json'),JSON.stringify({base,profile,dataDir,report,runner:true},null,2));
}
await fs.writeFile(request+'.tmp',JSON.stringify({revision:randomUUID()}));
await fs.rename(request+'.tmp',request);
console.log(JSON.stringify({profile,dataDir,report},null,2));
if(!updating&&!args.includes('--prepare-only')) {
  const executable=arg('--zotero') || 'C:\\Program Files\\Zotero\\zotero.exe';
  const stdout=await fs.open(path.join(base,'zotero.stdout.log'),'a');
  const stderr=await fs.open(path.join(base,'zotero.stderr.log'),'a');
  const child=spawn(executable,['-no-remote','-profile',profile,'-ZoteroDebugText'],{detached:true,stdio:['ignore',stdout.fd,stderr.fd],windowsHide:false});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  await stdout.close();await stderr.close();
  child.unref();
  console.log('Opened an isolated Zotero test window. The script writes a native-report.json result. No release is published.');
}
if(updating)console.log('Queued the rebuilt test XPI for the running isolated Zotero window.');
