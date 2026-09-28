const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthToken = () => localStorage.getItem('college_practical_token');

async function request(endpoint, options = {}) {
  const { method = 'GET', body, headers = {}, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const config = {
    method,
    ...rest,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
    }
  };

  if (body !== undefined && body !== null && !isFormData) {
    config.body = JSON.stringify(body);
  } else if (body !== undefined && body !== null) {
    config.body = body;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

async function requestBlob(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'File request failed.');
  }
  return response.blob();
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  del: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  getBlob: requestBlob
};

export default api;
