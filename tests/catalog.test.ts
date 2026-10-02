import assert from 'node:assert/strict';
import test from 'node:test';
import { agents, filterAgents } from '../src/data/agents';
import { isTrustedAgentUrl } from '../src/lib/downloadPolicy';

test('Turkish case folding keeps Aylin and Şahika discoverable', () => {
  assert.equal(filterAgents('AYLİN', 'Tümü')[0]?.id, 'aylin');
  assert.equal(filterAgents('şahika', 'Tümü')[0]?.id, 'sahika');
  assert.equal(filterAgents('  belma ', 'Hukuk')[0]?.id, 'belma');
  assert.equal(filterAgents('belma', 'Astroloji').length, 0);
});
test('every public catalog destination is allowed and uniquely addressable', () => {
  assert.equal(new Set(agents.map((agent) => agent.id)).size, agents.length);
  for (const agent of agents) assert.ok(isTrustedAgentUrl(agent.url), agent.id);
});
