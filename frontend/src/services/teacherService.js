import api from './api';

const teacherService = {
  getDashboard: async () => api.get('/teacher/dashboard'),
  getSubjects: async () => api.get('/teacher/subjects'),
  getAvailableSubjects: async () => api.get('/teacher/subjects/available'),
  assignSubject: async (subjectId) => api.post('/teacher/subjects', { subjectId }),
  createSubject: async (payload) => api.post('/teacher/subjects/create', payload),
  getPracticals: async () => api.get('/teacher/practicals'),
  createPractical: async (payload) => api.post('/practicals', payload),
  getPracticalById: async (id) => api.get(`/practicals/${id}`),
  updatePractical: async (id, payload) => api.put(`/practicals/${id}`, payload),
  deletePractical: async (id) => api.del(`/practicals/${id}`),
  publishPractical: async (id) => api.post(`/practicals/${id}/publish`, {}),
  unpublishPractical: async (id) => api.post(`/practicals/${id}/unpublish`, {}),
  analyzePractical: async (id) => api.post(`/teacher/practicals/${id}/analyze`, {}),
  getStudents: async () => api.get('/teacher/students')
};

export default teacherService;
