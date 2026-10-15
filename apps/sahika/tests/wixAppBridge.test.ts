import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  buildAppBootstrapScript,
  buildAppTransitionScript,
  externalDestination,
  isSahikaPageUrl,
  parseBridgeMessage,
  SAHIKA_PAGE_URL,
  utf8ByteLength,
} from '../src/lib/wixAppBridge';

type Track = { readyState: string; stop: () => void; addEventListener: () => void };
type DomEvent = { target?: unknown; detail?: unknown; isTrusted?: boolean; composedPath?: () => unknown[]; preventDefault?: () => void; stopImmediatePropagation?: () => void };

function fixture(getUserMedia: () => Promise<{ getTracks: () => Track[] }> = async () => ({ getTracks: () => [] }), downloadBlob?: Blob) {
  const messages: string[] = [];
  const stoppedKeys: string[] = [];
  const listeners = new Map<string, ((event: DomEvent) => void)[]>();
  const styles = new Map<string, { id: string; textContent: string; isConnected: boolean }>();
  let configured = false;
  let readyAttribute = true;
  let controls = false;
  const media = { pauses: 0, pause() { ++this.pauses; } };
  const element = {
    tagName: 'PULSEVET-SAHIKA-NEW',
    hasAttribute: (name: string) => name === 'data-sahika-ready' ? readyAttribute && configured : name === 'data-sahika-loading' ? !configured : false,
    setAttribute: (name: string, value: string) => { if (name === 'force-stop-key') stoppedKeys.push(value); },
    shadowRoot: {
      querySelector: (selector: string) => selector === '.boot-shell' ? { hidden: configured } : controls ? {} : null,
      querySelectorAll: () => [media],
    },
  };
  const document = {
    documentElement: { setAttribute() {} },
    head: { appendChild(style: { id: string; textContent: string; isConnected: boolean }) { style.isConnected = true; styles.set(style.id, style); } },
    querySelector: (selector: string) => selector === 'pulsevet-sahika-new' ? element : null,
    querySelectorAll: () => [media],
    getElementById: (id: string) => styles.get(id),
    createElement: () => ({ id: '', textContent: '', isConnected: false }),
    addEventListener(name: string, callback: (event: DomEvent) => void) {
      listeners.set(name, [...(listeners.get(name) ?? []), callback]);
    },
  };
  const window = {
    top: undefined as unknown,
    ReactNativeWebView: { postMessage(value: string) { messages.push(value); } },
    addEventListener() {},
  };
  window.top = window;
  const devices = { getUserMedia };
  const context = vm.createContext({
    window, document, location: new URL(SAHIKA_PAGE_URL), navigator: { mediaDevices: devices },
    URL, Set, DOMException, Date, TextDecoder,
    fetch: async () => ({ blob: async () => downloadBlob }),
    MutationObserver: class { observe() {} disconnect() {} },
    setInterval: () => 1, clearInterval() {},
  });
  vm.runInContext(buildAppBootstrapScript(), context);
  const run = (reason: 'active' | 'inactive' | 'background' | 'unmount') => vm.runInContext(buildAppTransitionScript(reason), context);
  const refresh = () => vm.runInContext('window.__SAHIKA_IOS_BRIDGE_V1.refresh()', context);
  return { messages, stoppedKeys, devices, media, context, run, refresh, styles,
    configure() { configured = true; }, configureLegacy() { configured = true; readyAttribute = false; }, addControls() { controls = true; }, listeners };
}

test('only exact PulseVet HTTPS assistant paths remain in the app', () => {
  assert.equal(isSahikaPageUrl(SAHIKA_PAGE_URL), true);
  assert.equal(isSahikaPageUrl('https://pulseveteriner.com/sahika/?locale=tr#chat'), true);
  for (const url of ['http://www.pulseveteriner.com/sahika', 'https://www.pulseveteriner.com/',
    'https://pulseveteriner.com.evil.test/sahika', 'https://user@pulseveteriner.com/sahika',
    'https://www.pulseveteriner.com:8443/sahika', 'https://www.yapaymevzular.com/sahika',
    'file:///sahika', 'https://www.pulseveteriner.com/sahika/other']) assert.equal(isSahikaPageUrl(url), false, url);
});

test('handoff accepts clinic links and rejects active schemes or credentials', () => {
  assert.equal(externalDestination('tel:+905448380838'), 'tel:+905448380838');
  assert.equal(externalDestination('https://wa.me/905448380838?text=Merhaba'), 'https://wa.me/905448380838?text=Merhaba');
  assert.ok(externalDestination('https://www.google.com/maps/dir/?api=1'));
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'intent://test', 'file:///tmp/x',
    'https://user:secret@example.test/', 'tel:123%0A456', SAHIKA_PAGE_URL]) assert.equal(externalDestination(url), null, url);
});

test('native bridge messages are bounded and tied to the exact main page', () => {
  assert.deepEqual(parseBridgeMessage('{"type":"SAHIKA_APP_READY","version":1}', SAHIKA_PAGE_URL), { type: 'SAHIKA_APP_READY', version: 1 });
  assert.equal(parseBridgeMessage('{"type":"SAHIKA_APP_READY","version":1}', 'https://example.test/'), null);
  assert.equal(parseBridgeMessage('{"type":"SAHIKA_APP_READY","version":1,"unexpected":true}', SAHIKA_PAGE_URL), null);
  assert.equal(parseBridgeMessage('{"type":"SAHIKA_APP_EXTERNAL","version":1,"url":"javascript:alert(1)"}', SAHIKA_PAGE_URL), null);
  assert.equal(parseBridgeMessage('a'.repeat(40_001), SAHIKA_PAGE_URL), null);
});

