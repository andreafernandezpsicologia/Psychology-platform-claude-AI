import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // envía la cookie httpOnly en cada petición automáticamente
});

// Si el servidor devuelve 401, limpiar datos de usuario y redirigir al login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
