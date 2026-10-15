import branding from '../../assets/app-branding.json';
import { APP_SHADOW_CSS, type AppInsets, ZERO_INSETS } from './appLayout';
import { APP_LAYOUT_RUNTIME_SOURCE } from './appLayoutRuntime.generated';

/** The signed app loads the live Wix assistant over HTTPS so microphone capture stays secure. */
export const SAHIKA_PAGE_URL = 'https://www.pulseveteriner.com/sahika';
export const SAHIKA_ELEMENT_TAG = 'pulsevet-sahika-new';
export const APP_BRIDGE_VERSION = 1;
export const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;

export function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    length += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return length;
}

function downloadMime(filename: unknown): 'text/plain' | 'application/json' | null {
  if (typeof filename !== 'string' || filename.length > 128
    || !/^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.(txt|json)$/u.test(filename)
    || filename.includes('..')) return null;
  return filename.endsWith('.txt') ? 'text/plain' : 'application/json';
}

function parseUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 36_000 || value !== value.trim()
    || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.username || url.password ? null : url;
  } catch { return null; }
}

export function isSahikaPageUrl(value: unknown): boolean {
  const url = parseUrl(value);
  return !!url && url.protocol === 'https:' && !url.port
    && ['www.pulseveteriner.com', 'pulseveteriner.com'].includes(url.hostname)
    && ['/sahika', '/sahika/'].includes(url.pathname);
}

/** External destinations are handed off only after an observed user gesture. */
export function externalDestination(value: unknown): string | null {
  const url = parseUrl(value);
  if (!url || isSahikaPageUrl(value)) return null;
  if (url.protocol === 'https:' && !url.port) return url.href;
  if (url.protocol === 'tel:' && /^\+?[\d().-]+$/u.test(url.pathname)) return url.href;
  if (url.protocol === 'mailto:' && url.pathname && url.href.length <= 2048) return url.href;
  return null;
}

export type AppBridgeMessage = { type: 'SAHIKA_APP_READY'; version: 1 }
  | { type: 'SAHIKA_APP_EXTERNAL'; version: 1; url: string }
  | { type: 'SAHIKA_APP_DOWNLOAD'; version: 1; id: string; filename: string; mime: 'text/plain' | 'application/json'; text: string; size: number };

export function parseBridgeMessage(raw: unknown, sourceUrl: unknown): AppBridgeMessage | null {
  if (!isSahikaPageUrl(sourceUrl) || typeof raw !== 'string' || raw.length > MAX_DOWNLOAD_BYTES * 6 + 1024) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || value.version !== APP_BRIDGE_VERSION) return null;
    if (value.type === 'SAHIKA_APP_READY' && Object.keys(value).length === 2) return value;
    if (value.type === 'SAHIKA_APP_EXTERNAL' && Object.keys(value).length === 3) {
      const url = externalDestination(value.url);
      return url ? { type: value.type, version: 1, url } : null;
    }
    if (value.type === 'SAHIKA_APP_DOWNLOAD' && Object.keys(value).length === 7
      && typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/u.test(value.id)
      && downloadMime(value.filename) === value.mime && value.mime
      && typeof value.text === 'string' && value.text.length <= MAX_DOWNLOAD_BYTES
      && Number.isSafeInteger(value.size) && value.size > 0 && value.size <= MAX_DOWNLOAD_BYTES
      && utf8ByteLength(value.text) === value.size) return value;
  } catch { /* Wix messages unrelated to this bridge are ignored. */ }
  return null;
}

/** Only the existing assistant and its ancestor chain form the application canvas. */
export const APP_PAGE_CSS = `
html[data-sahika-ios-app] [data-sahika-app-path]:not(${SAHIKA_ELEMENT_TAG}) > :not([data-sahika-app-path]):not([data-pv-sahika-backdrop]) {
  display:none!important;
}
html[data-sahika-ios-app] [data-sahika-app-path] {
  display:block!important;position:static!important;inset:auto!important;
  width:100%!important;min-width:0!important;max-width:none!important;
  height:100%!important;min-height:0!important;max-height:100%!important;
  margin:0!important;padding:0!important;border:0!important;
  box-sizing:border-box!important;overflow:hidden!important;
  grid-area:auto!important;align-self:auto!important;justify-self:auto!important;
  transform:none!important;translate:none!important;scale:none!important;rotate:none!important;
  background:transparent!important;box-shadow:none!important;
  visibility:visible!important;opacity:1!important;pointer-events:auto!important;
  animation:none!important;transition:none!important;
}
html[data-sahika-ios-app] [data-sahika-app-path]::before,
html[data-sahika-ios-app] [data-sahika-app-path]::after { display:none!important; }
html[data-sahika-ios-app],
html[data-sahika-ios-app] body[data-sahika-app-path] {
  width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;
  margin:0!important;padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;-webkit-text-size-adjust:100%;
}
html[data-sahika-ios-app] body { background:#f3f3f3!important; }
html[data-sahika-ios-app] [data-pv-sahika-backdrop] { position:fixed!important;inset:0!important; }
@font-face { font-family:SahikaAppTitle;src:url("${branding.titleFont}") format('truetype');font-display:swap; }
html[data-sahika-ios-app] ${SAHIKA_ELEMENT_TAG}[data-sahika-app-layout] {
  display:flex!important;height:var(--sahika-app-height,100dvh)!important;min-height:0!important;
}
`;

