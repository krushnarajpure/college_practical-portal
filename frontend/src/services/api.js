const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The server took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

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

  const response = await fetchWithTimeout(url, {
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

async function requestBlob(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  const token = typeof localStorage !== 'undefined'
    ? localStorage.getItem('college_practical_token')
    : null;
  const response = await fetchWithTimeout(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body === undefined || body === null ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(body === undefined || body === null ? {} : { body: JSON.stringify(body) })
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
