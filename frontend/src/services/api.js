import axios from 'axios';

// Get backend API base URL from Vite environment variable or default to localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to attach simulated user authentication context
apiClient.interceptors.request.use(
  (config) => {
    const storedUserId = localStorage.getItem('nrrms_user_id') || import.meta.env.VITE_DEFAULT_USER_ID || '1';
    
    // G1 auth convention: pass Authorization bearer and X-User-Id
    if (storedUserId) {
      config.headers['X-User-Id'] = storedUserId;
      config.headers['Authorization'] = `Bearer dev-token-user-${storedUserId}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to format backend error messages cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred';
    let code = 'UNKNOWN_ERROR';
    let status = error.response?.status;

    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        // FastAPI validation errors
        message = data.detail.map((d) => `${d.loc?.join('.') || 'Field'}: ${d.msg}`).join(', ');
        code = 'VALIDATION_ERROR';
      }
      if (data.code) {
        code = data.code;
      }
    } else if (error.code === 'ERR_NETWORK') {
      message = `Cannot connect to backend server at ${API_BASE_URL}. Ensure FastAPI is running on port 8000.`;
      code = 'BACKEND_OFFLINE';
    } else if (error.message) {
      message = error.message;
    }

    const customError = new Error(message);
    customError.code = code;
    customError.status = status;
    customError.originalError = error;
    return Promise.reject(customError);
  }
);

export default apiClient;
