import assert from 'node:assert/strict';
import test from 'node:test';
import { WebRTCConnection } from '../node_modules/@elevenlabs/client/dist/utils/WebRTCConnection.js';

function connection(initialMicMuted: boolean) {
  const events: string[] = [];
  const track = {
    muted: false,
    async mute() { this.muted = true; events.push('mute'); },
    stop() { events.push('stop'); },
  };
  const room = {
    on() { return room; },
    localParticipant: {
      async setMicrophoneEnabled(enabled: boolean) { events.push(`enable:${enabled}`); },
      async publishTrack(published: typeof track) {
        assert.equal(published.muted, true, 'No live audio source may be published before the mute completes.');
        events.push('publish');
      },
    },
  };
  const format = { format: 'pcm', sampleRate: 48000 };
  // Exercise the shipped class, replacing only physical capture and the network participant.
  const value = Reflect.construct(WebRTCConnection, [room, 'conv_test', format, format, { initialMicMuted }]) as WebRTCConnection;
  Reflect.set(value, 'createMicrophoneTrack', async () => { events.push('capture'); return track; });
  return { value, events, room, track, enable: (deviceId?: string) => Reflect.apply(Reflect.get(WebRTCConnection.prototype, 'enableMicrophone'), value, [deviceId]) as Promise<void> };
}

test('the default microphone is muted before its first publication', async () => {
  const state = connection(true);
  assert.equal(state.value.input.isMuted(), true);
  await state.enable();
  assert.deepEqual(state.events, ['capture', 'mute', 'publish']);
});

test('an explicitly selected microphone also starts muted before publication', async () => {
  const state = connection(true);
  await state.enable('chosen-microphone');
  assert.deepEqual(state.events, ['capture', 'mute', 'publish']);
});

test('failed initial publication releases the unpublished captured microphone', async () => {
  const state = connection(true);
  state.room.localParticipant.publishTrack = async () => { throw new Error('Network publication failed'); };
  await assert.rejects(state.enable(), /publication failed/);
  assert.deepEqual(state.events, ['capture', 'mute', 'stop']);
});

test('consumers without the opt-in retain the upstream microphone behavior', async () => {
  const state = connection(false);
  assert.equal(state.value.input.isMuted(), false);
  await state.enable();
  assert.deepEqual(state.events, ['enable:true']);
});
