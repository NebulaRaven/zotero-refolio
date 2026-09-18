import fs from 'node:fs/promises';
import ts from 'typescript';

/** Compile one real module against the small host fixture supplied by a unit test. */
export async function script(filename: string | URL, declaration?: string): Promise<string> {
  const source = await fs.readFile(filename, 'utf8');
  const tree = ts.createSourceFile(String(filename), source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const names: string[] = [];
  const statements = tree.statements.filter(node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return false;
    if (!declaration) return true;
    return (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === declaration;
  });
  const printer = ts.createPrinter();
  const body = statements.map(node => {
    const name = (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) ? node.name : undefined;
    if (name) names.push(name.text);
    if (ts.isVariableStatement(node)) for (const entry of node.declarationList.declarations) {
      if (ts.isIdentifier(entry.name)) names.push(entry.name.text);
    }
    const plain = ts.canHaveModifiers(node) ? ts.factory.replaceModifiers(node,
      ts.getModifiers(node)?.filter(modifier => modifier.kind !== ts.SyntaxKind.ExportKeyword && modifier.kind !== ts.SyntaxKind.DefaultKeyword)) : node;
    return printer.printNode(ts.EmitHint.Unspecified, plain, tree);
  }).join('\n');
  if (declaration && !statements.length) throw new Error(`Declaration not found: ${declaration}`);
  return ts.transpileModule(body, {
    fileName: String(filename), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, useDefineForClassFields: false }
  }).outputText + '\n' + names.map(name => `globalThis.${name} = ${name};`).join('\n');
}
