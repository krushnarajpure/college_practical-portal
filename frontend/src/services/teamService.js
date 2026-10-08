import api, { API_BASE_URL } from './api';

function createMemberFormData(member, photo) {
  const formData = new FormData();
  Object.entries(member).forEach(([key, value]) => formData.append(key, value));
  if (photo) formData.append('photo', photo);
  return formData;
}

const teamService = {
  getPublicMembers: async () => api.get('/public/team-members'),
  getMembers: async () => api.get('/admin/team-members'),
  createMember: async (member, photo) => api.post('/admin/team-members', createMemberFormData(member, photo)),
  updateMember: async (id, member, photo) => api.put(`/admin/team-members/${id}`, createMemberFormData(member, photo)),
  deleteMember: async (id) => api.del(`/admin/team-members/${id}`),
  getPhotoUrl: (id, version = '') => `${API_BASE_URL || '/api'}/public/team-members/${id}/photo${version ? `?v=${encodeURIComponent(version)}` : ''}`
};

export default teamService;
