import api from './api';

const subjectService = {
  getAll: async () => api.get('/subjects'),
  getById: async (id) => api.get(`/subjects/${id}`),
  create: async (payload) => api.post('/subjects', payload),
  update: async (id, payload) => api.put(`/subjects/${id}`, payload),
  remove: async (id) => api.del(`/subjects/${id}`)
};

export default subjectService;
