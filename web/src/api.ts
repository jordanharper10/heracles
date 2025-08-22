import axios from 'axios';
import { getToken, clearAuth } from './auth';

export const api = axios.create({
  baseURL: '/api', // nginx proxies this to your server
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${t}`;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401) {
      clearAuth();
      // prevent redirect loops if already at /login
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

