import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// Hermes does not guarantee Function#toString source; ship literal JavaScript to WKWebView.
const sourcePath = new URL('../src/lib/belmaRichText.ts', import.meta.url);
const source = ts.createSourceFile('belmaRichText.ts', readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.ES2022, true);
const factory = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'createBelmaRichText');
if (!factory) throw new Error('Rich text factory was not found');
const compiled = ts.transpileModule(factory.getText(source).replace(/^export\s+/u, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, removeComments: false },
}).outputText.trim();
writeFileSync(new URL('../src/lib/belmaRichTextFactory.generated.ts', import.meta.url),
  '// Generated from createBelmaRichText in belmaRichText.ts; run node scripts/generate-rich-text.mjs.\n'
  + 'export const BELMA_RICH_TEXT_FACTORY_SOURCE = ' + JSON.stringify(compiled) + ';\n');
