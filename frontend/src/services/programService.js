import api from './api';

const programService = {
  getAll: async (filters = {}) => api.get('/programs', filters),
  create: async (payload) => api.post('/programs', payload),
  update: async (id, payload) => api.put(`/programs/${id}`, payload),
  remove: async (id) => api.del(`/programs/${id}`)
};

export default programService;