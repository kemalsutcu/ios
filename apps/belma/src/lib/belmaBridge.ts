import branding from '../../assets/branding-data.json';

/** The live HTTPS origin preserves WKWebView microphone and document APIs. */
export const BELMA_PAGE_URL = 'https://www.yapaymevzular.com/belmabelge';
export const BELMA_ELEMENT_TAG = 'virtari-belma-belge';
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = {
  txt: 'text/plain', json: 'application/json', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  udf: 'application/vnd.uyap.udf',
} as const;

function parseUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 36000 || value !== value.trim()
    || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try { const url = new URL(value); return url.username || url.password ? null : url; }
  catch { return null; }
}

export function isBelmaPageUrl(value: unknown): boolean {
  const url = parseUrl(value);
  return !!url && url.protocol === 'https:' && !url.port
    && ['www.yapaymevzular.com', 'yapaymevzular.com'].includes(url.hostname)
    && ['/belmabelge', '/belmabelge/'].includes(url.pathname);
}

export function externalDestination(value: unknown): string | null {
  const url = parseUrl(value);
  if (!url || isBelmaPageUrl(value)) return null;
  if (url.protocol === 'https:' && !url.port) return url.href;
  if (url.protocol === 'tel:' && /^\+?[\d().-]+$/u.test(url.pathname)) return url.href;
  if (url.protocol === 'mailto:' && url.pathname && url.href.length <= 2048) return url.href;
  return null;
}

export function downloadMime(filename: unknown): string | null {
  if (typeof filename !== 'string' || filename.length > 160 || filename.includes('..')
    || !/^[\p{L}\p{N}][\p{L}\p{N} _().'’–—-]*\.(txt|json|pdf|docx|udf)$/u.test(filename)) return null;
  return MIME_TYPES[filename.slice(filename.lastIndexOf('.') + 1) as keyof typeof MIME_TYPES] || null;
}

/** Strict canonical base64 length check, including the otherwise unused padding bits. */
export function base64ByteLength(value: unknown): number | null {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(MAX_DOWNLOAD_BYTES / 3) * 4
    || value.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const final = alphabet.indexOf(value[value.length - padding - 1]);
  if ((padding === 2 && (final & 15) !== 0) || (padding === 1 && (final & 3) !== 0)) return null;
  return value.length / 4 * 3 - padding;
}

export function decodeBase64(value: string): Uint8Array {
  const length = base64ByteLength(value);
  if (length === null) throw new Error('Invalid document encoding');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(length);
  let output = 0;
  for (let offset = 0; offset < value.length; offset += 4) {
    const word = (alphabet.indexOf(value[offset]) << 18) | (alphabet.indexOf(value[offset + 1]) << 12)
      | (Math.max(0, alphabet.indexOf(value[offset + 2])) << 6) | Math.max(0, alphabet.indexOf(value[offset + 3]));
    if (output < length) bytes[output++] = word >> 16 & 255;
    if (output < length) bytes[output++] = word >> 8 & 255;
    if (output < length) bytes[output++] = word & 255;
  }
  return bytes;
}

export type DownloadMessage = { type: 'BELMA_APP_DOWNLOAD'; version: 1; id: string; filename: string; mime: string; base64: string; size: number };
export type BridgeMessage = { type: 'BELMA_APP_READY'; version: 1 }
  | { type: 'BELMA_APP_ERROR'; version: 1; code: 'DOWNLOAD_FAILED' }
  | { type: 'BELMA_APP_EXTERNAL'; version: 1; url: string }
  | DownloadMessage;

export function parseBridgeMessage(raw: unknown, sourceUrl: unknown): BridgeMessage | null {
  if (!isBelmaPageUrl(sourceUrl) || typeof raw !== 'string' || raw.length > Math.ceil(MAX_DOWNLOAD_BYTES / 3) * 4 + 2048) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || value.version !== 1) return null;
    const keys = Object.keys(value).length;
    if (value.type === 'BELMA_APP_READY' && keys === 2) return value;
    if (value.type === 'BELMA_APP_ERROR' && keys === 3 && value.code === 'DOWNLOAD_FAILED') return value;
    if (value.type === 'BELMA_APP_EXTERNAL' && keys === 3) {
      const url = externalDestination(value.url);
      return url ? { type: value.type, version: 1, url } : null;
    }
    if (value.type === 'BELMA_APP_DOWNLOAD' && keys === 7 && typeof value.id === 'string'
      && /^[A-Za-z0-9_-]{1,64}$/u.test(value.id) && downloadMime(value.filename) === value.mime && value.mime
      && Number.isSafeInteger(value.size) && value.size > 0 && value.size <= MAX_DOWNLOAD_BYTES
      && base64ByteLength(value.base64) === value.size) return value;
  } catch { /* Unrelated Wix messages and malformed messages have no side effects. */ }
  return null;
}

