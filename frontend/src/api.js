const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const apiRequest = async (path, { method = 'GET', body, token = '' } = {}) => {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error('Could not reach the store server. Check that the backend is running.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  return data;
};
