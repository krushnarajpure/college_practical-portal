import Year from '../models/Year.js';
import Semester from '../models/Semester.js';

const ordinal = (number) => number === 1 ? '1st' : number === 2 ? '2nd' : number === 3 ? '3rd' : `${number}th`;

export async function ensureProgramAcademicStructure(program) {
  if (!program.durationYears || !program.semestersPerYear) return;

  for (let yearNumber = 1; yearNumber <= program.durationYears; yearNumber += 1) {
    const year = await Year.findOneAndUpdate(
      { programId: program._id, academicLevel: yearNumber },
      {
        $set: { name: `${ordinal(yearNumber)} Year`, order: yearNumber, academicLevel: yearNumber },
        $setOnInsert: { programId: program._id, status: 'active', isActive: true }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const firstSemester = (yearNumber - 1) * program.semestersPerYear + 1;
    for (let offset = 0; offset < program.semestersPerYear; offset += 1) {
      const number = firstSemester + offset;
      await Semester.findOneAndUpdate(
        { yearId: year._id, number },
        {
          $set: { name: `${ordinal(number)} Semester`, number, yearId: year._id },
          $setOnInsert: { status: 'active', isActive: true }
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
  }
}
