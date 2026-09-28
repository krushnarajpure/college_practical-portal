import { users } from '../data/portalData.js';
import { apiResponse, readCollection, writeCollection } from './mockStore.js';

const userStorageKey = 'portal-mock-users';
const sessionStorageKey = 'college-portal-user';

const authService = {
  login: async ({ email, role }) => {
    const accounts = readCollection(userStorageKey, users);
    const account = accounts.find((item) => item.role === role && item.email.toLowerCase() === email.toLowerCase())
      || accounts.find((item) => item.role === role);
    if (!account) return { success: false, message: 'No demo account is available for this role.', data: null };
    const sessionUser = { ...account, email: email || account.email };
    writeCollection(sessionStorageKey, sessionUser);
    return apiResponse('Signed in to the mock portal.', sessionUser);
  },
  register: async (details) => {
    const { password: _password, confirmPassword: _confirmPassword, ...profile } = details;
    const account = { ...profile, id: `${details.role}-${Date.now()}`, name: details.fullName?.trim() };
    const accounts = readCollection(userStorageKey, users);
    writeCollection(userStorageKey, [...accounts, account]);
    writeCollection(sessionStorageKey, account);
    return apiResponse('Mock account created.', account);
  },
  logout: async () => {
    try { globalThis.localStorage?.removeItem(sessionStorageKey); } catch { }
    return apiResponse('Signed out.', null);
  },
  getCurrentUser: async () => apiResponse('Current mock session loaded.', readCollection(sessionStorageKey, null)),
  forgotPassword: async ({ email }) => apiResponse('If an account exists, reset instructions will be sent.', { email }),
  resetPassword: async () => apiResponse('Password reset is ready for the backend auth endpoint.', null)
};

export default authService;
