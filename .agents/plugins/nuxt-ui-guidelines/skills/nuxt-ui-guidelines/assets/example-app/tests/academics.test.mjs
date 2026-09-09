import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestBlocker, publicationBlocker } from '../app/utils/academicRules.ts';
const section = { instructor: 'Teacher', room: 'Room 1', studentIds: ['s1'], capacity: 2 };
const course = { status: 'Active', studentIds: ['s1'] };
const request = { studentId: 's2', prerequisiteMet: true };
test('request eligibility tracks prerequisite, capacity and existing enrollment', () => {
  assert.equal(requestBlocker(request, section, course), undefined);
  assert.equal(requestBlocker({ ...request, prerequisiteMet: false }, section, course), 'Prerequisite required');
  assert.equal(requestBlocker(request, { ...section, capacity: 1 }, course), 'Section full');
  assert.equal(requestBlocker(request, section, { ...course, studentIds: ['s1','s2'] }), 'Already enrolled');
  assert.equal(requestBlocker(request, section, { ...course, status: 'Archived' }), 'Course archived');
  assert.equal(requestBlocker(request, undefined, course), 'Course unavailable');
});
test('publication requires staffing, room and sufficient capacity', () => {
  assert.equal(publicationBlocker(section, 1), undefined);
  assert.equal(publicationBlocker({ ...section, instructor: '' }, 1), 'Instructor required');
  assert.equal(publicationBlocker({ ...section, room: '' }, 1), 'Room required');
  assert.equal(publicationBlocker(section, 3), 'Over capacity');
});
