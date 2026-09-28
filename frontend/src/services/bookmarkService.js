import api from './api';

const bookmarkService = {
  getAll: async () => api.get('/bookmarks'),
  add: async (practicalId) => api.post(`/bookmarks/${practicalId}`, {}),
  remove: async (practicalId) => api.del(`/bookmarks/${practicalId}`)
};

export default bookmarkService;
