import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center" style={{ border: '1px solid var(--border)' }}>
          <p className="text-red-500">Enlace no válido o expirado.</p>
          <button onClick={() => navigate('/login')} className="mt-4 text-sm underline" style={{ color: 'var(--brand)' }}>
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'El enlace no es válido o ha expirado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm" style={{ border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(26,45,74,0.08)' }}>
        <div className="text-center mb-8">
          <img src="/logo-studio-renacer.svg" alt="Studio Renacer" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>
            Nueva contraseña
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>Elige una contraseña segura</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-green-600 font-medium">¡Contraseña actualizada correctamente!</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full text-white font-semibold py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand)' }}>Nueva contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition"
                style={{ border: '1.5px solid var(--border)', color: 'var(--brand)' }}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand)' }}>Confirmar contraseña</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition"
                style={{ border: '1.5px solid var(--border)', color: 'var(--brand)' }}
                placeholder="Repite la contraseña"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
