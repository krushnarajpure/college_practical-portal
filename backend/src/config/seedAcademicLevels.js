import Year from '../models/Year.js';
import Semester from '../models/Semester.js';

const academicYears = [
  { level: 1, name: '1st Year', code: 'YEAR-1', order: 1, semesters: [1, 2] },
  { level: 2, name: '2nd Year', code: 'YEAR-2', order: 2, semesters: [3, 4] },
  { level: 3, name: '3rd Year', code: 'YEAR-3', order: 3, semesters: [5, 6] },
  { level: 4, name: '4th Year', code: 'YEAR-4', order: 4, semesters: [7, 8] }
];

export async function seedAcademicLevels() {
  for (const academicYear of academicYears) {
    const year = await Year.findOneAndUpdate(
      { academicLevel: academicYear.level },
      {
        $set: {
          name: academicYear.name,
          code: academicYear.code,
          order: academicYear.order,
          academicLevel: academicYear.level
        },
        $setOnInsert: {
          status: 'active',
          isActive: true
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    for (const number of academicYear.semesters) {
      const ordinal = number === 1 ? '1st' : number === 2 ? '2nd' : number === 3 ? '3rd' : `${number}th`;
      await Semester.findOneAndUpdate(
        { yearId: year._id, number },
        {
          $set: { name: `${ordinal} Semester`, code: `${academicYear.code}-SEM-${number}` },
          $setOnInsert: { yearId: year._id, number, status: 'active', isActive: true }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }
  }

}