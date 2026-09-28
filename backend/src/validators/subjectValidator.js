export const subjectValidator = {
  create: (payload) => ({
    success: Boolean(payload.name && payload.subjectCode && payload.departmentId && payload.yearId && payload.semesterId),
    message: 'Subject requires name, subjectCode, departmentId, yearId, and semesterId.'
  })
};