export const APP_PAGE_CSS = `
html[data-belma-ios-app] [data-belma-app-path]:not(${BELMA_ELEMENT_TAG}) > :not([data-belma-app-path]) { display:none!important; }
html[data-belma-ios-app] [data-belma-app-path] {
  display:block!important;position:static!important;inset:auto!important;
  width:100%!important;min-width:0!important;max-width:none!important;
  height:auto!important;min-height:0!important;max-height:none!important;
  margin:0!important;padding:0!important;border:0!important;box-sizing:border-box!important;
  overflow:visible!important;grid-area:auto!important;align-self:auto!important;justify-self:auto!important;
  transform:none!important;translate:none!important;scale:none!important;rotate:none!important;
  background:transparent!important;box-shadow:none!important;visibility:visible!important;
  opacity:1!important;pointer-events:auto!important;animation:none!important;transition:none!important;
}
html[data-belma-ios-app] [data-belma-app-path]::before,html[data-belma-ios-app] [data-belma-app-path]::after { display:none!important; }
html[data-belma-ios-app],html[data-belma-ios-app] body[data-belma-app-path] {
  height:100%!important;min-height:100%!important;overflow:hidden!important;background:white!important;
  -webkit-text-size-adjust:100%;color-scheme:light;
}
html[data-belma-ios-app] ${BELMA_ELEMENT_TAG}[data-belma-app-path] { height:100dvh!important; }
`;

/** Shadow CSS preserves Belma's own header and document panel; only website chrome is excluded. */
const APP_SHADOW_CSS = `
:host { display:block!important;width:100%!important;min-height:0!important;margin:0!important;padding:0!important; }
#card.belma-chat { width:100%!important;max-width:none!important;height:var(--virtari-vvh,100dvh)!important;min-height:0!important;margin:0!important;border:0!important;border-radius:0!important; }
#card .bc-header { flex-shrink:0!important; }
#card .bc-brand { display:grid!important;grid-template-columns:42px minmax(0,1fr);column-gap:10px!important;row-gap:1px;align-items:center!important; }
#card .bc-brand strong { grid-column:2;font-size:21px!important;line-height:1.15; }
#card .bc-subtitle { display:block!important;font-size:10px!important; }
#card .bc-brand .bc-subtitle { grid-column:2;white-space:normal!important;line-height:1.35; }
#card .bc-app-avatar { grid-column:1;grid-row:1 / 3;width:42px;height:42px;object-fit:cover;border-radius:13px; }
#card .bc-app-emblem { width:88px;height:88px;object-fit:cover;border-radius:24px;display:block;margin:0 auto 20px; }
#card .bc-app-logo { display:block;width:104px;height:80px;object-fit:contain;margin:30px auto 0; }
#card .bc-app-credit { margin:6px 2px 2px;padding:10px;border-radius:10px;background:#141922;display:flex;align-items:center;justify-content:center; }
#card .bc-app-credit img { display:block;width:100px;height:68px;object-fit:contain; }
#card .bc-app-voice { padding:3px 9px 3px 4px!important;gap:3px!important;min-height:40px!important; }
#card .bc-app-voice > svg { display:none!important; }
#card .bc-app-voice-image { width:40px;height:34px;object-fit:contain;pointer-events:none; }
#card #input,.bc-doc-dialog textarea,.bc-doc-dialog input:not([type=file]):not([type=checkbox]) { font-size:16px!important; }
.bc-doc-dialog { max-height:calc(var(--virtari-vvh,100dvh) - 12px)!important; }
`;

