import api from './api';

const departmentService = {
  getAll: async (filters) => api.get('/departments', filters),
  create: async (payload) => api.post('/departments', payload),
  update: async (id, payload) => api.put(`/departments/${id}`, payload),
  remove: async (id) => api.del(`/departments/${id}`)
};

export default departmentService;
