const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('rightway_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401) {
    localStorage.removeItem('rightway_token');
    localStorage.removeItem('rightway_user');
  }

  return response;
}

/**
 * Retry a request on transient failures with exponential backoff.
 * Only retries GET requests (safe/idempotent) and only on network
 * errors or 5xx server errors (not 4xx client errors).
 */
async function withRetry(fn, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      // Only retry on server errors (5xx) or 429 rate limit
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        continue;
      }
      return res;
    } catch (err) {
      // Network error (fetch threw) — retry if attempts remain
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  throw lastError;
}

export async function apiGet(endpoint) {
  const res = await withRetry(() => request(endpoint));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export async function apiPost(endpoint, body) {
  const res = await request(endpoint, { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

export async function apiPut(endpoint, body) {
  const res = await request(endpoint, { method: 'PUT', body });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

export async function apiDelete(endpoint) {
  const res = await request(endpoint, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export default { apiGet, apiPost, apiPut, apiDelete };

const API_BASE_RAW = import.meta.env.VITE_API_URL || '/api';

/**
 * Open a PDF in a new tab using a short-lived download token.
 * Replaces JWT-in-query-string pattern to prevent credential leakage.
 */
export async function openPdf(pdfPath, livraisonId) {
  try {
    const tokenRes = await apiGet(`/livraisons/${livraisonId}/pdf-token`);
    window.open(`${API_BASE_RAW}${pdfPath}?dtoken=${encodeURIComponent(tokenRes.token)}`, '_blank');
  } catch (err) {
    // Fallback: open without token (auth middleware will return 401)
    console.error('Failed to fetch PDF download token:', err.message);
    window.open(`${API_BASE_RAW}${pdfPath}`, '_blank');
  }
}
