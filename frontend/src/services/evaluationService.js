import api from './api';

const evaluationService = {
  save: async (payload) => api.post('/evaluations', payload),
  getAll: async (query) => api.get('/evaluations', query),
  getStudent: async (studentId) => studentId ? api.get(`/evaluations/student/${studentId}`) : api.get('/evaluations/student'),
  getByPractical: async (practicalId) => api.get(`/evaluations/practical/${practicalId}`)
};

export default evaluationService;
