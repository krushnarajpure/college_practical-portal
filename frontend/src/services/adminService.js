import api from './api';

const adminService = {
  getDashboard: async () => api.get('/admin/dashboard'),
  getDepartments: async () => api.get('/admin/departments'),
  getTeachers: async () => api.get('/admin/teachers'),
  getStudents: async () => api.get('/admin/students'),
  getSubjects: async () => api.get('/admin/subjects'),
  getPracticals: async () => api.get('/admin/practicals')
};

export default adminService;