export function buildAppBootstrapScript(): string {
  return String.raw`
(function(){
  if(window.top!==window || location.protocol!=='https:' || !['www.yapaymevzular.com','yapaymevzular.com'].includes(location.hostname)
    || !['/belmabelge','/belmabelge/'].includes(location.pathname)) return;
  if(window.__BELMA_IOS_BRIDGE_V1){window.__BELMA_IOS_BRIDGE_V1.refresh();return;}
  var tag=${JSON.stringify(BELMA_ELEMENT_TAG)}, css=${JSON.stringify(APP_PAGE_CSS)}, shadowCSS=${JSON.stringify(APP_SHADOW_CSS)};
  var maxBytes=${MAX_DOWNLOAD_BYTES}, mimes=${JSON.stringify(MIME_TYPES)}, branding=${JSON.stringify(branding)};
  var tracks=new Set(), contexts=new Set(), blobs=new Map(), blobBytes=0;
  var suspended=false, epoch=0, serial=0, readySent=false, downloadBusy=false, trustedGestureAt=0;
  var poll=null, appPath=[], startedAt=Date.now(), observedRoot=null, rootObserver=null;
  function host(){return document.querySelector(tag);}
  function send(value){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));}
  function stopTracks(){tracks.forEach(function(t){try{t.stop();}catch(_){}});tracks.clear();}
  function pauseMedia(root){if(root&&root.querySelectorAll)root.querySelectorAll('audio,video').forEach(function(m){try{m.pause();}catch(_){}});}
  function transition(reason){
    if(reason==='active'){suspended=false;return;}
    var element=host(), capturing=Array.from(tracks).some(function(t){return t.readyState!=='ended';});
    // The first iOS microphone permission prompt temporarily makes the app inactive.
    if(reason==='inactive'&&!capturing&&!(element&&element.phase==='connected'&&element.sessionMode==='voice'))return;
    suspended=true;++epoch;
    if(element&&typeof element.endSession==='function'){
      try{Promise.resolve(element.endSession(false)).catch(function(){});}catch(_){}
    }
    stopTracks();contexts.forEach(function(c){try{Promise.resolve(c.suspend()).catch(function(){});}catch(_){}});
    pauseMedia(document);if(element)pauseMedia(element.shadowRoot);
  }
  var devices=navigator.mediaDevices;
  if(devices&&typeof devices.getUserMedia==='function'){
    var capture=devices.getUserMedia;
    devices.getUserMedia=function(){
      if(suspended)return Promise.reject(new DOMException('Application is inactive','AbortError'));
      var requestedEpoch=epoch;
      return capture.apply(devices,arguments).then(function(stream){
        var result=stream.getTracks();
        if(suspended||requestedEpoch!==epoch){result.forEach(function(t){t.stop();});throw new DOMException('Application left foreground','AbortError');}
        result.forEach(function(t){tracks.add(t);t.addEventListener('ended',function(){tracks.delete(t);},{once:true});});return stream;
      });
    };
  }
  ['AudioContext','webkitAudioContext'].forEach(function(name){
    var Original=window[name];if(!Original||Original.__belmaPatched)return;
    var Wrapped=function(){var c=Reflect.construct(Original,Array.prototype.slice.call(arguments));contexts.add(c);
      c.addEventListener('statechange',function(){if(c.state==='closed')contexts.delete(c);});
      var resume=c.resume.bind(c);c.resume=function(){var requestedEpoch=epoch;if(suspended)return Promise.reject(new DOMException('Application is inactive','AbortError'));
        return resume().then(function(){if(suspended||requestedEpoch!==epoch)return c.suspend();});};
      if(suspended)Promise.resolve(c.suspend()).catch(function(){});return c;};
    Wrapped.prototype=Original.prototype;Object.setPrototypeOf(Wrapped,Original);Wrapped.__belmaPatched=true;window[name]=Wrapped;
  });
  function isolate(element){
    if(!element||!document.body)return false;var next=[];
    for(var n=element;n;n=n.parentElement){next.push(n);if(n===document.body)break;}
    if(next[next.length-1]!==document.body)return false;
    appPath.forEach(function(n){if(next.indexOf(n)===-1)n.removeAttribute('data-belma-app-path');});
    next.forEach(function(n){if(!n.hasAttribute('data-belma-app-path'))n.setAttribute('data-belma-app-path','');});appPath=next;return true;
  }
  // Decorate the existing assistant controls without replacing their listeners or adding a second header.
  function decorate(root,element){
    if(!root||typeof root.querySelector!=='function')return;
    var brand=root.querySelector('#card .bc-brand');if(!brand||typeof brand.querySelector!=='function')return;
    function image(className,source,alt){var node=document.createElement('img');node.className=className;node.src=source;node.alt=alt;node.decoding='async';return node;}
    if(brand&&!brand.querySelector('.bc-app-avatar'))brand.prepend(image('bc-app-avatar',branding.avatar,'Belma'));
    var empty=root.querySelector('#card .empty-state');
    if(empty&&!empty.querySelector('.bc-app-emblem')){
      var emblem=empty.querySelector('.bc-emblem');var portrait=image('bc-app-emblem',branding.avatar,'');
      if(emblem)emblem.replaceWith(portrait);else empty.prepend(portrait);
    }
    if(empty&&!empty.querySelector('.bc-app-logo'))empty.append(image('bc-app-logo',branding.logoLight,'Yapay Mevzular'));
    var menu=root.querySelector('#card .bc-menu-body');
    if(menu&&!menu.querySelector('.bc-app-credit')){var credit=document.createElement('div');credit.className='bc-app-credit';credit.append(image('',branding.logoDark,'Yapay Mevzular'));menu.append(credit);}
    var voice=element&&element.chat&&element.chat.voice;
    if(voice&&!voice.querySelector('.bc-app-voice-image')){voice.classList.add('bc-app-voice');voice.prepend(image('bc-app-voice-image',branding.voiceButton,''));}
  }
  function refresh(){
    if(!document.documentElement)return;document.documentElement.setAttribute('data-belma-ios-app','');
    var style=document.getElementById('belma-ios-app-style');
    if(!style){style=document.createElement('style');style.id='belma-ios-app-style';style.textContent=css;(document.head||document.documentElement).appendChild(style);}
    var element=host(),isolated=isolate(element),root=element&&element.shadowRoot;
    if(root&&root!==observedRoot&&typeof MutationObserver==='function'){
      if(rootObserver)rootObserver.disconnect();observedRoot=root;
      rootObserver=new MutationObserver(refresh);rootObserver.observe(root,{childList:true,subtree:true});
    }
    var local=root&&root.getElementById('belma-ios-shadow-style');
    if(root&&!local){local=document.createElement('style');local.id='belma-ios-shadow-style';local.textContent=shadowCSS;root.appendChild(local);}
    decorate(root,element);
    var controls=root&&root.querySelector('#card.belma-chat .bc-header')&&root.querySelector('#input')&&root.querySelector('#send');
    if(!readySent&&style.isConnected&&local&&local.isConnected&&isolated&&element.configured===true&&controls){
      readySent=true;send({type:'BELMA_APP_READY',version:1});if(poll)clearInterval(poll);
    }else if(Date.now()-startedAt>90000&&poll)clearInterval(poll);
  }
  function mimeFor(filename){
    if(typeof filename!=='string'||filename.length>160||filename.indexOf('..')!==-1
      ||!/^[\p{L}\p{N}][\p{L}\p{N} _().'’–—-]*\.(txt|json|pdf|docx|udf)$/u.test(filename))return null;
    return mimes[filename.slice(filename.lastIndexOf('.')+1)]||null;
  }
  function safeFilename(value){
    if(typeof value!=='string')return null;
    var match=value.match(/\.(txt|json|pdf|docx|udf)$/i);if(!match)return null;
    var stem=value.slice(0,-match[0].length).normalize('NFC').replace(/[^\p{L}\p{N} _().'’–—-]/gu,'_').replace(/\.{2,}/g,'_').slice(0,140).trim();
    if(!/^[\p{L}\p{N}]/u.test(stem))stem='Belma_'+stem;
    return stem+'.'+match[1].toLowerCase();
  }
  var createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL;
  function forget(url){var blob=blobs.get(url);if(blob){blobBytes-=blob.size;blobs.delete(url);}}
  if(createURL)URL.createObjectURL=function(blob){var url=createURL.apply(URL,arguments);
    if(blob&&blob.size>0&&blob.size<=maxBytes){while(blobs.size>=32||blobBytes+blob.size>maxBytes*2)forget(blobs.keys().next().value);
      blobs.set(url,blob);blobBytes+=blob.size;}return url;};
  if(revokeURL)URL.revokeObjectURL=function(url){forget(url);return revokeURL.apply(URL,arguments);};
  function consumeDownload(anchor){
    if(!anchor||!anchor.hasAttribute('download')||!anchor.href||anchor.href.indexOf('blob:')!==0)return false;
    var filename=safeFilename(anchor.getAttribute('download')),mime=mimeFor(filename),blob=blobs.get(anchor.href);
    // Accept only this document's captured Blob, even for detached programmatic anchors.
    if(!mime||!blob||blob.size>maxBytes){send({type:'BELMA_APP_ERROR',version:1,code:'DOWNLOAD_FAILED'});return true;}
    if(downloadBusy)return true;downloadBusy=true;
    Promise.resolve(blob.arrayBuffer()).then(function(buffer){
      if(buffer.byteLength!==blob.size||buffer.byteLength>maxBytes)throw new Error('size');
      var bytes=new Uint8Array(buffer),chunks=[];
      for(var i=0;i<bytes.length;i+=12288)chunks.push(btoa(String.fromCharCode.apply(null,bytes.subarray(i,i+12288))));
      send({type:'BELMA_APP_DOWNLOAD',version:1,id:'export_'+Date.now()+'_'+(++serial),filename:filename,mime:mime,base64:chunks.join(''),size:bytes.length});
    }).catch(function(){send({type:'BELMA_APP_ERROR',version:1,code:'DOWNLOAD_FAILED'});}).finally(function(){downloadBusy=false;});return true;
  }
  if(typeof HTMLAnchorElement!=='undefined'){
    var anchorClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(consumeDownload(this))return;return anchorClick.apply(this,arguments);};
  }
  ['pointerdown','keydown','click'].forEach(function(name){document.addEventListener(name,function(event){if(event.isTrusted)trustedGestureAt=Date.now();},true);});
  document.addEventListener('click',function(event){
    var path=event.composedPath?event.composedPath():[event.target];var anchor=path.find(function(n){return n&&n.tagName==='A';});
    if(!anchor||!anchor.href)return;
    if(anchor.hasAttribute('download')&&anchor.href.indexOf('blob:')===0){event.preventDefault();event.stopImmediatePropagation();consumeDownload(anchor);return;}
    if(!event.isTrusted&&Date.now()-trustedGestureAt>1500)return;
    var url;try{url=new URL(anchor.href,location.href);}catch(_){return;}
    if(url.protocol==='https:'&&['www.yapaymevzular.com','yapaymevzular.com'].includes(url.hostname)&&['/belmabelge','/belmabelge/'].includes(url.pathname)&&!url.port&&!url.username&&!url.password)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!['https:','tel:','mailto:'].includes(url.protocol)||url.username||url.password||url.href.length>36000)return;
    send({type:'BELMA_APP_EXTERNAL',version:1,url:url.href});
  },true);
  window.addEventListener('pagehide',function(){transition('background');});
  window.__BELMA_IOS_BRIDGE_V1={refresh:refresh,transition:transition};
  if(typeof MutationObserver==='function'&&document.documentElement)new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});
  poll=setInterval(refresh,200);refresh();
})();true;`;
}

export type AppTransition = 'active' | 'inactive' | 'background' | 'unmount';
export function buildAppTransitionScript(reason: AppTransition): string {
  return `(function(){var bridge=window.__BELMA_IOS_BRIDGE_V1;if(bridge)bridge.transition(${JSON.stringify(reason)});})();true;`;
}
