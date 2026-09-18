import fs from 'node:fs/promises';
import vm from 'node:vm';
import { assemble, root, addonFiles, validateManifest } from './build.mts';
validateManifest(JSON.parse(await fs.readFile(root+'/addon/manifest.json','utf8')));
const source=await assemble();new vm.Script(source);
const forbidden=/pro\.muisedestiny|ethereal-pro-|ProtectedPro|enrollmentToken|createProRuntime/;
if(forbidden.test(source))throw new Error('Pro authorization code remains');
for(const [name,data] of await addonFiles()) {
  if(name.endsWith('.enc')||name.includes('/pro/'))throw new Error('Pro asset remains: '+name);
  if(name.endsWith('.js')&&!name.includes('/dist/'))new vm.Script(data.toString(),{filename:name});
}
const defaults: Array<[string, string | number | boolean]>=[];vm.runInNewContext(await fs.readFile(root+'/addon/prefs.js','utf8'),{pref:(key: string,value: string | number | boolean)=>defaults.push([key,value])});
if(defaults.some(([key])=>!key.startsWith('extensions.zotero.stylepersonal.')))throw new Error('Global or upstream preference override');
console.log(JSON.stringify({syntax:'passed',proRemoval:'passed',preferenceIsolation:'passed',sourceBytes:Buffer.byteLength(source)}));
