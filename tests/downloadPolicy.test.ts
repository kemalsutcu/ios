import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  DOWNLOAD_BRIDGE_SCRIPT, getExternalLink, isTrustedAgentUrl, MAX_BRIDGE_MESSAGE_LENGTH,
  MAX_DOWNLOAD_BYTES, validateDownloadMessage, validateFilename,
} from '../src/lib/downloadPolicy';

const ORIGIN = 'https://www.yapaymevzular.com/belma';
const envelope = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  type: 'YM_FILE_DOWNLOAD', version: 1, id: 'export_1', filename: 'Suç duyurusu.udf',
  mimeType: 'application/octet-stream', size: 4, base64: 'UEsDBA==', ...overrides,
});

test('exact HTTPS origins reject deceptive hostnames, credentials, ports and hidden controls', () => {
  assert.equal(isTrustedAgentUrl(ORIGIN), true);
  assert.equal(isTrustedAgentUrl('https://yapaymevzular.com:443/demo'), true);
  for (const url of [
    'http://www.yapaymevzular.com', 'https://www.yapaymevzular.com.evil.test',
    'https://evil.test/?https://www.yapaymevzular.com', 'https://name@www.yapaymevzular.com',
    'https://www.yapaymevzular.com:8443', 'https://www.yapaymevzular.com./',
    ' https://www.yapaymevzular.com', 'https://www.yapaymevzular.com\n',
    'https://www.yapaymevzular.com\\@evil.test', 'javascript:alert(1)',
  ]) assert.equal(isTrustedAgentUrl(url), false, url);
});

test('external handoff permits only intended protocols', () => {
  assert.equal(getExternalLink('https://example.com/download?token=hidden')?.label, 'example.com');
  assert.equal(getExternalLink('mailto:kemal@yapaymevzular.com')?.label, 'E-posta uygulaması');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'blob:https://www.yapaymevzular.com/123', 'intent://app', 'http://example.com']) {
    assert.equal(getExternalLink(url), null);
  }
});

test('filenames reject paths, active extensions, bidi controls and device names', () => {
  assert.equal(validateFilename('Beyan_Kemal (2).udf'), 'Beyan_Kemal (2).udf');
  assert.equal(validateFilename('Görüşme özeti.PDF'), 'Görüşme özeti.PDF');
  for (const name of ['../secret.udf', 'a/b.pdf', 'a\\b.pdf', '.hidden.pdf', 'report.exe', 'report.html', 'report.udf.js', 'a..pdf', 'CON.txt', 'a\u202etxt.pdf', 'a\n.pdf', 'report.pdf ']) {
    assert.equal(validateFilename(name), null, name);
  }
});

test('envelope verifies origin, schema, extension, MIME, decoded size and canonical base64', () => {
  assert.equal(validateDownloadMessage(envelope(), ORIGIN).ok, true);
  // This is the exact MIME emitted by the existing BELMA UDF helper.
  assert.equal(validateDownloadMessage(envelope({ mimeType: 'application/vnd.uyap.udf' }), ORIGIN).ok, true);
  assert.equal(validateDownloadMessage(envelope(), 'https://evil.test').ok, false);
  for (const overrides of [
    { version: 2 }, { id: '../export' }, { extra: true }, { size: 0 }, { size: 4.5 },
    { size: MAX_DOWNLOAD_BYTES + 1 }, { size: 5 }, { mimeType: 'text/html' },
    { filename: 'report.pdf' }, { base64: 'UEsD BA==' }, { base64: 'UEsDBB==' },
    { base64: 'AAAAAA==' }, { filename: 'a.pdf', mimeType: 'application/pdf', base64: 'AAAAAA==' },
  ]) assert.equal(validateDownloadMessage(envelope(overrides), ORIGIN).ok, false, JSON.stringify(overrides));
  assert.equal(validateDownloadMessage('null', ORIGIN).ok, false);
  assert.equal(validateDownloadMessage('{', ORIGIN).ok, false);
  assert.equal(validateDownloadMessage('x'.repeat(MAX_BRIDGE_MESSAGE_LENGTH + 1), ORIGIN).ok, false);
});

