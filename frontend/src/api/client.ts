/**
 * Axios API client with JWT injection and error handling.
 *
 * Every request automatically includes the Bearer token from sessionStorage.
 * 401 responses → redirect to login (token expired or invalid).
 * Never expose raw error details to the user.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('crimelink_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401/403 ────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear and redirect to login
      sessionStorage.removeItem('crimelink_token');
      sessionStorage.removeItem('crimelink_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Extract a safe error message from an Axios error */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg: string }) => d.msg).join(', ');
    }
    if (error.response?.status === 403) return 'You do not have permission for this action.';
    if (error.response?.status === 404) return 'The requested resource was not found.';
    if (error.response?.status === 429) return 'Too many requests. Please wait and try again.';
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
  }
  return 'An unexpected error occurred.';
}
