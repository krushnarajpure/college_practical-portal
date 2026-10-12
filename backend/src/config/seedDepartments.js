import Department from '../models/Department.js';
import Program from '../models/Program.js';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Practical from '../models/Practical.js';
import AcademicDocument from '../models/AcademicDocument.js';
import Submission from '../models/Submission.js';
import Evaluation from '../models/Evaluation.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { ensureProgramAcademicStructure } from '../services/programAcademicStructure.js';

const officialWebsite = 'https://tgpcet.edu.in/';
const normalized = (value) => String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const academicStructureSource = 'Initial portal configuration; pending verification against current academic regulations';
const departmentReferences = [User, Subject, Practical, AcademicDocument, Submission, Evaluation];
const academicReferences = [User, Subject, Practical, AcademicDocument, Submission, Evaluation];
const programs = [
  {
    name: 'B.Tech',
    level: 'undergraduate',
    aliases: ['BTech', 'B Tech', 'Bachelor of Technology'],
    durationYears: 4,
    semestersPerYear: 2,
    branches: [
      ['Aeronautical Engineering', 'Aeronautical-Engineering.php', ['AE']],
      ['Biotechnology', 'Biotechnology.php', ['BT']],
      ['Civil Engineering', 'Civil-dept.php', ['CE']],
      ['Computer Science & Engineering', 'CSE-dept.php', ['Computer Science and Engineering', 'Computer Science and Engineering (CSE)', 'CSE']],
      ['CSE - Data Science', 'DATA-SCIENCE-Dept.php', ['Computer Science and Engineering (Data Science)', 'CSE Data Science']],
      ['Artificial Intelligence & Machine Learning', 'AIML.php', ['Artificial Intelligence and Machine Learning', 'AIML']],
      ['Electrical Engineering', 'Electrical-dept.php', ['EE']],
      ['Electronics & Communication Engineering', 'ECE-dept.php', ['Electronics and Communication Engineering', 'ECE']],
      ['Information Technology', 'IT-dept.php', ['IT']],
      ['Mechanical Engineering', 'Mechanical-dept.php', ['ME']],
      ['Electronics & Computer Science', '', ['Electronics and Computer Science', 'ECS']],
      ['CSE - Cyber Security', '', ['Computer Science and Engineering (Cyber Security)', 'CSE Cyber Security']]
    ]
  },
  {
    name: 'M.Tech',
    level: 'postgraduate',
    aliases: ['MTech', 'M Tech', 'Master of Technology'],
    durationYears: 2,
    semestersPerYear: 2,
    branches: [
      ['Aeronautical Engineering', 'MTech_AE.php', ['AE']],
      ['Artificial Intelligence & Machine Learning', 'MTech-AI&ML.php', ['Artificial Intelligence and Machine Learning', 'AIML']],
      ['Computer Science and Engineering', 'MTech_CSE.php', ['Computer Science & Engineering', 'CSE']],
      ['Integrated Power Systems', 'MTech_IPS.php', ['Integrated Power System', 'IPS']],
      ['Electric Vehicle Technology', 'Mtech_EVT.php', ['EVT']],
      ['Electronics Engineering (Communication)', 'MTech_ECE.php', ['Electronic Comm. Engineering', 'Electronics and Communication Engineering', 'ECE']],
      ['Mechanical Engineering Design', 'Mtech_MED.php', ['MED']],
      ['Structural Engineering', 'MTech_Structural_Engineering.php', ['SE']]
    ]
  },
  { name: 'MBA', level: 'postgraduate', aliases: ['Master of Business Administration'], durationYears: 2, semestersPerYear: 2, branches: [['Master of Business Administration', 'MBA-dept.php', ['MBA']]] },
  { name: 'MCA', level: 'postgraduate', aliases: ['Master of Computer Applications'], durationYears: 2, semestersPerYear: 2, branches: [['Master of Computer Applications', 'MCA_dept.php', ['Master in Computer Application', 'MCA']]] },
  { name: 'BBA', level: 'undergraduate', aliases: ['Bachelor of Business Administration'], durationYears: 3, semestersPerYear: 2, branches: [['Bachelor of Business Administration', 'BBA.php', ['BBA']]] },
  { name: 'BCA', level: 'undergraduate', aliases: ['Bachelor of Computer Applications'], durationYears: 3, semestersPerYear: 2, branches: [['Bachelor of Computer Applications', 'BCA.php', ['BCA']]] },
  {
    name: 'Diploma',
    level: 'diploma',
    aliases: ['Polytechnic', 'Polytechnic Diploma', 'Diploma in Engineering'],
    durationYears: 3,
    semestersPerYear: 2,
    branches: [
      ['Aeronautical Engineering', 'Diploma_Aeronautical Engineering.php', ['AE']],
      ['Civil Engineering', 'Diploma_Civil_Engineering.php', ['CE']],
      ['Computer Science Engineering', 'Diploma_Computer_Science_Engineering.php', ['Computer Science & Engineering', 'CSE']],
      ['Electrical Engineering', 'Diploma_Electrical_Engineering.php', ['EE']],
      ['Electronics and Communication Engineering', 'Diploma_ECE.php', ['Electronics & Communication Engineering', 'ECE']],
      ['Food Technology', 'Diploma_Food_Technology.php', ['FT']],
      ['Information Technology', 'Diploma_Information_Technology.php', ['IT']],
      ['Mechanical Engineering', 'Diploma_Mechanical_Engineering.php', ['ME']]
    ]
  }
];

