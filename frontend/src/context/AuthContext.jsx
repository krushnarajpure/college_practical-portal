import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
const storageKey = 'college_practical_user';
const tokenKey = 'college_practical_token';
const AUTH_REQUEST_TIMEOUT_MS = 60000;

function readStoredUser() {
  try {
    const storedUser = localStorage.getItem(storageKey);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(tokenKey) || '';
  } catch {
    return '';
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);
  const [token, setToken] = useState(readStoredToken);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!token) {
      setUserState(null);
      setLoading(false);
      return null;
    }

    try {
      const response = await api.get('/auth/me');
      const nextUser = response?.data?.user || null;
      setUserState(nextUser);
      if (nextUser) {
        localStorage.setItem(storageKey, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(storageKey);
      }
      return nextUser;
    } catch {
      setUserState(null);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(tokenKey);
      setToken('');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const setUser = (nextUser) => {
    setUserState(nextUser);
    if (nextUser) localStorage.setItem(storageKey, JSON.stringify(nextUser));
    else localStorage.removeItem(storageKey);
  };

  const login = async ({ email, password, role }) => {
    const payload = await api.request('/auth/login', {
      method: 'POST',
      body: { email, password, role },
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS
    });
    const signedIn = payload?.data?.user;
    const jwtToken = payload?.data?.token;

    if (!signedIn || !jwtToken) throw new Error('No user was returned by the backend.');

    setUser(signedIn);
    setToken(jwtToken);
    localStorage.setItem(tokenKey, jwtToken);
    return signedIn;
  };

  const register = async (details) => {
    const payload = await api.request('/auth/register', {
      method: 'POST',
      body: {
        name: details.fullName,
        email: details.email,
        password: details.password,
        role: details.role,
        ...(details.role === 'student' ? {
          studentId: details.studentId,
          departmentId: details.departmentId,
          yearId: details.yearId,
          semesterId: details.semesterId
        } : {}),
        ...(details.role === 'teacher' ? { employeeId: details.employeeId, departmentId: details.departmentId } : {})
      },
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS
    });
    const createdUser = payload?.data?.user;
    const jwtToken = payload?.data?.token;

    if (!createdUser || !jwtToken) throw new Error('Registration did not return a valid user.');

    setUser(createdUser);
    setToken(jwtToken);
    localStorage.setItem(tokenKey, jwtToken);
    return createdUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore backend logout errors; clear local session anyway
    }
    setUser(null);
    setToken('');
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(storageKey);
  };

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    loading,
    setUser,
    login,
    register,
    logout,
    token,
    refreshUser
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}