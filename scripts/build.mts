import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build as bundle, transform, type BuildOptions } from 'esbuild';
import { zip, type ArchiveEntry } from './zip.mts';
import type { JournalName } from '../src/core/models.ts';
import { version2, config } from '../src/upstream/config.ts';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const releaseRepository = 'https://github.com/NebulaRaven/zotero-refolio';
export const updateURL = releaseRepository + '/releases/latest/download/updates.json';
export interface Manifest {
  version: string;
  applications: { zotero: { id: string; update_url: string; strict_min_version: string; strict_max_version: string } };
}
export function validateManifest(manifest: Manifest): void {
  const app = manifest.applications?.zotero;
  if (!app?.id || !app.update_url || !app.strict_min_version || !app.strict_max_version) {
    throw new Error('Zotero requires applications.zotero.id, update_url and compatibility bounds.');
  }
  if (app.update_url !== updateURL) {
    throw new Error('The update URL must point to the Refolio release manifest.');
  }
  if (app.id !== config.addonID || manifest.version !== version2) {
    throw new Error('The manifest ID and version must match the plugin configuration.');
  }
}
export function createUpdateManifest(manifest: Manifest, archive: Buffer) {
  validateManifest(manifest);
  const { id, strict_min_version, strict_max_version } = manifest.applications.zotero;
  return { addons: { [id]: { updates: [{
    version: manifest.version,
    update_link: `${releaseRepository}/releases/download/v${manifest.version}/refolio-${manifest.version}.xpi`,
    update_hash: 'sha256:' + createHash('sha256').update(archive).digest('hex'),
    applications: { zotero: { strict_min_version, strict_max_version } }
  }] } } };
}
export async function sourceFiles(): Promise<ArchiveEntry[]> {
  const names = ['.gitignore', 'LICENSE', 'README.md', 'README.zh-CN.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    ...(await fs.readdir(root)).filter(name => /^tsconfig(?:\.[\w-]+)?\.json$/.test(name))];
  const entries: ArchiveEntry[] = await Promise.all(names.map(async name => [name, await fs.readFile(path.join(root, name))]));
  for (const directory of ['.github', 'addon', 'data', 'docs', 'scripts', 'src', 'tests']) {
    entries.push(...await filesIn(path.join(root, directory), directory + '/'));
  }
  return entries.sort((a, b) => a[0].localeCompare(b[0], 'en'));
}
export const bundleOptions: BuildOptions = {
  absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'neutral',
  target: 'firefox140', keepNames: true, treeShaking: false, legalComments: 'inline',
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
  plugins: [{
    name: 'project-sources',
    setup(build) {
      // Every runtime dependency is vendored; resolve only explicit project files.
      build.onResolve({ filter: /.*/ }, ({ path: filename, importer }) => {
        const resolved = path.resolve(importer ? path.join(root, path.dirname(importer)) : root, filename);
        if (path.relative(root, resolved).startsWith('..')) throw new Error(`Dependency outside project: ${filename}`);
        return { path: path.relative(root, resolved).replaceAll('\\', '/'), namespace: 'refolio' };
      });
      build.onLoad({ filter: /.*/, namespace: 'refolio' }, async ({ path: filename }) => {
        let contents = await fs.readFile(path.join(root, filename), 'utf8');
        if (filename === 'data/journals.json') {
          const directory = JSON.parse(contents) as { journals: JournalName[] };
          contents = JSON.stringify({ journals: directory.journals.map(({ zh, en, aliases }) => ({ zh, en, aliases })) });
        }
        return { contents, loader: filename.endsWith('.json') ? 'json' : filename.endsWith('.ts') ? 'ts' : 'js' };
      });
    }
  }]
};
export async function assemble(): Promise<string> {
  return assembleModule('src/index.ts');
}
export async function assembleModule(entry: string, globalName?: string): Promise<string> {
  const result = await bundle({ ...bundleOptions, entryPoints: [entry], globalName });
  const source = result.outputFiles![0].text;
  new vm.Script(source, { filename: 'refolio.js' });
  return source;
}
export async function compileScript(relativePath: string): Promise<string> {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  const result = await transform(source, { loader: 'ts', target: 'firefox140', sourcefile: relativePath });
  new vm.Script(result.code, { filename: relativePath });
  return result.code;
}
export async function addonFiles(): Promise<ArchiveEntry[]> {
  const entries = (await filesIn(path.join(root, 'addon'))).filter(([name]) => name !== 'bootstrap.js');
  entries.push(['bootstrap.js', await compileScript('src/bootstrap.ts')]);
  return entries;
}
export async function filesIn(directory: string, prefix = ''): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) entries.push(...await filesIn(path.join(directory, entry.name), rel + '/'));
    else entries.push([rel, await fs.readFile(path.join(directory, entry.name))]);
  }
  return entries;
}
export async function build() {
  const source = await assemble();
  const entries = await addonFiles();
  entries.push(['chrome/content/scripts/refolio.js', Buffer.from(source)]);
  entries.push(['LICENSE', await fs.readFile(path.join(root, 'LICENSE'))]);
  entries.sort((a, b) => a[0].localeCompare(b[0], 'en'));
  for (const [name, bytes] of entries) {
    if (name.includes('/pro/') || name.endsWith('.enc')) throw new Error(`Pro asset remains: ${name}`);
    if (name.endsWith('.js') && !name.includes('/dist/')) new vm.Script(bytes.toString(), { filename: name });
  }
  const manifest = JSON.parse(entries.find(([name]) => name === 'manifest.json')![1].toString()) as Manifest;
  validateManifest(manifest);
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  if (pkg.version !== manifest.version) throw new Error('package.json and manifest.json versions differ.');
  const archive = zip(entries);
  const out = path.join(root, 'dist');
  await fs.mkdir(out, { recursive: true });
  const sources = await sourceFiles();
  const assets: ArchiveEntry[] = [
    [`refolio-${manifest.version}.xpi`, archive],
    [`refolio-source-${manifest.version}.zip`, zip(sources.map(([name, bytes]) => ['zotero-refolio/' + name, bytes]))],
    ['updates.json', JSON.stringify(createUpdateManifest(manifest, archive), null, 2) + '\n']
  ];
  for (const [name, bytes] of assets) await fs.writeFile(path.join(out, name), bytes);
  await fs.writeFile(path.join(out, 'SHA256SUMS.txt'), assets.map(([name, bytes]) =>
    createHash('sha256').update(bytes).digest('hex') + '  ' + name).join('\n') + '\n');
  await fs.writeFile(path.join(out, 'refolio.js'), source);
  const report = { version: manifest.version, files: entries.length, bytes: archive.length, sha256: createHash('sha256').update(archive).digest('hex') };
  await fs.writeFile(path.join(out, 'build.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
