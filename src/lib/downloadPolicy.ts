/** The bridge accepts documents only from our two exact HTTPS origins. */
export const TRUSTED_AGENT_ORIGINS = [
  'https://yapaymevzular.com',
  'https://www.yapaymevzular.com',
] as const;

export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_BASE64_LENGTH = Math.ceil(MAX_DOWNLOAD_BYTES / 3) * 4;
export const MAX_BRIDGE_MESSAGE_LENGTH = MAX_BASE64_LENGTH + 2048;
export const DOWNLOAD_MESSAGE_TYPE = 'YM_FILE_DOWNLOAD';

const FILE_TYPES: Record<string, readonly string[]> = {
  udf: ['application/vnd.uyap.udf', 'application/octet-stream', 'application/udf', 'application/x-udf', 'application/zip'],
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain'],
  csv: ['text/csv', 'text/plain'],
  json: ['application/json', 'text/plain'],
};

function parseUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || !value || value.length > 8192 || value !== value.trim()) return null;
  if (/[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isTrustedAgentUrl(value: unknown): boolean {
  const parsed = parseUrl(value);
  return !!parsed && TRUSTED_AGENT_ORIGINS.some((origin) => parsed.origin === origin);
}

/** No javascript:, data:, file:, intent: or arbitrary app-scheme handoff. */
export function getExternalLink(value: unknown): { url: string; label: string } | null {
  const parsed = parseUrl(value);
  if (!parsed) return null;
  if (parsed.protocol === 'https:' && !parsed.port) {
    return { url: parsed.href, label: parsed.hostname };
  }
  if ((parsed.protocol === 'tel:' || parsed.protocol === 'mailto:') && parsed.pathname && parsed.href.length <= 2048) {
    return { url: parsed.href, label: parsed.protocol === 'tel:' ? 'Telefon uygulaması' : 'E-posta uygulaması' };
  }
  return null;
}

export function isAllowedSubframeUrl(value: string): boolean {
  if (value === 'about:blank') return true;
  const parsed = parseUrl(value);
  return !!parsed && parsed.protocol === 'https:';
}

export function validateFilename(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 3 || value.length > 140 || value !== value.trim()) return null;
  // Reject paths, controls, bidi overrides, hidden files and active file formats.
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()\-]*\.[a-zA-Z0-9]{2,8}$/u.test(value)) return null;
  if (value.includes('..') || /[. ]$/u.test(value)) return null;
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(value)) return null;
  const extension = value.slice(value.lastIndexOf('.') + 1).toLowerCase();
  return FILE_TYPES[extension] ? value.normalize('NFC') : null;
}

export function mimeForFilename(filename: string): string | null {
  const name = validateFilename(filename);
  return name ? FILE_TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()][0] : null;
}

export interface DownloadEnvelope {
  type: typeof DOWNLOAD_MESSAGE_TYPE;
  version: 1;
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  base64: string;
}

export type DownloadValidation =
  | { ok: true; value: DownloadEnvelope }
  | { ok: false; reason: 'origin' | 'length' | 'json' | 'shape' | 'filename' | 'mime' | 'size' | 'base64' | 'signature' };

function base64ByteLength(value: string): number | null {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // Reject non-canonical encodings; padding bits must be zero.
  const last = alphabet.indexOf(value[value.length - padding - 1]);
  if ((padding === 2 && (last & 15) !== 0) || (padding === 1 && (last & 3) !== 0)) return null;
  return (value.length / 4) * 3 - padding;
}

