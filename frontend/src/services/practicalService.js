import api from './api';

const practicalService = {
  getAll: async () => api.get('/practicals'),
  getById: async (id) => api.get(`/practicals/${id}`),
  create: async (payload) => api.post('/practicals', payload),
  update: async (id, payload) => api.put(`/practicals/${id}`, payload),
  remove: async (id) => api.del(`/practicals/${id}`),
  publish: async (id) => api.post(`/practicals/${id}/publish`, {}),
  unpublish: async (id) => api.post(`/practicals/${id}/unpublish`, {}),
  analyze: async (id) => api.post(`/practicals/${id}/analyze`, {})
};

export default practicalService;
