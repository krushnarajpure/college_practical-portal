import api from './api';

const yearService = {
  getAll: async (filters) => api.get('/years', filters),
  create: async (payload) => api.post('/years', payload),
  update: async (id, payload) => api.put(`/years/${id}`, payload),
  remove: async (id) => api.del(`/years/${id}`)
};

export default yearService;
