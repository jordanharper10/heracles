import axios from 'axios';

// Use relative path so nginx can proxy /api to :8080
const base = '/api';

export const api = axios.create({ baseURL: base });

// Token helpers
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('authToken', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('authToken');
    delete api.defaults.headers.common['Authorization'];
  }
}

// Initialize from storage
const stored = localStorage.getItem('authToken');
if (stored) setAuthToken(stored);

