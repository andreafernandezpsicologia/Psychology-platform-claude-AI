import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Solo guardamos los datos del usuario (nombre, rol) — nunca el token
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión activa con el servidor (cookie httpOnly enviada automáticamente)
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        // Sin sesión válida — limpiar estado
        setUser(null);
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });

    // Si el admin tiene 2FA activo, el servidor devuelve { require2fa: true, tempToken }
    // Lanzamos un error especial que Login.jsx captura para mostrar el paso 2
    if (res.data.require2fa) {
      const err = new Error('2fa_required');
      err.tempToken = res.data.tempToken;
      throw err;
    }

    // Login normal: el servidor ya seteó la cookie httpOnly
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const verify2fa = async (tempToken, code) => {
    const res = await api.post('/auth/2fa/verify', { tempToken, code });
    // El servidor seteó la cookie — guardamos datos del usuario
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout'); // el servidor borra la cookie
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
