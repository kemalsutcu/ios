import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { FORMAT_INSTRUCTION, belmaRichText, buildRichTextAdapterScript, replaceFormatInstruction, type RichNode } from '../src/lib/belmaRichText';
import { BELMA_RICH_TEXT_FACTORY_SOURCE } from '../src/lib/belmaRichTextFactory.generated';

function flattened(nodes: RichNode[]): string { return nodes.map(node => node.text ?? flattened(node.children || [])).join(''); }
function tags(nodes: RichNode[]): string[] { return nodes.flatMap(node => [node.tag, ...tags(node.children || [])]); }

class DomNode {
  children: DomNode[] = []; ownText = ''; attributes = new Map<string, string>(); dataset: Record<string, string> = {};
  parent: DomNode | null = null; writes = 0; id = ''; className = '';
  constructor(readonly tag: string, readonly ownerDocument: DomDocument) {}
  get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set textContent(value: string) { this.children = []; this.ownText = value; this.writes++; }
  set innerHTML(_value: string) { throw new Error('Untrusted HTML must never be evaluated'); }
  appendChild(child: DomNode) {
    if (child.tag === '#fragment') { for (const node of child.children) this.appendChild(node); return child; }
    child.parent = this; this.children.push(child); return child;
  }
  replaceChildren(child: DomNode) { this.children = []; this.ownText = ''; this.writes++; this.appendChild(child); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  get lastChild() { return this.children.at(-1); }
  querySelector(selector: string): DomNode | null {
    const matches = (node: DomNode) => selector[0] === '.' ? node.className === selector.slice(1) : node.tag === selector;
    for (const child of this.children) { if (matches(child)) return child; const deeper = child.querySelector(selector); if (deeper) return deeper; }
    return null;
  }
  getElementById(id: string): DomNode | null {
    for (const child of this.children) { if (child.id === id) return child; const deeper = child.getElementById(id); if (deeper) return deeper; }
    return null;
  }
}
class DomDocument {
  createElement(tag: string) { return new DomNode(tag, this); }
  createTextNode(text: string) { const node = new DomNode('#text', this); node.textContent = text; return node; }
  createDocumentFragment() { return new DomNode('#fragment', this); }
}
const domTags = (node: DomNode): string[] => [node.tag, ...node.children.flatMap(domTags)];

test('static injected factory matches canonical source without Hermes function serialization', () => {
  const source = ts.createSourceFile('belmaRichText.ts', readFileSync(new URL('../src/lib/belmaRichText.ts', import.meta.url), 'utf8'), ts.ScriptTarget.ES2022, true);
  const factory = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'createBelmaRichText')!;
  const compiled = ts.transpileModule(factory.getText(source).replace(/^export\s+/u, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, removeComments: false },
  }).outputText.trim();
  assert.equal(BELMA_RICH_TEXT_FACTORY_SOURCE, compiled);
  assert.doesNotMatch(buildRichTextAdapterScript(), /\[native code\]|__name\(/u);
});

