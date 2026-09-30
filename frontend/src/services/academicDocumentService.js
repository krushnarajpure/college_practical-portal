import api from './api';

const root = '/academic-documents';

const academicDocumentService = {
  getStudentDocuments: async () => api.get(`${root}/student`),
  getTeacherDocuments: async () => api.get(`${root}/teacher`),
  getById: async (id) => api.get(`${root}/${id}`),
  upload: async (formData) => api.post(root, formData),
  update: async (id, values) => api.put(`${root}/${id}`, values),
  remove: async (id) => api.del(`${root}/${id}`),
  getEligibleStudents: async (id) => api.get(`${root}/${id}/students`),
  getEditableFields: async (id) => api.get(`${root}/${id}/editable-fields`),
  manualEdit: async (id, values) => api.post(`${root}/${id}/manual-edit`, { values }),
  aiEdit: async (id, instruction) => api.post(`${root}/${id}/ai-edit`, { instruction }),
  convert: async (id, format) => api.post(`${root}/${id}/convert/${format}`, {}),
  getFile: async (id, versionId = '', download = false) => api.getBlob(versionId
    ? `${root}/${id}/versions/${versionId}/file${download ? '?download=true' : ''}`
    : `${root}/${id}/${download ? 'download' : 'preview'}`)
};

export default academicDocumentService;