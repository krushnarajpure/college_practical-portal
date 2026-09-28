import api from './api';

const authService = {
  login: async ({ email, password, role }) => {
    const response = await api.post('/auth/login', { email, password, role });
    const token = response?.data?.token;
    const user = response?.data?.user;

    if (token) localStorage.setItem('college_practical_token', token);
    if (user) localStorage.setItem('college_practical_user', JSON.stringify(user));

    return response;
  },
  register: async (details) => {
    const response = await api.post('/auth/register', details);
    const token = response?.data?.token;
    const user = response?.data?.user;

    if (token) localStorage.setItem('college_practical_token', token);
    if (user) localStorage.setItem('college_practical_user', JSON.stringify(user));

    return response;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore backend logout errors; clear local session anyway
    }
    localStorage.removeItem('college_practical_token');
    localStorage.removeItem('college_practical_user');
    return { success: true, message: 'Signed out.', data: null };
  },
  getCurrentUser: async () => api.get('/auth/me'),
  forgotPassword: async ({ email }) => api.post('/auth/forgot-password', { email }),
  resetPassword: async (payload) => api.post('/auth/reset-password', payload)
};

export default authService;
