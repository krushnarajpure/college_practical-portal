import api from './api';

const studentService = {
  getDashboard: async () => api.get('/student/dashboard'),
  getSubjects: async () => api.get('/student/subjects'),
  getPracticals: async () => api.get('/student/practicals'),
  getSubjectPracticals: async (subjectId) => api.get(`/subjects/${subjectId}/practicals`),
  getPracticalById: async (practicalId) => api.get(`/student/practicals/${practicalId}`),
  getProfile: async () => api.get('/student/profile')
};

export default studentService;