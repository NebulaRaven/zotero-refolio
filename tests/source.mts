import fs from 'node:fs/promises';
import { transform } from 'esbuild';
import { parse } from 'acorn';

/** Compile one real module against the small host fixture supplied by a unit test. */
export async function script(filename: string | URL, declaration?: string): Promise<string> {
  const source = await fs.readFile(filename, 'utf8');
  // esbuild removes the types; acorn then finds the top-level statements to keep.
  const { code } = await transform(source, {
    loader: 'ts', format: 'esm', target: 'es2022', sourcefile: String(filename),
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } }
  });
  const names: string[] = [];
  const kept: string[] = [];
  for (const statement of parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
    if (statement.type === 'ImportDeclaration' || statement.type === 'ExportAllDeclaration') continue;
    const node = statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration' ? statement.declaration : statement;
    if (!node) continue;
    const name = node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration' ? node.id?.name : undefined;
    if (declaration && name !== declaration) continue;
    if (name) names.push(name);
    if (node.type === 'VariableDeclaration') {
      for (const entry of node.declarations) if (entry.id.type === 'Identifier') names.push(entry.id.name);
    }
    kept.push(code.slice(node.start, node.end));
  }
  if (declaration && !kept.length) throw new Error(`Declaration not found: ${declaration}`);
  return kept.join('\n') + '\n' + names.map(name => `globalThis.${name} = ${name};`).join('\n');
}
