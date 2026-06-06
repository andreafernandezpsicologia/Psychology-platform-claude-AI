import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // envía la cookie httpOnly en cada petición automáticamente
});

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/activate'];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('user');
      const onPublicPage = PUBLIC_PATHS.some(p => window.location.pathname.startsWith(p));
      if (!onPublicPage) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
