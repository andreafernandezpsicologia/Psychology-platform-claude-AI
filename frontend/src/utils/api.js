import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // envía la cookie httpOnly en cada petición automáticamente
});

// ── Interceptor de 401 ────────────────────────────────────────────────────────
// NO recargamos la página (eso provocaba el bucle de recargas/parpadeo). Solo
// limpiamos el estado local y avisamos a AuthContext con un evento; React Router
// se encarga de redirigir con <Navigate>, sin recargar.
//
// Las llamadas que esperan un 401 "normal" (sondeo /auth/me, login, 2fa, logout)
// pasan { skipAuthRedirect: true } para que aquí se ignoren.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.skipAuthRedirect) {
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

export default api;
