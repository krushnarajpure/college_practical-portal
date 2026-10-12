import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeAcademicOptions } from './academicYear.js';

test('deduplicates repeated academic options from the registration form', () => {
  const options = [
    { _id: '1', name: 'Computer Science', programId: 'p1' },
    { _id: '1', name: 'Computer Science', programId: 'p1' },
    { _id: '2', name: 'Mechanical', programId: 'p1' },
    { _id: '2', name: 'Mechanical', programId: 'p1' },
    { _id: '3', name: 'Semester 1', yearId: 'y1', number: 1 },
    { _id: '3', name: 'Semester 1', yearId: 'y1', number: 1 },
    { _id: '4', name: 'Semester 2', yearId: 'y1', number: 2 }
  ];

  const result = dedupeAcademicOptions(options);

  assert.deepEqual(result, [
    { _id: '1', name: 'Computer Science', programId: 'p1' },
    { _id: '2', name: 'Mechanical', programId: 'p1' },
    { _id: '3', name: 'Semester 1', yearId: 'y1', number: 1 },
    { _id: '4', name: 'Semester 2', yearId: 'y1', number: 2 }
  ]);
});
