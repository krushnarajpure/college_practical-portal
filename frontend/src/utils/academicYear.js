const levelFromCode = (code) => {
  const match = /^YEAR-([1-4])$/.exec(String(code || '').toUpperCase());
  return match ? Number(match[1]) : null;
};

export function getAcademicYearLevel(year) {
  const level = Number(year?.academicLevel) || levelFromCode(year?.code);
  return [1, 2, 3, 4].includes(level) ? level : null;
}

export function getAcademicYearOptions(years = []) {
  return years
    .filter((year) => getAcademicYearLevel(year) !== null)
    .sort((left, right) => getAcademicYearLevel(left) - getAcademicYearLevel(right));
}