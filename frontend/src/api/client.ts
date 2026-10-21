import axios from 'axios';

// Base API client instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token if present in localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nrrms_jwt_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error formatting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = error.response?.data || {
      detail: error.message || 'An unexpected network error occurred',
      code: 'NETWORK_ERROR',
    };
    return Promise.reject(customError);
  }
);