test('20 MiB limit checks decoded bytes rather than trusting a claimed size', () => {
  const bytes = Buffer.alloc(MAX_DOWNLOAD_BYTES, 65);
  const message = envelope({ filename: 'large.txt', mimeType: 'text/plain', size: bytes.length, base64: bytes.toString('base64') });
  assert.equal(validateDownloadMessage(message, ORIGIN).ok, true);
  assert.equal(validateDownloadMessage(envelope({ filename: 'small.txt', mimeType: 'text/plain', size: 1, base64: bytes.toString('base64') }), ORIGIN).ok, false);
});

test('bridge installs only in trusted main frame and forwards a detached UDF anchor', async () => {
  const messages: string[] = [];
  let normalClicks = 0;
  let fetchStarted = false;
  let listener: ((event: unknown) => void) | undefined;
  class Anchor {
    tagName = 'A';
    href = 'blob:https://www.yapaymevzular.com/file';
    name = 'taslak.udf';
    click() { normalClicks += 1; }
    hasAttribute(key: string) { return key === 'download'; }
    getAttribute() { return this.name; }
  }
  class Reader {
    result = 'data:application/vnd.uyap.udf;base64,UEsDBA==';
    onload?: () => void;
    readAsDataURL() { this.onload?.(); }
  }
  const window: Record<string, unknown> = { ReactNativeWebView: { postMessage: (value: string) => messages.push(value) } };
  window.top = window;
  const context = {
    window, location: { origin: 'https://www.yapaymevzular.com' }, HTMLAnchorElement: Anchor,
    document: { addEventListener: (_name: string, fn: (event: unknown) => void) => { listener = fn; } },
    URL, AbortController, setTimeout, clearTimeout, FileReader: Reader,
    fetch: async () => {
      fetchStarted = true;
      return { blob: async () => ({ size: 4, type: 'application/vnd.uyap.udf' }) };
    },
  };
  runInNewContext(DOWNLOAD_BRIDGE_SCRIPT, context);
  new Anchor().click();
  // a.click(); URL.revokeObjectURL(url) must not revoke before the fetch begins.
  assert.equal(fetchStarted, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(normalClicks, 0);
  assert.equal(messages.length, 1);
  assert.equal(validateDownloadMessage(messages[0], ORIGIN).ok, true);
  assert.equal(typeof listener, 'function');
  const normal = new Anchor(); normal.href = 'https://www.yapaymevzular.com/'; normal.click();
  assert.equal(normalClicks, 1);
  let prevented = false;
  listener!({ composedPath: () => [{ tagName: 'SPAN' }, new Anchor()],
    preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(prevented, true);
  assert.equal(messages.length, 2);
  const foreignBlob = new Anchor(); foreignBlob.href = 'blob:https://evil.test/file';
  fetchStarted = false;
  foreignBlob.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchStarted, false);
  assert.equal(messages[2], '{"type":"YM_DOWNLOAD_ERROR","version":1}');
  const foreign: Record<string, unknown> = {}; foreign.top = foreign;
  runInNewContext(DOWNLOAD_BRIDGE_SCRIPT, { window: foreign, location: { origin: 'https://evil.test' } });
  assert.equal(foreign.__ymDownloadBridgeV1, undefined);
  const iframe: Record<string, unknown> = { top: {} };
  runInNewContext(DOWNLOAD_BRIDGE_SCRIPT, { window: iframe });
  assert.equal(iframe.__ymDownloadBridgeV1, undefined);
});

test('bridge rejects oversized blobs before reading or forwarding their contents', async () => {
  const messages: string[] = [];
  let readerConstructed = false;
  class Anchor {
    tagName = 'A'; href = 'blob:https://www.yapaymevzular.com/large';
    click() {}
    hasAttribute() { return true; }
    getAttribute() { return 'large.udf'; }
  }
  class Reader { constructor() { readerConstructed = true; } }
  const window: Record<string, unknown> = { ReactNativeWebView: { postMessage: (value: string) => messages.push(value) } };
  window.top = window;
  runInNewContext(DOWNLOAD_BRIDGE_SCRIPT, {
    window, location: { origin: 'https://www.yapaymevzular.com' }, HTMLAnchorElement: Anchor,
    document: { addEventListener() {} }, URL, AbortController, setTimeout, clearTimeout, FileReader: Reader,
    fetch: async () => ({ blob: async () => ({ size: MAX_DOWNLOAD_BYTES + 1, type: 'application/vnd.uyap.udf' }) }),
  });
  new Anchor().click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(readerConstructed, false);
  assert.deepEqual(messages, ['{"type":"YM_DOWNLOAD_ERROR","version":1}']);
});
