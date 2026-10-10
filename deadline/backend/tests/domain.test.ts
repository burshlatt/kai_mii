import assert from 'node:assert/strict';
import test from 'node:test';
import { assignmentSchema, parseAssignmentQuery } from '../src/domain';
import { tokensMatch } from '../src/auth';

test('assignment schema rejects an empty title', () => {
  const parsed = assignmentSchema.safeParse({
    title: '   ',
    course: 'История',
    dueAt: '2026-10-12T09:00:00.000Z',
    status: 'todo',
    priority: 'high',
  });
  assert.equal(parsed.success, false);
});

test('assignment schema accepts a trimmed payload', () => {
  const parsed = assignmentSchema.safeParse({
    title: '  Эссе  ',
    course: ' История ',
    description: '',
    dueAt: '2026-10-12T09:00:00.000Z',
    status: 'in_progress',
    priority: 'low',
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.title, 'Эссе');
    assert.equal(parsed.data.course, 'История');
  }
});

test('query parser reads overdue flag and ignores unknown status', () => {
  const query = parseAssignmentQuery({ status: 'later', course: ' История ', overdue: '1' });
  assert.equal(query.status, undefined);
  assert.equal(query.course, 'История');
  assert.equal(query.onlyOverdue, true);
});

test('csrf tokens match only equal strings', () => {
  assert.equal(tokensMatch('abc', 'abc'), true);
  assert.equal(tokensMatch('abc', 'abd'), false);
  assert.equal(tokensMatch('abc', 'abcd'), false);
});