test('semantic markup supports nested bold, underline and italic without moving qualifiers', () => {
  const nodes = belmaRichText.inline('**<u>*Tebliğ yapılmışsa*, 15 gün içinde itiraz etmelisiniz</u>**; kesin bir süre hesabı değildir.');
  assert.deepEqual(tags(nodes).slice(0, 5), ['strong', 'u', 'em', 'text', 'text']);
  assert.equal(flattened(nodes), 'Tebliğ yapılmışsa, 15 gün içinde itiraz etmelisiniz; kesin bir süre hesabı değildir.');
  for (const value of ['***birlikte***', '*a **b***', '**a *b***', '__kalın _koşul___']) {
    assert.ok(tags(belmaRichText.inline(value)).includes('strong'), value);
    assert.ok(tags(belmaRichText.inline(value)).includes('em'), value);
  }
});
test('plain answers gain no fabricated keyword or sentence importance', () => {
  const source = 'Sonuç: 15 gün. Ancak tebliğ tarihi bilinmiyor; kesin sonuç yoktur.';
  const nodes = belmaRichText.blocks(source);
  assert.deepEqual(tags(nodes), ['p', 'text']); assert.equal(flattened(nodes), source);
});
test('streaming incomplete markers, underscores inside words and literal escapes stay visible', () => {
  for (const source of ['**henüz bitmemiş', '<u>kritik süre', '*koşul', 'dosya_adi_2026 ve case__id', '``kod henüz kapanmadı', '[link](https://example.test']) {
    assert.equal(flattened(belmaRichText.inline(source)), source, source);
  }
  assert.equal(flattened(belmaRichText.inline('\\*literal\\* ve **tamam**')), '*literal* ve tamam');
  assert.deepEqual(tags(belmaRichText.inline('A **kritik *koşul')), ['text', 'text']);
});
test('block structure preserves paragraphs, ordered starts, nested lists, quotes and fenced code', () => {
  const source = '# Sonuç\n\nBir **bulgu**.\n\n3. Birinci\n   - <u>Alt madde</u>\n4. İkinci\n\n> Kaynak **alıntısı**\n> devamı\n\n```json\n{"text":"**literal** <u>literal</u>"}\n```';
  const nodes = belmaRichText.blocks(source);
  assert.deepEqual(nodes.map(node => node.tag), ['h1', 'p', 'ol', 'blockquote', 'pre']);
  assert.equal(nodes[2].start, 3); assert.ok(tags(nodes[2].children || []).includes('ul'));
  assert.equal(nodes[4].children?.[0].text, '{"text":"**literal** <u>literal</u>"}');
  assert.equal(belmaRichText.blocks('```\n**streaming**')[0].children?.[0].text, '```\n**streaming**');
});
test('only safe HTTPS/HTTP links receive DOM attributes; arbitrary HTML stays literal', () => {
  const doc = new DomDocument(), target = doc.createElement('div');
  const source = '<img src=x onerror=alert(1)> <script>alert(1)</script> <u onclick="x">unsafe</u> [safe **link**](https://example.test/path_(1)) [bad](javascript:alert(1)) [private](https://user:password@example.test/)';
  belmaRichText.render(target as unknown as Element, source);
  assert.ok(!domTags(target).includes('img')); assert.ok(!domTags(target).includes('script')); assert.ok(!domTags(target).includes('u'));
  const link = target.querySelector('a')!;
  assert.equal(link.attributes.get('href'), 'https://example.test/path_(1)');
  assert.equal(link.attributes.get('rel'), 'noopener noreferrer'); assert.equal(link.attributes.get('referrerpolicy'), 'no-referrer');
  assert.ok(target.textContent.includes('<script>alert(1)</script>')); assert.ok(target.textContent.includes('[bad](javascript:alert(1))'));
  assert.ok(target.textContent.includes('[private](https://user:password@example.test/)'));
  assert.equal(belmaRichText.safeLink('data:text/html,anything'), null);
  assert.equal(belmaRichText.safeLink('https://example.test/\nanything'), null);
});
test('large malformed streaming input has bounded depth and preserves all content', () => {
  const source = '*a '.repeat(45000);
  const nodes = belmaRichText.inline(source);
  assert.equal(flattened(nodes), source);
  assert.equal(flattened(belmaRichText.inline('['.repeat(140000))), '['.repeat(140000));
  const balanced = '['.repeat(15000) + 'literal' + ']'.repeat(15000);
  assert.equal(flattened(belmaRichText.inline(balanced)), balanced);
});
test('format instruction replacement is scoped to the first prefix line and keeps context byte-for-byte', () => {
  const extra = '\nYerel belge bilgisi\r\nKonuşma geçmişi:  **ham**\n';
  assert.equal(replaceFormatInstruction('BELMA_YANIT_BICIMI: eski' + extra), FORMAT_INSTRUCTION + extra);
  assert.equal(replaceFormatInstruction('Kullanıcı: BELMA_YANIT_BICIMI: metin'), 'Kullanıcı: BELMA_YANIT_BICIMI: metin');
  assert.equal(replaceFormatInstruction('BELMA_BELGE_CIKTISI: document_json'), 'BELMA_BELGE_CIKTISI: document_json');
  assert.equal(replaceFormatInstruction(null), null);
  for (const text of ['anlam', '**kalın**', '<u>altı çizili</u>', '*italik*', 'Olumsuzluğu', 'document_json', 'Sesli']) assert.ok(FORMAT_INSTRUCTION.includes(text), text);
});

