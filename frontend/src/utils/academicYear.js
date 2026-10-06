const levelFromCode = (code) => {
  const match = /^YEAR-([1-4])$/.exec(String(code || '').toUpperCase());
  return match ? Number(match[1]) : null;
};

export function getAcademicYearLevel(year) {
  const level = Number(year?.academicLevel) || levelFromCode(year?.code);
  return [1, 2, 3, 4].includes(level) ? level : null;
}

export function getAcademicYearOptions(years = []) {
  return [...years].sort((left, right) => {
    const leftLevel = getAcademicYearLevel(left) || Number(left.order) || Number.POSITIVE_INFINITY;
    const rightLevel = getAcademicYearLevel(right) || Number(right.order) || Number.POSITIVE_INFINITY;
    return leftLevel - rightLevel || String(left.name || '').localeCompare(String(right.name || ''));
  });
}