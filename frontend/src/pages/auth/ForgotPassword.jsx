import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
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
            Recuperar acceso
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
            Te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm" style={{ color: 'var(--brand)' }}>
              Si el email está registrado, recibirás un enlace en los próximos minutos. Revisa también tu carpeta de spam.
            </p>
            <Link to="/login" className="block text-sm underline mt-4" style={{ color: 'var(--text)' }}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand)' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition"
                style={{ border: '1.5px solid var(--border)', color: 'var(--brand)' }}
                placeholder="tu@email.com"
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-xs hover:underline" style={{ color: 'var(--text)' }}>
                ← Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
