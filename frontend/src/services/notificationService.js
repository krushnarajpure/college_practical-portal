import api from './api';

const notificationService = {
  getAll: async () => api.get('/notifications'),
  markAsRead: async (id) => api.put(`/notifications/${id}/read`)
};

export default notificationService;