/** Runs in the main HTTPS document before Wix starts, and again idempotently after load. */
export function buildAppBootstrapScript(insets: AppInsets = ZERO_INSETS): string {
  return String.raw`
(function () {
  if (window.top !== window || location.protocol !== 'https:' ||
      !['www.pulseveteriner.com','pulseveteriner.com'].includes(location.hostname) ||
      !['/sahika','/sahika/'].includes(location.pathname)) return;
  if (window.__SAHIKA_IOS_BRIDGE_V1) { window.__SAHIKA_IOS_BRIDGE_V1.updateInsets(${JSON.stringify(insets)}); window.__SAHIKA_IOS_BRIDGE_V1.refresh(); return; }
  var tag = ${JSON.stringify(SAHIKA_ELEMENT_TAG)};
  var css = ${JSON.stringify(APP_PAGE_CSS)};
  var layout = (${APP_LAYOUT_RUNTIME_SOURCE})();
  var layoutOptions = ${JSON.stringify({css:APP_SHADOW_CSS, avatar:branding.avatar, pulsevet:branding.pulsevet, yapayMevzular:branding.yapayMevzular, insets})};
  var tracks = new Set();
  var suspended = false;
  var captureEpoch = 0;
  var readySent = false;
  var serial = 0;
  var trustedGestureAt = 0;
  var downloadBusy = false;
  var lastState = null;
  var poll = null;
  var observer = null;
  var appPath = [];
  var startedAt = Date.now();
  function host() { return document.querySelector(tag); }
  function isolateAssistant(element) {
    if (!element || !document.body) return false;
    var nextPath = [];
    for (var node = element; node; node = node.parentElement) {
      nextPath.push(node);
      if (node === document.body) break;
    }
    if (nextPath[nextPath.length - 1] !== document.body) return false;
    // Keep the live element connected: moving it would tear down its voice session.
    appPath.forEach(function (node) {
      if (nextPath.indexOf(node) === -1) node.removeAttribute('data-sahika-app-path');
    });
    nextPath.forEach(function (node) {
      if (!node.hasAttribute('data-sahika-app-path')) node.setAttribute('data-sahika-app-path','');
    });
    appPath = nextPath;
    return true;
  }
  function send(value) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(value));
  }
  function pauseMedia(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('audio,video').forEach(function (media) { try { media.pause(); } catch (_) {} });
  }
  function stopTracks() {
    tracks.forEach(function (track) { try { track.stop(); } catch (_) {} });
    tracks.clear();
  }
  function transition(reason) {
    if (reason === 'active') { suspended = false; return; }
    var element = host();
    // The iOS permission dialog itself becomes inactive; do not cancel its first capture request.
    var capturing = Array.from(tracks).some(function (track) { return track.readyState !== 'ended'; });
    var voiceConnected = lastState && lastState.mode === 'voice' && lastState.status === 'connected';
    if (reason === 'inactive' && !capturing && !voiceConnected) return;
    suspended = true;
    ++captureEpoch;
    // Public source contract in PulseVet's custom element; no private controller access.
    if (element) element.setAttribute('force-stop-key', 'ios-' + Date.now() + '-' + (++serial));
    stopTracks();
    pauseMedia(document);
    if (element) pauseMedia(element.shadowRoot);
    var backdrop = document.querySelector('[data-pv-sahika-backdrop]');
    if (backdrop) pauseMedia(backdrop.shadowRoot);
  }
  var devices = navigator.mediaDevices;
  if (devices && typeof devices.getUserMedia === 'function') {
    var getUserMedia = devices.getUserMedia;
    devices.getUserMedia = function () {
      if (suspended) return Promise.reject(new DOMException('Application is inactive','AbortError'));
      var requestedEpoch = captureEpoch;
      return getUserMedia.apply(devices, arguments).then(function (stream) {
        var captured = stream.getTracks();
        if (suspended || requestedEpoch !== captureEpoch) {
          captured.forEach(function (track) { track.stop(); });
          throw new DOMException('Application left foreground','AbortError');
        }
        captured.forEach(function (track) {
          tracks.add(track);
          track.addEventListener('ended', function () { tracks.delete(track); }, { once:true });
        });
        return stream;
      });
    };
  }
  function refresh() {
    if (!document.documentElement) return;
    document.documentElement.setAttribute('data-sahika-ios-app','');
    var style = document.getElementById('sahika-ios-app-style');
    if (!style) {
      style = document.createElement('style'); style.id = 'sahika-ios-app-style';
      style.textContent = css; (document.head || document.documentElement).appendChild(style);
    }
    var element = host();
    var isolated = isolateAssistant(element);
    var root = element && element.shadowRoot;
    var layoutReady = element && layout.install(element, layoutOptions);
    // ui-ready fires before loadConfig. Wait for the real configured assistant controls.
    var controls = root && root.querySelector('button.vf-main,button.main,button.vf-start');
    var region = root && root.querySelector('.vf-root,section.frame');
    var boot = root && root.querySelector('.boot-shell');
    // Both deployed 65.2 and uploaded 65.3 publish ui-visible only after config/bridge setup.
    var configured = element && (element.hasAttribute('data-sahika-ready') ||
      (boot && boot.hidden && !element.hasAttribute('data-sahika-loading')));
    if (!readySent && style.isConnected && isolated && layoutReady && configured && controls && region) {
      readySent = true;
      send({type:'SAHIKA_APP_READY',version:1});
      if (poll) clearInterval(poll);
    } else if (Date.now() - startedAt > 90000) {
      if (poll) clearInterval(poll);
    }
  }
  document.addEventListener('ui-state', function (event) {
    if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === tag) {
      lastState = event.detail && {status:event.detail.status,mode:event.detail.mode};
    }
  });
  document.addEventListener('ui-ready', refresh);
  ['pointerdown','keydown','click'].forEach(function (name) {
    document.addEventListener(name, function (event) { if (event.isTrusted) trustedGestureAt = Date.now(); }, true);
  });
  document.addEventListener('click', function (event) {
    if (!event.isTrusted && Date.now() - trustedGestureAt > 1500) return;
    var path = event.composedPath ? event.composedPath() : [event.target];
    var anchor = path.find(function (node) { return node && node.tagName === 'A'; });
    if (!anchor || !anchor.href) return;
    if (anchor.hasAttribute('download') && anchor.href.indexOf('blob:') === 0) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (downloadBusy) return;
      var filename = anchor.getAttribute('download') || '';
      var extension = filename.endsWith('.txt') ? 'text/plain' : filename.endsWith('.json') ? 'application/json' : '';
      if (!extension || filename.length > 128 || !/^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.(txt|json)$/u.test(filename) || filename.indexOf('..') !== -1) return;
      var blobUrl;
      try { blobUrl = new URL(anchor.href); } catch (_) { return; }
      if (blobUrl.origin !== location.origin) return;
      downloadBusy = true;
      // Fetch synchronously: the source custom element revokes its temporary Blob URL.
      fetch(anchor.href).then(function (response) { return response.blob(); }).then(function (blob) {
        if (!blob.size || blob.size > ${MAX_DOWNLOAD_BYTES} || (blob.type && blob.type.split(';')[0] !== extension)) throw new Error('Unsupported export');
        // Source TXT includes a UTF-8 BOM; Blob.text() would strip it and change the verified size.
        return blob.arrayBuffer().then(function (buffer) {
          var text = new TextDecoder('utf-8',{ignoreBOM:true}).decode(buffer);
          send({type:'SAHIKA_APP_DOWNLOAD',version:1,id:'export_' + Date.now() + '_' + (++serial),filename:filename,mime:extension,text:text,size:blob.size});
        });
      }).catch(function () { /* No conversation contents are exposed through logs. */ }).finally(function () { downloadBusy = false; });
      return;
    }
    var url;
    try { url = new URL(anchor.href, location.href); } catch (_) { return; }
    var internal = url.protocol === 'https:' && ['www.pulseveteriner.com','pulseveteriner.com'].includes(url.hostname)
      && ['/sahika','/sahika/'].includes(url.pathname) && !url.port && !url.username && !url.password;
    if (internal) return;
    if (!['https:','tel:','mailto:'].includes(url.protocol) || url.username || url.password || url.href.length > 36000) return;
    event.preventDefault(); event.stopImmediatePropagation();
    send({type:'SAHIKA_APP_EXTERNAL',version:1,url:url.href});
  }, true);
  window.addEventListener('pagehide', function () { transition('background'); });
  window.__SAHIKA_IOS_BRIDGE_V1 = { refresh:refresh, transition:transition, updateInsets:function(insets){layoutOptions.insets=insets;layout.viewport();} };
  if (typeof MutationObserver === 'function' && document.documentElement) {
    // Wix can hydrate mobile headers, pinned menus or a replacement page after READY.
    // Shadow-root conversation updates are outside this lightweight document observer.
    observer = new MutationObserver(refresh);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  poll = setInterval(refresh,200);
  refresh();
})(); true;
`;
}

export type AppTransition = 'active' | 'inactive' | 'background' | 'unmount';

export function buildAppTransitionScript(reason: AppTransition): string {
  return `(function(){var bridge=window.__SAHIKA_IOS_BRIDGE_V1;if(bridge)bridge.transition(${JSON.stringify(reason)});})();true;`;
}
