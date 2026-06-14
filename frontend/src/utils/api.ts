import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const errMsg = error.response.data?.error || '';
      // If the error indicates a token failure, auto-logout
      if (
        errMsg.toLowerCase().includes('token') || 
        errMsg.toLowerCase().includes('expired') || 
        errMsg.toLowerCase().includes('auth') || 
        errMsg.toLowerCase().includes('access')
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
