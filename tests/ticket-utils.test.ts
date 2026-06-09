import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUpdateVerification,
  descriptionShrinkWarning,
  normalizeTicketId,
} from '../src/ticket-utils.ts';

test('normalizeTicketId accepts echo-N case-insensitively', () => {
  assert.equal(normalizeTicketId('ECHO-4'), 'echo-4');
  assert.equal(normalizeTicketId(' echo-12 '), 'echo-12');
});

test('normalizeTicketId rejects invalid formats', () => {
  assert.throws(() => normalizeTicketId('4'), /Invalid ticket id/);
  assert.throws(() => normalizeTicketId('ECHO-'), /Invalid ticket id/);
});

test('descriptionShrinkWarning triggers on substantial shrink', () => {
  const warning = descriptionShrinkWarning(1000, 200);
  assert.match(warning ?? '', /1000 to 200/);
});

test('descriptionShrinkWarning ignores small prior descriptions', () => {
  assert.equal(descriptionShrinkWarning(50, 10), undefined);
});

test('descriptionShrinkWarning ignores modest shrink', () => {
  assert.equal(descriptionShrinkWarning(1000, 600), undefined);
});

test('buildUpdateVerification includes shrink warning when description was shortened', () => {
  const verification = buildUpdateVerification(
    {
      id: 42,
      title: 'Example',
      description: 'short',
      updated: '2026-06-10T12:00:00Z',
    } as Parameters<typeof buildUpdateVerification>[0],
    1000,
  );

  assert.equal(verification.id, 42);
  assert.equal(verification.title, 'Example');
  assert.equal(verification.description_length, 5);
  assert.equal(verification.updated_at, '2026-06-10T12:00:00Z');
  assert.equal(verification.previous_description_length, 1000);
  assert.match(verification.warning ?? '', /Verify the update was intentional/);
});

test('buildUpdateVerification omits warning when description unchanged in length', () => {
  const verification = buildUpdateVerification(
    {
      id: 42,
      title: 'Example',
      description: 'x'.repeat(900),
      updated: '2026-06-10T12:00:00Z',
    } as Parameters<typeof buildUpdateVerification>[0],
    1000,
  );

  assert.equal(verification.warning, undefined);
});
