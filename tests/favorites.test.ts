import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFavoriteIds } from '../src/lib/favoriteIds';

test('persisted favorites cannot introduce unknown agents or duplicate IDs', () => {
  assert.deepEqual(parseFavoriteIds('["belma","bad",12,"belma","aylin"]', ['belma', 'aylin']), ['belma', 'aylin']);
});
test('corrupt or legacy saved state does not block the app', () => {
  for (const value of [null, '', '{bad}', '{}', 'true']) assert.deepEqual(parseFavoriteIds(value, ['belma']), []);
});
