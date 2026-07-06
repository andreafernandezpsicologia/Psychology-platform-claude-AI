import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import i18n from '../i18n';

const AuthContext = createContext(null);

// Al iniciar sesión, la app se muestra en el idioma preferido del usuario
// (el que Andrea marca al crear la cuenta). Después puede cambiarlo a mano.
const aplicarIdioma = (u) => {
  if (u?.idioma_preferido && ['es', 'en', 'da'].includes(u.idioma_preferido)) {
    i18n.changeLanguage(u.idioma_preferido);
  }
};

export function AuthProvider({ children }) {
  // Solo guardamos los datos del usuario (nombre, rol) — nunca el token
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Si el usuario inicia sesión de forma explícita mientras el sondeo inicial
  // /auth/me sigue en vuelo, su resultado tardío NO debe pisar la sesión nueva.
  const explicitAuth = useRef(false);

  // ── Sondeo inicial: ¿hay una sesión válida en la cookie? ──────────────────────
  useEffect(() => {
    api.get('/auth/me', { skipAuthRedirect: true })
      .then((res) => {
        if (explicitAuth.current) return;
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        if (explicitAuth.current) return;
        setUser(null);
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Sesión expirada en una petición real (la detecta el interceptor) ──────────
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password }, { skipAuthRedirect: true });

    // Si el admin tiene 2FA activo, el servidor devuelve { require2fa: true, tempToken }
    // Lanzamos un error especial que Login.jsx captura para mostrar el paso 2
    if (res.data.require2fa) {
      const err = new Error('2fa_required');
      err.tempToken = res.data.tempToken;
      throw err;
    }

    // Login normal: el servidor ya seteó la cookie httpOnly
    explicitAuth.current = true;
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    aplicarIdioma(res.data.user);
    setLoading(false); // no esperar al sondeo inicial (puede ir lento si Render está frío)
    return res.data.user;
  };

  const verify2fa = async (tempToken, code) => {
    const res = await api.post('/auth/2fa/verify', { tempToken, code }, { skipAuthRedirect: true });
    // El servidor seteó la cookie — guardamos datos del usuario
    explicitAuth.current = true;
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    aplicarIdioma(res.data.user);
    setLoading(false);
    return res.data.user;
  };

  const logout = async () => {
    explicitAuth.current = true; // evita que un /auth/me en vuelo restaure el usuario
    try {
      await api.post('/auth/logout', {}, { skipAuthRedirect: true }); // el servidor borra la cookie
    } catch {
      // ignorar errores de red en logout
    }
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2fa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
