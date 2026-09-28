export const practicalValidator = {
  create: (payload) => ({
    success: Boolean(payload.subjectId && payload.departmentId && payload.yearId && payload.semesterId && payload.practicalNumber && payload.title),
    message: 'Practical requires subjectId, departmentId, yearId, semesterId, practicalNumber, and title.'
  })
};
