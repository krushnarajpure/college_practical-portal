export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

export const capitalize = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