function runtimeFixture() {
  const doc = new DomDocument(), root = doc.createElement('root'), messages = [
    { id: 'a1', role: 'assistant', text: '**<u>15 gün içinde başvur</u>**; *tebliğ yapılmışsa*.', rawText: '**<u>15 gün içinde başvur</u>**; *tebliğ yapılmışsa*.', draft: true },
    { id: 'u1', role: 'user', text: '**benim mesajım**', rawText: '**benim mesajım**', draft: false },
  ];
  const sent: unknown[][] = [], messageNodes = new Map<string, DomNode>();
  function createTransport() { return { sendContextualUpdate(...args: unknown[]) { sent.push(args); return 17; } }; }
  function createFormat() {
    const archive = new Map(messages.map(message => [message.id, { ...message }])), historyNodes = new Map<string, DomNode>();
    return { archive, historyNodes, renderHistory() {
      for (const message of archive.values()) {
        let row = historyNodes.get(message.id);
        if (!row) { row = doc.createElement('div'); const text = doc.createElement('div'); text.className = 'vf-history-text'; row.appendChild(text); historyNodes.set(message.id, row); root.appendChild(row); }
        if (row.lastChild!.textContent !== message.text) row.lastChild!.textContent = message.text;
      }
    } };
  }
  const element = {
    shadowRoot: root, messages, messageNodes, transport: createTransport(), conversation: null as ReturnType<typeof createTransport> | null,
    format: createFormat(), renders: 0,
    renderMessages() {
      this.renders++;
      for (const message of this.messages) {
        let row = messageNodes.get(message.id);
        if (!row) { row = doc.createElement('div'); const text = doc.createElement('span'); text.className = 'message-text'; row.appendChild(text); messageNodes.set(message.id, row); root.appendChild(row); }
        const target = row.querySelector('.message-text')!;
        // Emulates the live renderer's cache and old heuristic highlight.
        if (target.dataset.markdown !== message.text) {
          const guessed = doc.createElement('strong'); guessed.textContent = message.text;
          target.replaceChildren(guessed); target.dataset.markdown = message.text;
        }
      }
    },
    render() { this.transport = createTransport(); this.format = createFormat(); this.renderMessages(); },
    ensureSession() { this.conversation = this.transport; return this.transport.sendContextualUpdate('BELMA_YANIT_BICIMI: eski\nHISTORY:\n**ham**'); },
    send() { return this.transport.sendContextualUpdate('BELMA_YANIT_BICIMI: eski'); },
  };
  const context = vm.createContext({ document: doc, URL, element, root });
  vm.runInContext(buildRichTextAdapterScript() + '\nbelmaInstallRich(element, root);', context);
  return { doc, root, element, sent, refresh() { vm.runInContext('belmaInstallRich(element, element.shadowRoot)', context); } };
}
test('runtime replaces the heuristic renderer, keeps user/raw/document data intact and does not loop', () => {
  const app = runtimeFixture(), before = structuredClone(app.element.messages);
  app.element.renderMessages(); const answer = app.element.messageNodes.get('a1')!.querySelector('.message-text')!;
  const user = app.element.messageNodes.get('u1')!.querySelector('.message-text')!;
  assert.deepEqual(domTags(answer).slice(0, 5), ['span', 'p', 'strong', 'u', '#text']);
  assert.equal(user.textContent, '**benim mesajım**');
  assert.deepEqual(app.element.messages, before);
  const writes = answer.writes, render = app.element.renderMessages, wire = app.element.transport.sendContextualUpdate;
  app.refresh(); app.refresh(); app.element.renderMessages();
  assert.equal(answer.writes, writes); assert.equal(app.element.renderMessages, render); assert.equal(app.element.transport.sendContextualUpdate, wire);
  assert.equal(app.root.children.filter(child => child.id === 'belma-ios-rich-style').length, 1);
  app.element.messages[0].text = '**Yeni sonuç**'; app.element.messages[0].draft = false; app.element.renderMessages();
  assert.equal(answer.textContent, 'Yeni sonuç'); assert.equal(app.element.messages[0].rawText, before[0].rawText);
});
test('runtime formats before connection/send and decorates replacement transports/format roots once', () => {
  const app = runtimeFixture();
  assert.equal(app.element.ensureSession(), 17);
  assert.equal(app.sent[0][0], FORMAT_INSTRUCTION + '\nHISTORY:\n**ham**');
  app.element.transport.sendContextualUpdate('BELMA_BELGE_CIKTISI: Gövde **ham**', 'extra');
  assert.deepEqual(app.sent[1], ['BELMA_BELGE_CIKTISI: Gövde **ham**', 'extra']);
  const transport = app.element.transport; app.element.render(); assert.notEqual(app.element.transport, transport);
  assert.equal(app.element.send(), 17); assert.equal(app.sent.at(-1)![0], FORMAT_INSTRUCTION);
  app.element.format.renderHistory(); const history = app.element.format.historyNodes.get('a1')!.querySelector('.vf-history-text')!;
  assert.ok(domTags(history).includes('u')); assert.ok(domTags(history).includes('em'));
  const saved = structuredClone([...app.element.format.archive]); app.refresh(); assert.deepEqual([...app.element.format.archive], saved);
  app.element.shadowRoot = app.doc.createElement('replacement'); app.refresh(); app.refresh();
  assert.equal(app.element.shadowRoot.children.filter(child => child.id === 'belma-ios-rich-style').length, 1);
});
