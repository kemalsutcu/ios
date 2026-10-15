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

class PageElement {
  readonly attributes = new Map<string, string>();
  readonly children: PageElement[] = [];
  readonly properties = new Map<string, string>();
  readonly style = {
    setProperty: (name: string, value: string) => this.properties.set(name, value),
    getPropertyValue: (name: string) => this.properties.get(name) ?? '',
  };
  parentElement: PageElement | null = null;
  id = '';
  className = '';
  textContent = '';
  src = '';
  alt = '';
  hidden = false;

  constructor(readonly tagName: string, parent?: PageElement) {
    if (parent) this.attach(parent);
  }
  get isConnected(): boolean {
    return ['HTML', 'HEAD', 'BODY'].includes(this.tagName) || !!this.parentElement?.isConnected;
  }
  attach(parent: PageElement) {
    const previous = this.parentElement;
    if (previous) {
      const index = previous.children.indexOf(this);
      if (index !== -1) previous.children.splice(index, 1);
    }
    this.parentElement = parent;
    parent.children.push(this);
  }
  append(...nodes: PageElement[]) { nodes.forEach(node => node.attach(this)); }
  appendChild(node: PageElement) { this.append(node); return node; }
  prepend(...nodes: PageElement[]) {
    nodes.forEach(node => node.attach(this));
    this.children.splice(0, 0, ...this.children.splice(this.children.length - nodes.length, nodes.length));
  }
  replaceChildren(...nodes: PageElement[]) {
    this.children.forEach(node => { node.parentElement = null; });
    this.children.splice(0);
    this.append(...nodes);
  }
  getElementById(id: string): PageElement | null {
    for (const child of this.children) {
      if (child.id === id) return child;
      const result = child.getElementById(id);
      if (result) return result;
    }
    return null;
  }
  hasAttribute(name: string) { return this.attributes.has(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  toggleAttribute(name: string, force?: boolean) {
    const enabled = force ?? !this.hasAttribute(name);
    if (enabled) this.setAttribute(name, ''); else this.removeAttribute(name);
    return enabled;
  }
}

function fixture(getUserMedia: () => Promise<{ getTracks: () => Track[] }> = async () => ({ getTracks: () => [] }), downloadBlob?: Blob,
  insets = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const messages: string[] = [];
  const stoppedKeys: string[] = [];
  const listeners = new Map<string, ((event: DomEvent) => void)[]>();
  const windowListeners = new Map<string, (() => void)[]>();
  const viewportListeners = new Map<string, (() => void)[]>();
  const styles = new Map<string, PageElement>();
  let configured = false;
  let readyAttribute = true;
  let controls = false;
  const body = new PageElement('BODY');
  const head = new PageElement('HEAD');
  const html = new PageElement('HTML');
  const site = new PageElement('DIV', body);
  const page = new PageElement('MAIN', site);
  const section = new PageElement('SECTION', page);
  const wrapper = new PageElement('DIV', section);
  const node = new PageElement('PULSEVET-SAHIKA-NEW', wrapper);
  const shadow = new PageElement('SHADOW', node);
  const frame = new PageElement('SECTION', shadow); frame.className = 'frame vf-root';
  const control = new PageElement('BUTTON', frame); control.className = 'vf-main';
  const boot = new PageElement('DIV', shadow); boot.className = 'boot-shell';
  const observed = new Map<PageElement, Set<() => void>>();
  let hostNode: typeof element | null;
  const media = { pauses: 0, pause() { ++this.pauses; } };
  const element = Object.assign(node, {
    hasAttribute: (name: string) => name === 'data-sahika-ready' ? readyAttribute && configured : name === 'data-sahika-loading' ? !configured : node.attributes.has(name),
    setAttribute: (name: string, value: string) => { node.attributes.set(name, value); if (name === 'force-stop-key') stoppedKeys.push(value); },
    shadowRoot: Object.assign(shadow, {
      querySelector: (selector: string) => selector === '.boot-shell' ? { hidden: configured }
        : selector === '.vf-root,section.frame' ? shadow.children.find(child => child.className.includes('vf-root')) ?? null
        : controls ? control : null,
      querySelectorAll: () => [media],
    }),
  });
  hostNode = element;
  const appendHead = head.appendChild.bind(head);
  head.appendChild = (style: PageElement) => { styles.set(style.id, style); return appendHead(style); };
  const document = {
    documentElement: html,
    body,
    head,
    querySelector: (selector: string) => selector === 'pulsevet-sahika-new' ? hostNode : null,
    querySelectorAll: () => [media],
    getElementById: (id: string) => styles.get(id),
    createElement: (tag: string) => new PageElement(tag.toUpperCase()),
    addEventListener(name: string, callback: (event: DomEvent) => void) {
      listeners.set(name, [...(listeners.get(name) ?? []), callback]);
    },
  };
  const visualViewport = {
    height: 844,
    addEventListener(name: string, callback: () => void) {
      viewportListeners.set(name, [...(viewportListeners.get(name) ?? []), callback]);
    },
  };
  const window = {
    top: undefined as unknown,
    innerHeight: 844,
    scrollX: 0, scrollY: 0,
    scrollTo(x: number, y: number) { this.scrollX = x; this.scrollY = y; },
    visualViewport,
    ReactNativeWebView: { postMessage(value: string) { messages.push(value); } },
    addEventListener(name: string, callback: () => void) {
      windowListeners.set(name, [...(windowListeners.get(name) ?? []), callback]);
    },
  };
  window.top = window;
  const devices = { getUserMedia };
  const context = vm.createContext({
    window, document, location: new URL(SAHIKA_PAGE_URL), navigator: { mediaDevices: devices },
    URL, Set, DOMException, Date, TextDecoder,
    fetch: async () => ({ blob: async () => downloadBlob }),
    MutationObserver: class {
      private target: PageElement | null = null;
      constructor(private readonly callback: () => void) {}
      observe(target: PageElement) {
        this.disconnect(); this.target = target;
        const callbacks = observed.get(target) ?? new Set<() => void>();
        callbacks.add(this.callback); observed.set(target, callbacks);
      }
      disconnect() { if (this.target) observed.get(this.target)?.delete(this.callback); this.target = null; }
    },
    setInterval: () => 1, clearInterval() {},
  });
  vm.runInContext(buildAppBootstrapScript(insets), context);
  const run = (reason: 'active' | 'inactive' | 'background' | 'unmount') => vm.runInContext(buildAppTransitionScript(reason), context);
  const refresh = () => vm.runInContext('window.__SAHIKA_IOS_BRIDGE_V1.refresh()', context);
  const notify = (target: PageElement) => [...(observed.get(target) ?? [])].forEach(callback => callback());
  return { messages, stoppedKeys, devices, media, context, run, refresh, styles, window, visualViewport,
    configure() { configured = true; }, configureLegacy() { configured = true; readyAttribute = false; }, addControls() { controls = true; }, listeners,
    body, site, page, section, wrapper, element, shadow, frame,
    notifyMutation() { notify(html); },
    notifyShadowMutation() { notify(shadow); },
    resize(height: number, visualHeight = height) {
      window.innerHeight = height; visualViewport.height = visualHeight;
      for (const callback of windowListeners.get('resize') ?? []) callback();
      for (const callback of viewportListeners.get('resize') ?? []) callback();
    },
    scrollViewport() { for (const callback of viewportListeners.get('scroll') ?? []) callback(); },
    rebuildShadow() {
      const replacement = new PageElement('SECTION'); replacement.className = 'frame vf-root';
      shadow.replaceChildren(replacement); notify(shadow); return replacement;
    },
    setHostAvailable(available: boolean) { hostNode = available ? element : null; },
  };
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

test('application canvas excludes desktop, mobile, pinned and language branches without moving the assistant', () => {
  const app = fixture();
  const desktopHeader = new PageElement('HEADER', app.page);
  const mobileHeader = new PageElement('DIV', app.page);
  const languageMenu = new PageElement('NAV', mobileHeader);
  const title = new PageElement('SECTION', app.page);
  const footer = new PageElement('FOOTER', app.page);
  const pinnedMenu = new PageElement('DIV', app.site);
  const backdrop = new PageElement('DIV', app.body);
  backdrop.setAttribute('data-pv-sahika-backdrop', '');
  app.configure(); app.addControls(); app.refresh();

  for (const ancestor of [app.element, app.wrapper, app.section, app.page, app.site, app.body]) {
    assert.equal(ancestor.hasAttribute('data-sahika-app-path'), true);
  }
  for (const chrome of [desktopHeader, mobileHeader, languageMenu, title, footer, pinnedMenu, backdrop]) {
    assert.equal(chrome.hasAttribute('data-sahika-app-path'), false);
  }
  assert.equal(app.element.parentElement, app.wrapper, 'the configured custom element must stay connected in place');
  assert.equal(backdrop.parentElement, app.body, 'the source-owned background stays connected');
  assert.equal(app.messages.length, 1);
});

test('post-ready Wix hydration keeps isolation current after the existing assistant changes ancestors', () => {
  const app = fixture();
  app.configure(); app.addControls(); app.refresh();
  const replacementPage = new PageElement('MAIN', app.site);
  const replacementWrapper = new PageElement('DIV', replacementPage);
  new PageElement('HEADER', replacementPage);
  app.element.attach(replacementWrapper); // Models Wix reconciliation, not a bridge operation.
  app.notifyMutation();

  assert.equal(replacementPage.hasAttribute('data-sahika-app-path'), true);
  assert.equal(replacementWrapper.hasAttribute('data-sahika-app-path'), true);
  for (const removedAncestor of [app.page, app.section, app.wrapper]) {
    assert.equal(removedAncestor.hasAttribute('data-sahika-app-path'), false);
  }
  assert.equal(app.messages.length, 1, 'late hydration must not send duplicate readiness events');
});

test('ready never reveals a detached assistant before its application path reaches the body', () => {
  const app = fixture();
  app.element.parentElement = null;
  app.configure(); app.addControls(); app.refresh();
  assert.equal(app.messages.length, 0);
  app.element.attach(app.wrapper);
  app.notifyMutation();
  assert.equal(app.messages.length, 1);
});

test('one shared assistant canvas injects identity and partner logos exactly once', () => {
  const app = fixture();
  const identity = app.shadow.getElementById('sahika-app-identity');
  const partners = app.shadow.getElementById('sahika-app-partners');
  assert.ok(identity, 'identity must belong to the same assistant shadow document');
  assert.ok(partners, 'the partner footer must belong to the same assistant shadow document');
  assert.equal(app.messages.length, 0, 'branding alone must not expose an unconfigured assistant');
  assert.equal(identity.children[0].children[0].textContent, 'Şahika');
  assert.equal(identity.children[2].alt, 'Şahika’nın avatarı');
  assert.match(identity.children[2].src, /^data:image\//u);
  assert.equal(partners.children[0].alt, 'PulseVet');
  assert.equal(partners.children[1].textContent, '×');
  assert.equal(partners.children[2].alt, 'Yapay Mevzular');
  assert.equal(app.shadow.children[0], identity);
  assert.equal(app.shadow.children.at(-1), partners);

  app.configure(); app.addControls();
  app.refresh(); app.refresh(); app.notifyShadowMutation();
  assert.equal(app.shadow.children.filter(child => child.id === identity.id).length, 1);
  assert.equal(app.shadow.children.filter(child => child.id === partners.id).length, 1);
  assert.equal(app.shadow.getElementById(identity.id), identity, 'updates must preserve the same identity node');
  assert.equal(app.shadow.getElementById(partners.id), partners, 'updates must preserve the same footer node');
  assert.equal(app.element.parentElement, app.wrapper, 'layout must never detach the live custom element');
  assert.equal(app.frame.parentElement, app.shadow, 'layout must never reparent the source-owned assistant frame');
  assert.equal(app.messages.length, 1);
});

test('source shadow rebuild reinstalls branding while the live host remains connected', () => {
  const app = fixture(); app.configure(); app.addControls(); app.refresh();
  const oldIdentity = app.shadow.getElementById('sahika-app-identity');
  const oldPartners = app.shadow.getElementById('sahika-app-partners');
  const replacementFrame = app.rebuildShadow();
  const identity = app.shadow.getElementById('sahika-app-identity');
  const partners = app.shadow.getElementById('sahika-app-partners');
  assert.ok(identity && partners);
  assert.notEqual(identity, oldIdentity);
  assert.notEqual(partners, oldPartners);
  assert.equal(oldIdentity?.isConnected, false);
  assert.equal(oldPartners?.isConnected, false);
  assert.ok(app.shadow.getElementById('sahika-app-layout-style'), 'rebuilds must restore the height and overflow stylesheet');
  assert.equal(app.shadow.children[0], identity);
  assert.equal(app.shadow.children.at(-1), partners);
  assert.equal(replacementFrame.parentElement, app.shadow);
  assert.equal(app.element.parentElement, app.wrapper);
  assert.equal(app.element.isConnected, true);
  assert.equal(app.messages.length, 1, 'rebuilding presentation must not restart or reannounce the assistant');
});

test('keyboard and small viewport changes fit the visible height and restore safe insets', () => {
  const app = fixture(undefined, undefined, { top: 59, right: 3, bottom: 34, left: 3 });
  assert.equal(app.element.style.getPropertyValue('--sahika-app-height'), '844px');
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-top'), '59px');
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-bottom'), '34px');
  assert.equal(app.element.hasAttribute('data-sahika-app-short'), false);
  app.resize(844, 320); // iOS keyboard changes the visual viewport before the layout viewport.
  assert.equal(app.element.style.getPropertyValue('--sahika-app-height'), '320px');
  assert.equal(app.element.hasAttribute('data-sahika-app-short'), true);
  assert.equal(app.element.hasAttribute('data-sahika-app-compact'), true);
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-bottom'), '0px', 'keyboard already occupies the bottom inset');
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-top'), '59px');
  app.window.scrollY = 72; app.scrollViewport();
  assert.equal(app.window.scrollY, 0, 'focus panning must not leave the outer page scrolled');

  app.resize(667);
  assert.equal(app.element.style.getPropertyValue('--sahika-app-height'), '667px');
  assert.equal(app.element.hasAttribute('data-sahika-app-short'), false);
  assert.equal(app.element.hasAttribute('data-sahika-app-compact'), true);
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-bottom'), '34px');
  app.resize(844);
  assert.equal(app.element.hasAttribute('data-sahika-app-compact'), false);
});

test('native safe-area changes update the existing layout without duplicate branding', () => {
  const app = fixture();
  const identity = app.shadow.getElementById('sahika-app-identity');
  vm.runInContext(buildAppBootstrapScript({ top: 47, right: 0, bottom: 21, left: 0 }), app.context);
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-top'), '47px');
  assert.equal(app.element.style.getPropertyValue('--sahika-safe-bottom'), '21px');
  assert.equal(app.shadow.getElementById('sahika-app-identity'), identity);
  assert.equal(app.shadow.children.filter(child => child.id === 'sahika-app-partners').length, 1);
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
