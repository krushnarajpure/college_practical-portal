import api from './api';

const pdfService = {
  upload: async (file, practicalId) => {
    if (!file || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Choose a valid PDF file.');
    }
    if (file.size > 25 * 1024 * 1024) throw new Error('PDF files must be 25 MB or smaller.');
    const formData = new FormData();
    formData.append('practicalId', practicalId);
    formData.append('pdf', file);
    return api.post('/pdfs/upload', formData);
  },
  getById: async (id) => api.get(`/pdfs/${id}`),
  view: async (id) => URL.createObjectURL(await api.getBlob(`/pdfs/${id}/view`)),
  download: async (id, fileName = 'practical.pdf') => {
    const url = URL.createObjectURL(await api.getBlob(`/pdfs/${id}/download`));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};

export default pdfService;