export function validateDownloadMessage(raw: unknown, eventUrl: unknown): DownloadValidation {
  if (!isTrustedAgentUrl(eventUrl)) return { ok: false, reason: 'origin' };
  if (typeof raw !== 'string' || raw.length > MAX_BRIDGE_MESSAGE_LENGTH) return { ok: false, reason: 'length' };
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'json' };
  }
  const keys = ['type', 'version', 'id', 'filename', 'mimeType', 'size', 'base64'];
  if (!input || Array.isArray(input) || typeof input !== 'object'
    || Object.keys(input).length !== keys.length || !Object.keys(input).every((key) => keys.includes(key))
    || input.type !== DOWNLOAD_MESSAGE_TYPE || input.version !== 1
    || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/u.test(input.id)) {
    return { ok: false, reason: 'shape' };
  }
  const filename = validateFilename(input.filename);
  if (!filename) return { ok: false, reason: 'filename' };
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  if (typeof input.mimeType !== 'string' || !FILE_TYPES[extension].includes(input.mimeType)) {
    return { ok: false, reason: 'mime' };
  }
  if (typeof input.size !== 'number' || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_DOWNLOAD_BYTES) {
    return { ok: false, reason: 'size' };
  }
  if (typeof input.base64 !== 'string' || input.base64.length > MAX_BASE64_LENGTH
    || base64ByteLength(input.base64) !== input.size) return { ok: false, reason: 'base64' };
  // UYAP UDF and DOCX are ZIP containers. This is a format sanity check, not malware scanning.
  if ((extension === 'udf' || extension === 'docx') && !input.base64.startsWith('UEsDB')) {
    return { ok: false, reason: 'signature' };
  }
  if (extension === 'pdf' && !input.base64.startsWith('JVBERi0')) return { ok: false, reason: 'signature' };
  return {
    ok: true,
    value: { type: DOWNLOAD_MESSAGE_TYPE, version: 1, id: input.id, filename,
      mimeType: mimeForFilename(filename)!, size: input.size, base64: input.base64 },
  };
}

/** Runs only in the main trusted document. Handles detached a.click() and shadow-DOM links. */
export const DOWNLOAD_BRIDGE_SCRIPT = String.raw`
(function () {
  if (window.top !== window || window.__ymDownloadBridgeV1) return;
  if (!${JSON.stringify(TRUSTED_AGENT_ORIGINS)}.includes(location.origin)) return;
  window.__ymDownloadBridgeV1 = true;
  var maxBytes = ${MAX_DOWNLOAD_BYTES};
  var types = ${JSON.stringify(FILE_TYPES)};
  var active = false;
  var serial = 0;
  function sendError() {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'YM_DOWNLOAD_ERROR',version:1}));
  }
  function isDownload(anchor) {
    return anchor && anchor.tagName === 'A' && anchor.hasAttribute('download') && /^(blob:|data:)/.test(anchor.href);
  }
  function transfer(anchor) {
    if (active) return;
    active = true;
    var filename = anchor.getAttribute('download') || '';
    var extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
    var href = anchor.href;
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); },15000);
    // Begin fetching synchronously: some generators revoke the blob URL immediately after a.click().
    (async function(){
      if (!window.ReactNativeWebView || !types[extension] || filename.length > 140) throw new Error();
      if (href.startsWith('blob:') && new URL(href).origin !== location.origin) throw new Error();
      if (href.startsWith('data:') && (href.length > ${MAX_BASE64_LENGTH + 256} || !/^data:[^,]*;base64,/.test(href))) throw new Error();
      var response = await fetch(href,{signal:controller.signal});
      var blob = await response.blob();
      if (!blob.size || blob.size > maxBytes) throw new Error();
      var mime = (blob.type || types[extension][0]).split(';')[0].toLowerCase();
      if (!types[extension].includes(mime)) throw new Error();
      var base64 = await new Promise(function(resolve,reject){
        var reader = new FileReader();
        reader.onload = function(){resolve(String(reader.result).split(',')[1]);};
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'${DOWNLOAD_MESSAGE_TYPE}',version:1,id:'export_'+Date.now()+'_'+(++serial),
        filename:filename,mimeType:mime,size:blob.size,base64:base64
      }));
    })().catch(sendError).finally(function(){clearTimeout(timer);active=false;});
  }
  var nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    if(isDownload(this)){transfer(this);return;}
    return nativeClick.apply(this,arguments);
  };
  document.addEventListener('click',function(event){
    var path = event.composedPath ? event.composedPath() : [event.target];
    var anchor = path.find(function(node){return node && node.tagName === 'A';});
    if(!anchor && event.target && event.target.closest) anchor=event.target.closest('a');
    if(isDownload(anchor)){
      event.preventDefault(); event.stopImmediatePropagation(); transfer(anchor);
    }
  },true);
})(); true;
`;