async function replaceReferences(models, field, oldId, newId) {
  await Promise.all(models.map((Model) => Model.updateMany({ [field]: oldId }, { $set: { [field]: newId } })));
}

async function countReferences(models, field, id) {
  const counts = await Promise.all(models.map((Model) => Model.countDocuments({ [field]: id })));
  return counts.reduce((total, count) => total + count, 0);
}

async function consolidateProgram(program) {
  const names = [program.name, ...(program.aliases || [])];
  const matches = await Program.find({ name: { $in: names } });
  if (!matches.length) {
    return Program.create({
      name: program.name,
      level: program.level,
      status: 'active',
      durationYears: program.durationYears,
      semestersPerYear: program.semestersPerYear,
      academicStructureVerified: false,
      academicStructureSource,
      verificationStatus: 'pending-prospectus',
      officialSourceUrl: officialWebsite,
      officialSourceTitle: 'TGPCET official website; admission prospectus verification pending'
    });
  }

  const canonical = matches.find((item) => item.name === program.name);
  const ranked = await Promise.all(matches.map(async (item) => ({
    item,
    references: await countReferences([Department, Year, User], 'programId', item._id)
  })));
  ranked.sort((left, right) => {
    if (left.item._id.equals(canonical?._id)) return -1;
    if (right.item._id.equals(canonical?._id)) return 1;
    return right.references - left.references;
  });
  const primary = ranked[0].item;
  for (const { item } of ranked.slice(1)) {
    await replaceReferences([Department, Year, User], 'programId', item._id, primary._id);
    await item.deleteOne();
  }
  const updates = {};
  if (primary.name !== program.name) updates.name = program.name;
  if (!primary.level) updates.level = program.level;
  if (!primary.durationYears) updates.durationYears = program.durationYears;
  if (!primary.semestersPerYear) updates.semestersPerYear = program.semestersPerYear;
  if (!primary.academicStructureSource) updates.academicStructureSource = academicStructureSource;
  if (!primary.officialSourceUrl) updates.officialSourceUrl = officialWebsite;
  if (!primary.officialSourceTitle) {
    updates.officialSourceTitle = 'TGPCET official website; admission prospectus verification pending';
  }
  if (matches.some((item) => item.status === 'active') && primary.status !== 'active') updates.status = 'active';
  if (Object.keys(updates).length) await Program.updateOne({ _id: primary._id }, { $set: updates });
  return Program.findById(primary._id);
}

async function consolidateDepartments(programRecord, branchName, aliases) {
  const prefixes = programRecord.name === 'Diploma'
    ? [`${programRecord.name} - `, 'Polytechnic Diploma - ']
    : [`${programRecord.name} - `];
  const candidates = await Department.find({
    $or: [
      { programId: programRecord._id },
      ...prefixes.map((prefix) => ({ name: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } }))
    ]
  });
  const recognizedNames = [branchName, ...aliases].map(normalized);
  const matches = candidates.filter((candidate) => {
    if (candidate.name === `${programRecord.name} - ${branchName}`) return true;
    const prefix = prefixes.find((value) => candidate.name.toLowerCase().startsWith(value.toLowerCase()));
    const label = candidate.branchName || (prefix ? candidate.name.slice(prefix.length) : candidate.name);
    return recognizedNames.includes(normalized(label));
  });
  if (!matches.length) return null;

  const counts = await Promise.all(matches.map((candidate) => countReferences(departmentReferences, 'departmentId', candidate._id)));
  const ranked = matches.map((candidate, index) => ({ candidate, references: counts[index] }));
  ranked.sort((left, right) => {
    const leftExact = left.candidate.name === `${programRecord.name} - ${branchName}` ? 1 : 0;
    const rightExact = right.candidate.name === `${programRecord.name} - ${branchName}` ? 1 : 0;
    return right.references - left.references || rightExact - leftExact ||
      new Date(left.candidate.createdAt || 0) - new Date(right.candidate.createdAt || 0);
  });
  const [primary, ...duplicates] = ranked.map(({ candidate }) => candidate);
  for (const duplicate of duplicates) {
    await replaceReferences(departmentReferences, 'departmentId', duplicate._id, primary._id);
    await duplicate.deleteOne();
  }

  const updates = {
    programId: programRecord._id,
    name: `${programRecord.name} - ${branchName}`,
    branchName
  };
  const verifiedSource = matches.find((candidate) =>
    candidate.verificationStatus === 'prospectus-verified' && candidate.officialSourceUrl
  );
  if (verifiedSource) {
    updates.verificationStatus = 'prospectus-verified';
    updates.officialSourceUrl = verifiedSource.officialSourceUrl;
    updates.officialSourceTitle = verifiedSource.officialSourceTitle;
  } else if (!primary.verificationStatus) {
    updates.verificationStatus = 'pending-prospectus';
  }
  if (!primary.officialSourceUrl) {
    updates.officialSourceUrl = officialWebsite;
  }
  if (matches.some((candidate) => candidate.status === 'active') && primary.status !== 'active') updates.status = 'active';
  await Department.updateOne({ _id: primary._id }, { $set: updates });
  return primary;
}

