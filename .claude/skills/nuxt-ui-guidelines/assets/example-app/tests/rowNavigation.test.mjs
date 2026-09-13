import test from 'node:test';
import assert from 'node:assert/strict';
import { canNavigateRow } from '../app/components/kit/rowNavigation.ts';

const event = (interactive = false) => ({ target: { closest: () => interactive ? {} : null }, button: 0 });
test('row navigation only accepts plain noninteractive activation', () => {
  assert.equal(canNavigateRow(event()), true);
  assert.equal(canNavigateRow(event(true)), false);
  assert.equal(canNavigateRow(event(), 'selected text'), false);
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) assert.equal(canNavigateRow({ ...event(), [modifier]: true }), false);
  assert.equal(canNavigateRow({ ...event(), button: 2 }), false);
});
