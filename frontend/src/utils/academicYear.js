const levelFromCode = (code) => {
  const match = /^YEAR-([1-8])$/.exec(String(code || '').toUpperCase());
  return match ? Number(match[1]) : null;
};

export function dedupeAcademicOptions(items = [], getKey = (item) => item?._id || item?.id || item?.code || item?.name) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(getKey(item) || `${item?.name || ''}|${item?.programId || ''}|${item?.yearId || ''}|${item?.number || ''}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getAcademicYearLevel(year) {
  const level = Number(year?.academicLevel) || levelFromCode(year?.code);
  return Number.isInteger(level) && level >= 1 && level <= 8 ? level : null;
}

export function getAcademicYearOptions(years = []) {
  return dedupeAcademicOptions([...years].sort((left, right) => {
    const leftLevel = getAcademicYearLevel(left) || Number(left.order) || Number.POSITIVE_INFINITY;
    const rightLevel = getAcademicYearLevel(right) || Number(right.order) || Number.POSITIVE_INFINITY;
    return leftLevel - rightLevel || String(left.name || '').localeCompare(String(right.name || ''));
  }));
}