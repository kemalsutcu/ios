import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  BELMA_PAGE_URL, APP_PAGE_CSS, MAX_DOWNLOAD_BYTES, base64ByteLength, buildAppBootstrapScript,
  buildAppTransitionScript, decodeBase64, downloadMime, externalDestination, isBelmaPageUrl, parseBridgeMessage,
} from '../src/lib/belmaBridge';

type Track = { readyState: string; stop: () => void; addEventListener: () => void };
type Stream = { getTracks: () => Track[] };
type Event = { target?: unknown; isTrusted?: boolean; composedPath?: () => unknown[]; preventDefault?: () => void; stopImmediatePropagation?: () => void };

class Element {
  attributes = new Map<string, string>(); children: Element[] = []; parentElement: Element | null = null;
  constructor(readonly tagName: string, parent?: Element) { if (parent) this.attach(parent); }
  attach(parent: Element) {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = parent; parent.children.push(this);
  }
  hasAttribute(name: string) { return this.attributes.has(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

function fixture(capture: () => Promise<Stream> = async () => ({ getTracks: () => [] })) {
  const messages: string[] = [], listeners = new Map<string, ((event: Event) => void)[]>();
  const styles = new Map<string, { id: string; textContent: string; isConnected: boolean }>();
  const shadowStyles = new Map<string, { id: string; textContent: string; isConnected: boolean }>();
  const body = new Element('BODY'), site = new Element('DIV', body), page = new Element('MAIN', site);
  const wrapper = new Element('DIV', page), node = new Element('VIRTARI-BELMA-BELGE', wrapper);
  let observe: (() => void) | undefined, controls = false, stopCount = 0, serial = 0;
  const media = { pauses: 0, pause() { ++this.pauses; } };
  const element = Object.assign(node, {
    configured: false, phase: 'idle', sessionMode: '',
    endSession() { ++stopCount; return Promise.resolve(); },
    shadowRoot: {
      querySelector: (_selector: string): object | null => controls ? {} : null,
      querySelectorAll: () => [media],
      getElementById: (id: string) => shadowStyles.get(id),
      appendChild(style: { id: string; textContent: string; isConnected: boolean }) { style.isConnected = true; shadowStyles.set(style.id, style); },
    },
  });
  const document = {
    documentElement: { setAttribute() {} }, body,
    head: { appendChild(style: { id: string; textContent: string; isConnected: boolean }) { style.isConnected = true; styles.set(style.id, style); } },
    querySelector: (selector: string) => selector === 'virtari-belma-belge' ? element : null,
    querySelectorAll: () => [media], getElementById: (id: string) => styles.get(id),
    createElement: () => ({ id: '', textContent: '', isConnected: false }),
    addEventListener(name: string, callback: (event: Event) => void) { listeners.set(name, [...(listeners.get(name) ?? []), callback]); },
  };
  class AudioContext {
    state = 'running'; suspends = 0; resumes = 0;
    addEventListener() {}
    async suspend() { ++this.suspends; this.state = 'suspended'; }
    async resume() { ++this.resumes; this.state = 'running'; }
  }
  class Anchor {
    tagName = 'A'; href = ''; download = ''; normalClicks = 0;
    hasAttribute(name: string) { return name === 'download' && !!this.download; }
    getAttribute() { return this.download; }
    click() { ++this.normalClicks; }
  }
  const window = {
    top: undefined as unknown, AudioContext,
    ReactNativeWebView: { postMessage(value: string) { messages.push(value); } }, addEventListener() {},
  };
  window.top = window;
  class BrowserURL extends URL {
    static createObjectURL(_blob: Blob) { return `blob:${BELMA_PAGE_URL}/${++serial}`; }
    static revokeObjectURL(_url: string) {}
  }
  const devices = { getUserMedia: capture };
  const context = vm.createContext({ window, document, location: new URL(BELMA_PAGE_URL), navigator: { mediaDevices: devices },
    URL: BrowserURL, HTMLAnchorElement: Anchor, Set, Map, DOMException, Date, Uint8Array, Reflect,
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    MutationObserver: class { constructor(callback: () => void) { observe = callback; } observe() {} disconnect() {} },
    setInterval: () => 1, clearInterval() {},
  });
  vm.runInContext(buildAppBootstrapScript(), context);
  return { messages, devices, context, styles, shadowStyles, media, listeners, element, body, site, page, wrapper,
    configure() { element.configured = true; }, controls() { controls = true; }, observe() { observe?.(); },
    refresh() { vm.runInContext('window.__BELMA_IOS_BRIDGE_V1.refresh()', context); },
    run(reason: 'active' | 'inactive' | 'background' | 'unmount') { vm.runInContext(buildAppTransitionScript(reason), context); },
    stops() { return stopCount; }, audio() { return new window.AudioContext(); },
    anchor(blob: Blob, filename: string) { const a = new Anchor(); a.href = BrowserURL.createObjectURL(blob); a.download = filename; return a; },
    revoke(url: string) { BrowserURL.revokeObjectURL(url); },
  };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('bundled branding survives repeated hydration without duplicating or replacing working controls', () => {
  const app = fixture();
  class BrandNode {
    className = ''; src = ''; alt = ''; decoding = ''; children: BrandNode[] = []; parent: BrandNode | null = null;
    readonly classList = { add: (value: string) => { this.className += ' ' + value; } };
    querySelector(selector: string): BrandNode | null {
      const name = selector.slice(1);
      return this.children.find(child => child.className.split(' ').includes(name)) ?? null;
    }
    append(child: BrandNode) { child.parent = this; this.children.push(child); }
    prepend(child: BrandNode) { child.parent = this; this.children.unshift(child); }
    replaceWith(child: BrandNode) { if (this.parent) { child.parent = this.parent; this.parent.children[this.parent.children.indexOf(this)] = child; } }
  }
  const brand = new BrandNode(), empty = new BrandNode(), menu = new BrandNode(), voice = new BrandNode();
  const emblem = new BrandNode(); emblem.className = 'bc-emblem'; empty.append(emblem);
  const existingVoiceChild = new BrandNode(); voice.append(existingVoiceChild);
  const nodes: Record<string, BrandNode> = { '#card .bc-brand': brand, '#card .empty-state': empty, '#card .bc-menu-body': menu };
  app.element.shadowRoot.querySelector = selector => nodes[selector] ?? {};
  Object.assign(app.context.document, { createElement: () => new BrandNode() });
  Object.assign(app.element, { chat: { voice } });
  app.refresh(); app.refresh();
  assert.equal(brand.children.length, 1);
  assert.equal(empty.children.length, 2);
  assert.equal(menu.children.length, 1);
  assert.equal(voice.children.length, 2);
  assert.equal(voice.children[1], existingVoiceChild, 'the original button children and handlers remain in place');
  assert.ok(brand.children[0].src.startsWith('data:image/jpeg;base64,'));
  assert.equal(brand.children[0].alt, 'Belma');
  assert.equal(menu.children[0].children[0].alt, 'Yapay Mevzular');
  assert.ok(voice.children[0].src.startsWith('data:image/png;base64,'));
  // A new conversation recreates the empty state inside Shadow DOM after the ready poll has stopped.
  nodes['#card .empty-state'] = new BrandNode(); app.observe();
  assert.equal(nodes['#card .empty-state'].children.length, 2);
});

test('only exact HTTPS Belma paths may stay in the application', () => {
  assert.equal(isBelmaPageUrl(BELMA_PAGE_URL), true);
  assert.equal(isBelmaPageUrl('https://yapaymevzular.com/belmabelge/?locale=tr#chat'), true);
  for (const value of ['http://www.yapaymevzular.com/belmabelge', 'https://www.yapaymevzular.com/', 'https://www.yapaymevzular.com/belmabelge/evil',
    'https://yapaymevzular.com.evil.test/belmabelge', 'https://user@yapaymevzular.com/belmabelge', 'https://yapaymevzular.com:8443/belmabelge',
    'file:///belmabelge', 'about:blank']) assert.equal(isBelmaPageUrl(value), false, value);
});
test('external links reject unsafe schemes, credentials, ports and active content', () => {
  assert.ok(externalDestination('https://www.yargitay.gov.tr/'));
  for (const value of ['javascript:alert(1)', 'data:text/html,a', 'file:///tmp/test', 'https://a:b@example.test/', 'https://example.test:8443/', 'tel:123%0A456', BELMA_PAGE_URL]) assert.equal(externalDestination(value), null);
});
test('base64 preserves arbitrary bytes, Turkish UTF-8 BOM and ZIP/PDF bytes', () => {
  for (const bytes of [Buffer.from('\ufeffİstanbul, Şişli 🐈'), Buffer.from('%PDF-1.7\n\0\xff', 'binary'),
    Buffer.from([80,75,3,4,0,255,128]), ...Array.from({ length: 65 }, (_, n) => Buffer.from(Array.from({ length: n + 1 }, (_, i) => i * 7 % 256)))]) {
    const encoded = bytes.toString('base64');
    assert.equal(base64ByteLength(encoded), bytes.length);
    assert.deepEqual(Buffer.from(decodeBase64(encoded)), bytes);
  }
  for (const bad of ['', 'A', 'AAAA=', 'AA=A', 'Zh==', 'Zm9=', '=AAA', 'AAAA\n', '%%%%', 'A===']) assert.equal(base64ByteLength(bad), null, bad);
});
test('bridge requires exact source and shape and matching bytes, size, filename and MIME', () => {
  const base = { type: 'BELMA_APP_DOWNLOAD', version: 1, id: 'export_1', filename: 'Dilekçe.pdf', mime: 'application/pdf', base64: 'JVBERg==', size: 4 };
  assert.deepEqual(parseBridgeMessage(JSON.stringify(base), BELMA_PAGE_URL), base);
  for (const patch of [{ filename: '../secret.pdf' }, { filename: 'secret.html' }, { size: 5 }, { size: MAX_DOWNLOAD_BYTES + 1 },
    { id: '../escape' }, { mime: 'text/html' }, { base64: 'JVBERh==' }, { extra: true }]) assert.equal(parseBridgeMessage(JSON.stringify({ ...base, ...patch }), BELMA_PAGE_URL), null);
  assert.equal(parseBridgeMessage(JSON.stringify(base), 'https://example.test/'), null);
  assert.equal(parseBridgeMessage('{"type":"BELMA_APP_READY","version":1,"extra":true}', BELMA_PAGE_URL), null);
});
test('all five supported extensions map to canonical MIME and reject traversal', () => {
  for (const name of ['Belma.txt', 'Dilekçe.docx', 'Dilekçe.udf', 'Dilekçe.pdf', 'Sohbet.json']) assert.ok(downloadMime(name));
  for (const name of ['../a.pdf', 'a..pdf', 'a.html', 'a.exe', '/a.pdf', 'a\\b.pdf']) assert.equal(downloadMime(name), null);
});
test('ready waits for configuration, controls and connected isolation before revealing', () => {
  const app = fixture(); assert.equal(app.messages.length, 0);
  app.controls(); app.refresh(); assert.equal(app.messages.length, 0);
  app.element.parentElement = null; app.configure(); app.refresh(); assert.equal(app.messages.length, 0);
  app.element.attach(app.wrapper); app.refresh(); app.refresh();
  assert.deepEqual(app.messages.map(x => JSON.parse(x)), [{ type: 'BELMA_APP_READY', version: 1 }]);
  assert.equal(app.styles.size, 1); assert.equal(app.shadowStyles.size, 1);
  const capture = app.devices.getUserMedia; vm.runInContext(buildAppBootstrapScript(), app.context);
  assert.equal(app.devices.getUserMedia, capture);
});
test('website desktop, mobile, floating and language chrome is excluded while Belma stays attached', () => {
  const app = fixture(), header = new Element('HEADER', app.page), mobile = new Element('NAV', app.site), footer = new Element('FOOTER', app.body);
  app.configure(); app.controls(); app.refresh();
  for (const ancestor of [app.element, app.wrapper, app.page, app.site, app.body]) assert.equal(ancestor.hasAttribute('data-belma-app-path'), true);
  for (const chrome of [header, mobile, footer]) assert.equal(chrome.hasAttribute('data-belma-app-path'), false);
  assert.equal(app.element.parentElement, app.wrapper);
  assert.match(APP_PAGE_CSS, /:not\(virtari-belma-belge\) > :not\(\[data-belma-app-path\]\)/);
  assert.doesNotMatch(APP_PAGE_CSS, /\.bc-header.*display:none/);
});
test('late Wix hydration refreshes ancestor isolation without reconnecting the assistant', () => {
  const app = fixture(); app.configure(); app.controls(); app.refresh();
  const next = new Element('MAIN', app.site); app.element.attach(next); app.observe();
  assert.equal(next.hasAttribute('data-belma-app-path'), true);
  assert.equal(app.page.hasAttribute('data-belma-app-path'), false);
  assert.equal(app.wrapper.hasAttribute('data-belma-app-path'), false);
  assert.equal(app.messages.length, 1);
});
test('detached programmatic download preserves PDF/DOCX/UDF/TXT/JSON bytes after immediate revoke', async () => {
  for (const [filename, bytes] of [
    ['Dilekçe.pdf', Buffer.from('%PDF-1.7\n\xff', 'binary')], ['Dilekçe.docx', Buffer.from([80,75,3,4,255,1])],
    ['Dilekçe.udf', Buffer.from([80,75,3,4,0,128])], ['Konuşma.txt', Buffer.from('\ufeffŞişli 🐈')], ['Belma.json', Buffer.from('{"şehir":"İstanbul"}')],
  ] as const) {
    const app = fixture(), anchor = app.anchor(new Blob([bytes]), filename);
    anchor.click(); app.revoke(anchor.href); await flush(); await flush();
    assert.equal(anchor.normalClicks, 0);
    const message = parseBridgeMessage(app.messages[0], BELMA_PAGE_URL);
    assert.equal(message?.type, 'BELMA_APP_DOWNLOAD');
    if (message?.type === 'BELMA_APP_DOWNLOAD') assert.deepEqual(Buffer.from(decodeBase64(message.base64)), bytes);
  }
});
test('delayed export needs no expiring user activation and legal-title punctuation becomes a safe filename', async () => {
  const app = fixture(), anchor = app.anchor(new Blob(['PK-test']), '[Taslak] İtiraz, Ek & Beyan.docx');
  anchor.click(); await flush();
  const message = parseBridgeMessage(app.messages[0], BELMA_PAGE_URL);
  assert.equal(message?.type, 'BELMA_APP_DOWNLOAD');
  if (message?.type === 'BELMA_APP_DOWNLOAD') assert.equal(message.filename, 'Belma__Taslak_ İtiraz_ Ek _ Beyan.docx');
});
test('large document conversion joins complete base64 groups without byte corruption', async () => {
  const app = fixture(), bytes = Buffer.from(Array.from({ length: 70007 }, (_, i) => i % 256));
  app.anchor(new Blob([bytes]), 'Belma.udf').click(); await flush(); await flush();
  const message = parseBridgeMessage(app.messages[0], BELMA_PAGE_URL);
  assert.equal(message?.type, 'BELMA_APP_DOWNLOAD');
  if (message?.type === 'BELMA_APP_DOWNLOAD') assert.deepEqual(Buffer.from(decodeBase64(message.base64)), bytes);
});
test('unknown blobs and unsupported formats never trigger ordinary navigation', async () => {
  const app = fixture(), anchor = app.anchor(new Blob(['data']), 'document.html');
  anchor.click(); await flush();
  assert.equal(anchor.normalClicks, 0); assert.equal(JSON.parse(app.messages[0]).type, 'BELMA_APP_ERROR');
});
test('background closes the session and media without deleting chats or documents', async () => {
  let stopped = 0;
  const track: Track = { readyState: 'live', stop() { ++stopped; this.readyState = 'ended'; }, addEventListener() {} };
  const app = fixture(async () => ({ getTracks: () => [track] })), audio = app.audio();
  await app.devices.getUserMedia(); app.run('background');
  assert.equal(stopped, 1); assert.equal(app.stops(), 1); assert.ok(app.media.pauses); assert.equal(audio.state, 'suspended');
  await assert.rejects(app.devices.getUserMedia(), { name: 'AbortError' });
  await assert.rejects(audio.resume(), { name: 'AbortError' });
  app.run('active'); assert.equal(stopped, 1); assert.equal(audio.state, 'suspended');
  assert.doesNotMatch(buildAppBootstrapScript(), /clearLocalData|clearSessionData|\.newChat\(/);
});
test('pending capture after background then active is stopped before reaching assistant', async () => {
  let resolve!: (value: Stream) => void, stopped = 0;
  const pending = new Promise<Stream>(done => { resolve = done; });
  const app = fixture(() => pending), request = app.devices.getUserMedia();
  app.run('background'); app.run('active');
  resolve({ getTracks: () => [{ readyState: 'live', stop() { ++stopped; }, addEventListener() {} }] });
  await assert.rejects(request, { name: 'AbortError' }); assert.equal(stopped, 1);
});
test('first microphone permission inactive event does not cancel its pending capture', async () => {
  let resolve!: (value: Stream) => void;
  const pending = new Promise<Stream>(done => { resolve = done; });
  const app = fixture(() => pending), request = app.devices.getUserMedia();
  app.run('inactive'); app.run('active'); resolve({ getTracks: () => [] });
  await request; assert.equal(app.stops(), 0);
});
test('inactive already-connected voice stops session even if microphone is muted', () => {
  const app = fixture(); app.element.phase = 'connected'; app.element.sessionMode = 'voice'; app.run('inactive');
  assert.equal(app.stops(), 1);
});
test('unmount stops a pending capture and cannot restart it', async () => {
  const app = fixture(); app.run('unmount');
  assert.equal(app.stops(), 1); await assert.rejects(app.devices.getUserMedia(), { name: 'AbortError' });
});
test('vendor snapshot matches manifest and required public source contracts', () => {
  const directory = new URL('../vendor/', import.meta.url), manifest = JSON.parse(readFileSync(new URL('source-manifest.json', directory), 'utf8'));
  for (const [filename, hash] of Object.entries(manifest.files)) assert.equal(createHash('sha256').update(readFileSync(new URL(filename, directory))).digest('hex'), hash);
  const source = readFileSync(new URL('virtari-belma-belge.js', directory), 'utf8');
  assert.match(source, /async endSession\(showNotice=false\)/); assert.match(source, /this\.configured = true/);
  assert.match(source, /#card\.belma-chat/); assert.match(source, /bc-header/); assert.match(source, /createObjectURL\(blob\)/);
});
