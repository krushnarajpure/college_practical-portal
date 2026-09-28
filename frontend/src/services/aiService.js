import api from './api';

const aiService = {
  analyzePdf: async ({ practicalId } = {}) => {
    if (!practicalId) throw new Error('A saved practical with an uploaded PDF is required for analysis.');
    return api.post(`/practicals/${practicalId}/analyze`, {});
  },
  generatePracticalSummary: async (practical = {}) => ({
    success: true,
    message: 'Summary loaded from the saved practical guide.',
    data: { title: practical.title || '', summary: practical.about || practical.aim || '' }
  })
};

export default aiService;
