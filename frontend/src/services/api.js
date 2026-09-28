const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {}, query = {} } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const token = typeof localStorage !== 'undefined'
    ? localStorage.getItem('college_practical_token')
    : null;

  const response = await fetch(url, {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    credentials: 'include',
    ...(body === undefined || body === null ? {} : { body: isFormData ? body : JSON.stringify(body) })
  });

  const contentType = response.headers.get('content-type') || '';
  const parsed = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message = parsed?.message || parsed?.error || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return parsed ?? { success: true, data: null };
}

async function requestBlob(path) {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  const token = typeof localStorage !== 'undefined'
    ? localStorage.getItem('college_practical_token')
    : null;
  const response = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const parsed = await response.json().catch(() => null);
    throw new Error(parsed?.message || parsed?.error || response.statusText || 'Request failed');
  }

  return response.blob();
}

const api = {
  get: (path, query) => request(path, { method: 'GET', query }),
  post: (path, body, query) => request(path, { method: 'POST', body, query }),
  put: (path, body, query) => request(path, { method: 'PUT', body, query }),
  patch: (path, body, query) => request(path, { method: 'PATCH', body, query }),
  del: (path, query) => request(path, { method: 'DELETE', query }),
  getBlob: requestBlob,
  request
};

export default api;
export { API_BASE_URL, request };
