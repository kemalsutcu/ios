import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WebSocketConnection } from '@elevenlabs/client';

class TestSocket extends EventTarget {
  static instances: TestSocket[] = [];
  readyState = 0;
  closeCalls = 0;
  sent: string[] = [];

  constructor(_url: string, _protocols?: string | string[]) {
    super();
    TestSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  metadata() {
    this.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type: 'conversation_initiation_metadata',
        conversation_initiation_metadata_event: {
          conversation_id: 'conv_transport_test',
          agent_output_audio_format: 'pcm_16000',
          user_input_audio_format: 'pcm_16000',
        },
      }),
    }));
  }

  send(data: string) { this.sent.push(data); }

  close(code = 1000, reason = '') {
    ++this.closeCalls;
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event('close'), { code, reason }));
  }
}

function mockSocket(t: TestContext) {
  const original = globalThis.WebSocket;
  TestSocket.instances = [];
  globalThis.WebSocket = TestSocket as unknown as typeof WebSocket;
  t.after(() => { globalThis.WebSocket = original; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
}

test('a stalled text handshake closes the real socket and allows a fresh connection', async t => {
  mockSocket(t);
  const pending = WebSocketConnection.create({ agentId: 'agent_transport_test', textOnly: true });
  const failed = assert.rejects(pending, /WebSocket conversation setup timed out/);
  const stalled = TestSocket.instances[0];
  stalled.open();
  assert.equal(stalled.sent.length, 1);
  t.mock.timers.tick(25_000);
  await failed;
  assert.equal(stalled.closeCalls, 1);
  assert.equal(stalled.readyState, 3);

  const retry = WebSocketConnection.create({ agentId: 'agent_transport_test', textOnly: true });
  const replacement = TestSocket.instances[1];
  replacement.open();
  replacement.metadata();
  const connection = await retry;
  assert.equal(connection.conversationId, 'conv_transport_test');
  connection.close();
});

test('successful text setup clears its deadline and keeps the connected socket open', async t => {
  mockSocket(t);
  const pending = WebSocketConnection.create({ agentId: 'agent_transport_test', textOnly: true });
  const socket = TestSocket.instances[0];
  socket.open();
  socket.metadata();
  const connection = await pending;
  t.mock.timers.tick(60_000);
  assert.equal(socket.closeCalls, 0);
  assert.equal(socket.readyState, 1);
  connection.close();
});

test('socket failure rejects immediately and clears the handshake deadline', async t => {
  mockSocket(t);
  const pending = WebSocketConnection.create({ agentId: 'agent_transport_test', textOnly: true });
  const failed = assert.rejects(pending, /Connection closed unexpectedly/);
  const socket = TestSocket.instances[0];
  socket.close(1006);
  await failed;
  const closesAfterFailure = socket.closeCalls;
  t.mock.timers.tick(60_000);
  assert.equal(socket.closeCalls, closesAfterFailure);
});
