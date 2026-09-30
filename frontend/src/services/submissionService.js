import api from './api';

const submissionService = {
  create: async (payload) => api.post('/submissions', payload),
  getStudent: async () => api.get('/submissions/student'),
  getAll: async (query) => api.get('/submissions', query),
  getByPractical: async (practicalId) => api.get(`/submissions/practical/${practicalId}`),
  getFile: async (id) => api.getBlob(`/submissions/${id}/file`)
};

export default submissionService;
