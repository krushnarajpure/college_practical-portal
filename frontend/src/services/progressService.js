import api from './api';

const progressService = {
  getAll: async () => api.get('/progress'),
  complete: async (practicalId) => api.post(`/progress/${practicalId}/complete`, {}),
  uncomplete: async (practicalId) => api.del(`/progress/${practicalId}/complete`)
};

export default progressService;
