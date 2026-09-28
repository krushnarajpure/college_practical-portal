import api from './api';

const createSemester = (payload) => api.post('/semesters', payload);
const updateSemester = (id, payload) => api.put(`/semesters/${id}`, payload);

const semesterService = {
  getAll: async () => api.get('/semesters'),
  create: createSemester,
  createSemester,
  update: updateSemester,
  updateSemester,
  remove: async (id) => api.del(`/semesters/${id}`)
};

export default semesterService;
