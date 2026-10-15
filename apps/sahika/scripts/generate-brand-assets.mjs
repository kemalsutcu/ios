import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// These are the supplied, resized brand assets, embedded so the app needs no asset CDN.
const data = (path, mime) => `data:${mime};base64,${readFileSync(new URL(path, import.meta.url)).toString('base64')}`;
writeFileSync(new URL('../assets/app-branding.json', import.meta.url), JSON.stringify({
  avatar: data('../assets/partners/sahika-avatar.png', 'image/png'),
  pulsevet: data('../assets/partners/pulsevet.png', 'image/png'),
  yapayMevzular: data('../assets/partners/yapay-mevzular.png', 'image/png'),
  titleFont: data('../assets/fonts/mouzambik-inktrap-italic.ttf', 'font/ttf'),
}));

// Hermes cannot reliably stringify JavaScript functions. Ship the browser runtime as literal source.
const source = ts.createSourceFile('appLayout.ts', readFileSync(new URL('../src/lib/appLayout.ts', import.meta.url), 'utf8'), ts.ScriptTarget.ES2022, true);
const factory = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'appLayoutRuntime');
if (!factory) throw new Error('App layout runtime was not found');
const compiled = ts.transpileModule(factory.getText(source).replace(/^export\s+/u, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, alwaysStrict: false },
}).outputText.trim();
writeFileSync(new URL('../src/lib/appLayoutRuntime.generated.ts', import.meta.url),
  '// Generated from appLayoutRuntime; run node scripts/generate-brand-assets.mjs.\n'
  + 'export const APP_LAYOUT_RUNTIME_SOURCE = ' + JSON.stringify(compiled) + ';\n');
