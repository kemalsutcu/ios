import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicTextUrl, getSessionOptions, type SessionSettings } from '../src/features/sahika/services/session';

const publicSettings: SessionSettings = { agentId: 'agent_exact', branchId: 'branch_exact', sessionEndpoint: '' };

function fakeFetch(implementation: (url: string, init: RequestInit) => Promise<Response>): typeof fetch {
  return ((url, init) => implementation(String(url), init ?? {})) as typeof fetch;
}

test('public text preserves the selected agent and branch without a fetch or microphone request', async () => {
  let fetched = false;
  const options = await getSessionOptions('text', undefined, publicSettings, fakeFetch(async () => {
    fetched = true;
    throw new Error('Public text should not request a credential.');
  }));
  assert.equal(fetched, false);
  assert.equal(options.textOnly, true);
  assert.equal(options.connectionType, 'websocket');
  assert.ok('signedUrl' in options);
  const url = new URL(options.signedUrl);
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.searchParams.get('agent_id'), publicSettings.agentId);
  assert.equal(url.searchParams.get('branch_id'), publicSettings.branchId);
  assert.equal(url.searchParams.has('xi-api-key'), false);
  assert.equal(new URL(buildPublicTextUrl('agent/? special', '')).searchParams.get('agent_id'), 'agent/? special');
});

test('public voice fetches the exact branch token and never sends an API key', async () => {
  const options = await getSessionOptions('voice', undefined, publicSettings, fakeFetch(async (address, init) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://api.elevenlabs.io');
    assert.equal(url.pathname, '/v1/convai/conversation/token');
    assert.equal(url.searchParams.get('agent_id'), 'agent_exact');
    assert.equal(url.searchParams.get('branch_id'), 'branch_exact');
    assert.equal(init.method, 'GET');
    assert.equal(new Headers(init.headers).has('xi-api-key'), false);
    return Response.json({ token: 'short-lived-session-token', conversation_id: 'conv_test' });
  }));
  assert.deepEqual(options, { conversationToken: 'short-lived-session-token', connectionType: 'webrtc', textOnly: false });
});

test('private session endpoint receives mode and public identifiers and validates its response', async () => {
  const settings = { ...publicSettings, sessionEndpoint: 'https://sessions.example.test/elevenlabs' };
  const options = await getSessionOptions('text', undefined, settings, fakeFetch(async (address, init) => {
    assert.equal(address, settings.sessionEndpoint);
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(String(init.body)), { mode: 'text', agentId: 'agent_exact', branchId: 'branch_exact' });
    return Response.json({ signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?authorization=session' });
  }));
  assert.equal(options.connectionType, 'websocket');
  await assert.rejects(getSessionOptions('voice', undefined, settings, fakeFetch(async () => Response.json({ signed_url: 'wss://not-a-voice-token' }))), /Sesli görüşme bağlantısı alınamadı/);
  await assert.rejects(getSessionOptions('text', undefined, settings, fakeFetch(async () => Response.json({ signed_url: 'ws://insecure.example.test' }))), /Yazılı sohbet bağlantısı alınamadı/);
});

test('insecure session endpoints are rejected before sending anything', async () => {
  let fetched = false;
  await assert.rejects(getSessionOptions('voice', undefined, { ...publicSettings, sessionEndpoint: 'http://sessions.example.test' }, fakeFetch(async () => {
    fetched = true;
    return Response.json({ token: 'unused' });
  })), /HTTPS/);
  assert.equal(fetched, false);
});

test('cancellation aborts a pending credential request and a pre-cancelled text connection', async () => {
  const controller = new AbortController();
  const promise = getSessionOptions('voice', controller.signal, publicSettings, fakeFetch((_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })));
  controller.abort();
  await assert.rejects(promise, /iptal edildi/);
  await assert.rejects(getSessionOptions('text', controller.signal, publicSettings), /iptal edildi/);
});

test('authorization errors are actionable and do not reflect server secrets into the UI', async () => {
  await assert.rejects(getSessionOptions('voice', undefined, publicSettings, fakeFetch(async () => new Response('do-not-display-this-server-secret', { status: 401 }))), error => {
    assert.match(String(error), /yetkilendirme/);
    assert.doesNotMatch(String(error), /do-not-display/);
    return true;
  });
});
