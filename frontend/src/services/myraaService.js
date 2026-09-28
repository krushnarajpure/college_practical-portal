import { apiResponse } from './mockStore.js';

const myraaService = {
  getDashboard: async () => apiResponse('Myraa integration workspace loaded.', {
    greeting: 'Hi, I’m Myraa. How can I help you?',
    connected: false,
    suggestions: ['Explain the aim of my practical', 'Help me understand a concept', 'Break down a procedure step', 'Help me prepare viva questions']
  }),
  getReports: async () => apiResponse('No Myraa reports are connected in the frontend demo.', []),
  ask: async (question) => apiResponse('Connect the existing Myraa project to enable live answers.', { question, connected: false }),
  startConversation: async () => apiResponse('Conversation interface started.', { active: true }),
  stopConversation: async () => apiResponse('Conversation interface stopped.', { active: false })
};

export default myraaService;