async function consolidateProgramYears(programRecord) {
  const years = await Year.find({ programId: programRecord._id }).sort({ createdAt: 1, _id: 1 });
  const groups = new Map();
  for (const year of years) {
    const key = year.academicLevel ? `level:${year.academicLevel}` : `name:${normalized(year.name)}`;
    const group = groups.get(key) || [];
    group.push(year);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const referenceCounts = await Promise.all(group.map((year) => countReferences(academicReferences, 'yearId', year._id)));
    const primaryIndex = referenceCounts.indexOf(Math.max(...referenceCounts));
    const primary = group[primaryIndex];
    if (group.some((year) => year.status === 'active') && primary.status !== 'active') {
      primary.status = 'active';
      primary.isActive = true;
      await primary.save();
    }
    for (const duplicate of group.filter((year) => String(year._id) !== String(primary._id))) {
      const duplicateSemesters = await Semester.find({ yearId: duplicate._id });
      for (const semester of duplicateSemesters) {
        const existing = await Semester.findOne({ yearId: primary._id, number: semester.number });
        if (!existing) {
          semester.yearId = primary._id;
          await semester.save();
        } else {
          await replaceReferences(academicReferences, 'semesterId', semester._id, existing._id);
          await semester.deleteOne();
        }
      }
      await replaceReferences(academicReferences, 'yearId', duplicate._id, primary._id);
      await duplicate.deleteOne();
    }
  }

  const canonicalYears = await Year.find({ programId: programRecord._id });
  for (const year of canonicalYears) {
    const semesters = await Semester.find({ yearId: year._id }).sort({ number: 1, createdAt: 1, _id: 1 });
    const seenNumbers = new Map();
    for (const semester of semesters) {
      const key = String(semester.number);
      const primary = seenNumbers.get(key);
      if (!primary) {
        seenNumbers.set(key, semester);
      } else {
        await replaceReferences(academicReferences, 'semesterId', semester._id, primary._id);
        if (semester.status === 'active' && primary.status !== 'active') {
          primary.status = 'active';
          primary.isActive = true;
          await primary.save();
        }
        await semester.deleteOne();
      }
    }
  }
}

export async function seedDepartments() {
  for (const program of programs) {
    const programRecord = await consolidateProgram(program);

    const programUpdates = {};
    if (!programRecord.durationYears) programUpdates.durationYears = program.durationYears;
    if (!programRecord.semestersPerYear) programUpdates.semestersPerYear = program.semestersPerYear;
    if (!programRecord.academicStructureSource) programUpdates.academicStructureSource = academicStructureSource;
    if (Object.keys(programUpdates).length) {
      await Program.updateOne({ _id: programRecord._id }, { $set: programUpdates });
      Object.assign(programRecord, programUpdates);
    }

    for (const [branchName, sourcePage, aliases = []] of program.branches) {
      const name = `${program.name} - ${branchName}`;
      const officialSourceUrl = sourcePage ? new URL(sourcePage, officialWebsite).toString() : officialWebsite;
      let department = await consolidateDepartments(programRecord, branchName, aliases);
      if (!department) {
        department = await Department.create({
          name,
          code: name.toUpperCase(),
          branchName,
          description: `${program.name}: ${branchName}`,
          programId: programRecord._id,
          verificationStatus: 'pending-prospectus',
          officialSourceUrl,
          officialSourceTitle: 'TGPCET official website; admission prospectus verification pending',
          status: 'active',
          isActive: true
        });
      }

      if (!department.officialSourceUrl) await Department.updateOne({ _id: department._id }, { $set: { officialSourceUrl } });
      await User.updateMany(
        { departmentId: department._id, $or: [{ programId: null }, { programId: { $exists: false } }] },
        { $set: { programId: programRecord._id } }
      );
    }

    await consolidateProgramYears(programRecord);
    await ensureProgramAcademicStructure(programRecord);
  }
}
