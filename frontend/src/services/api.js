const configuredApiBaseUrl = import.meta.env.VITE_API_URL;
const defaultApiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:5000/api';

function normalizeApiBaseUrl(value) {
  const baseUrl = value?.trim();
  if (!baseUrl) return '';

  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = /\/api$/i.test(pathname) ? pathname : `${pathname}/api`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl || defaultApiBaseUrl);
const REQUEST_TIMEOUT_MS = 15000;

function createRequestUrl(path) {
  if (/^https?:\/\//i.test(path)) return new URL(path);
  if (!API_BASE_URL) {
    throw new Error('Portal API is not configured. Set VITE_API_URL in the Vercel project settings and redeploy.');
  }
  return new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
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
  const { method = 'GET', body, headers = {}, query = {}, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const url = createRequestUrl(path);

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
  }, timeoutMs);

  const contentType = response.headers.get('content-type') || '';
  const parsed = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message = parsed?.message || parsed?.error || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return parsed ?? { success: true, data: null };
}

async function requestBlob(path, options = {}) {
  const { method = 'GET', body, headers = {}, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const url = createRequestUrl(path);
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
  }, timeoutMs);

  if (!response.ok) {
    const parsed = await response.json().catch(() => null);
    throw new Error(parsed?.message || parsed?.error || response.statusText || 'Request failed');
  }

  return response.blob();
}

const api = {
  get: (path, query, timeoutMs) => request(path, { method: 'GET', query, timeoutMs }),
  post: (path, body, query) => request(path, { method: 'POST', body, query }),
  put: (path, body, query) => request(path, { method: 'PUT', body, query }),
  patch: (path, body, query) => request(path, { method: 'PATCH', body, query }),
  del: (path, query) => request(path, { method: 'DELETE', query }),
  getBlob: requestBlob,
  request
};

export default api;
export { API_BASE_URL, request };