test('ready waits for configured assistant controls, then reports once', () => {
  const app = fixture();
  assert.equal(app.messages.length, 0);
  app.addControls(); app.refresh();
  assert.equal(app.messages.length, 0);
  app.configure(); app.refresh(); app.refresh();
  assert.deepEqual(app.messages.map(value => JSON.parse(value)), [{ type: 'SAHIKA_APP_READY', version: 1 }]);
  assert.equal(app.styles.size, 1);
  const patched = app.devices.getUserMedia;
  vm.runInContext(buildAppBootstrapScript(), app.context);
  assert.equal(app.devices.getUserMedia, patched, 'reinjection must not wrap microphone capture twice');
});

test('65.3 readiness also works when only the configured boot shell publishes its state', () => {
  const app = fixture();
  app.configureLegacy(); app.refresh();
  assert.equal(app.messages.length, 0, 'config alone is not an interactive assistant');
  app.addControls(); app.refresh();
  assert.equal(JSON.parse(app.messages[0]).type, 'SAHIKA_APP_READY');
});

test('text downloads preserve UTF-8 and reject paths, size mismatches and active formats', () => {
  const text = '\uFEFFŞahika: kedin nasıl? 🐈';
  const message = { type: 'SAHIKA_APP_DOWNLOAD', version: 1, id: 'export_123_1', filename: 'Sahika_Konusma_2026-10-15.txt', mime: 'text/plain', text, size: utf8ByteLength(text) };
  assert.equal(message.size, new TextEncoder().encode(text).byteLength);
  assert.deepEqual(parseBridgeMessage(JSON.stringify(message), SAHIKA_PAGE_URL), message);
  assert.equal(parseBridgeMessage(JSON.stringify({ ...message, filename: '../Secrets.txt' }), SAHIKA_PAGE_URL), null);
  assert.equal(parseBridgeMessage(JSON.stringify({ ...message, filename: 'Sahika.html', mime: 'text/html' }), SAHIKA_PAGE_URL), null);
  assert.equal(parseBridgeMessage(JSON.stringify({ ...message, size: message.size + 1 }), SAHIKA_PAGE_URL), null);
  assert.equal(parseBridgeMessage(JSON.stringify({ ...message, mime: 'application/json' }), SAHIKA_PAGE_URL), null);
});

test('the source TXT Blob keeps its BOM through the actual injected export conversion', async () => {
  const text = '\uFEFFŞahika: kedin nasıl? 🐈';
  const app = fixture(undefined, new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = { tagName: 'A', href: 'blob:https://www.pulseveteriner.com/export-123',
    hasAttribute: () => true, getAttribute: () => 'Sahika_Konusma_2026-10-15.txt' };
  const event = { isTrusted: true, composedPath: () => [anchor], preventDefault() {}, stopImmediatePropagation() {} };
  for (const listener of app.listeners.get('click') ?? []) listener(event);
  for (let index = 0; index < 10 && !app.messages.length; ++index) await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(app.messages.length, 1);
  const message = parseBridgeMessage(app.messages[0], SAHIKA_PAGE_URL);
  assert.equal(message?.type, 'SAHIKA_APP_DOWNLOAD');
  if (message?.type === 'SAHIKA_APP_DOWNLOAD') {
    assert.equal(message.text, text);
    assert.equal(message.size, new TextEncoder().encode(text).byteLength);
  }
});

test('background uses the public stop attribute and closes captured tracks', async () => {
  let stops = 0;
  const track: Track = { readyState: 'live', stop() { ++stops; this.readyState = 'ended'; }, addEventListener() {} };
  const app = fixture(async () => ({ getTracks: () => [track] }));
  await app.devices.getUserMedia();
  app.run('background');
  assert.equal(stops, 1);
  assert.equal(app.stoppedKeys.length, 1);
  assert.ok(app.media.pauses > 0);
  await assert.rejects(app.devices.getUserMedia(), { name: 'AbortError' });
  app.run('active');
  assert.equal(stops, 1, 'returning to foreground never reopens the microphone');
});

test('a capture resolving after background is stopped before reaching the voice SDK', async () => {
  let resolve!: (stream: { getTracks: () => Track[] }) => void;
  const promise = new Promise<{ getTracks: () => Track[] }>(done => { resolve = done; });
  let stops = 0;
  const track: Track = { readyState: 'live', stop() { ++stops; }, addEventListener() {} };
  const app = fixture(() => promise);
  const pending = app.devices.getUserMedia();
  app.run('background');
  resolve({ getTracks: () => [track] });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(stops, 1);
});

test('returning to foreground never revives a microphone permission request from an ended session', async () => {
  let resolve!: (stream: { getTracks: () => Track[] }) => void;
  const promise = new Promise<{ getTracks: () => Track[] }>(done => { resolve = done; });
  let stops = 0;
  const track: Track = { readyState: 'live', stop() { ++stops; }, addEventListener() {} };
  const app = fixture(() => promise);
  const pending = app.devices.getUserMedia();
  app.run('background'); app.run('active');
  resolve({ getTracks: () => [track] });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(stops, 1);
});

test('first microphone permission dialog does not cancel its own capture request', async () => {
  let resolve!: (stream: { getTracks: () => Track[] }) => void;
  const promise = new Promise<{ getTracks: () => Track[] }>(done => { resolve = done; });
  let stops = 0;
  const track: Track = { readyState: 'live', stop() { ++stops; this.readyState = 'ended'; }, addEventListener() {} };
  const app = fixture(() => promise);
  const pending = app.devices.getUserMedia();
  app.run('inactive');
  resolve({ getTracks: () => [track] });
  await pending;
  assert.equal(stops, 0);
  assert.equal(app.stoppedKeys.length, 0);
  app.run('inactive');
  assert.equal(stops, 1, 'later interruptions with active capture close it');
  assert.equal(app.stoppedKeys.length, 1);
});
