import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

const LANGS = ['ES', 'EN', 'DA'];

export default function Login() {
  const { login, verify2fa } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Paso 1: email + contraseña / Paso 2: código 2FA
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Paso 1: login con email + contraseña ──────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/paciente');
    } catch (err) {
      if (err.message === '2fa_required') {
        // Admin con 2FA: pasar al paso 2
        setTempToken(err.tempToken);
        setStep(2);
      } else if (err.response?.status === 400 || err.response?.status === 401) {
        setError(t('login.error'));
      } else if (err.response?.status === 429) {
        setError(t('login.rateLimitError'));
      } else {
        setError(t('login.networkError'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Paso 2: verificar código TOTP ─────────────────────────────────────────────
  const handle2fa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await verify2fa(tempToken, code);
      navigate(user.role === 'admin' ? '/admin' : '/paciente');
    } catch {
      setError('Código incorrecto o expirado. Inténtalo de nuevo.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Language switcher */}
      <div className="flex gap-2 mb-8">
        {LANGS.map((lang) => {
          const code2 = lang.toLowerCase();
          const active = i18n.language === code2;
          return (
            <button
              key={lang}
              onClick={() => i18n.changeLanguage(code2)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
              style={{
                backgroundColor: active ? 'var(--navy)' : 'white',
                color: active ? 'white' : 'var(--navy)',
                border: '1px solid var(--navy)',
              }}
            >
              {lang}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-8 w-full max-w-sm" style={{ border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(26,45,74,0.08)' }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold mx-auto mb-4" style={{ backgroundColor: 'var(--navy)' }}>
            R
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}>
            {step === 1 ? t('login.title') : 'Verificación en dos pasos'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
            {step === 1 ? t('login.subtitle') : 'Introduce el código de tu aplicación de autenticación'}
          </p>
        </div>

        {/* ── Paso 1: email + contraseña ─────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
                {t('login.email')}
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition"
                style={{ border: '1.5px solid var(--border)', color: 'var(--navy)' }}
                onFocus={e => e.target.style.borderColor = 'var(--navy)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
                {t('login.password')}
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition"
                style={{ border: '1.5px solid var(--border)', color: 'var(--navy)' }}
                onFocus={e => e.target.style.borderColor = 'var(--navy)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--navy)' }}
            >
              {loading ? t('login.loading') : t('login.submit')}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--text)' }}>
                {t('login.forgotPassword')}
              </Link>
            </div>
          </form>
        )}

        {/* ── Paso 2: código TOTP ─────────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handle2fa} className="space-y-4">
            {/* Icono candado */}
            <div className="flex justify-center mb-2">
              <span className="text-4xl">🔐</span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--navy)' }}>
                Código de verificación
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition text-center tracking-widest text-lg font-mono"
                style={{ border: '1.5px solid var(--border)', color: 'var(--navy)' }}
                onFocus={e => e.target.style.borderColor = 'var(--navy)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="000000"
                autoFocus
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text)' }}>
                Código de 6 dígitos de Google Authenticator o Authy
              </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--navy)' }}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setError(''); setCode(''); }}
              className="w-full text-sm py-1"
              style={{ color: 'var(--text)' }}
            >
              ← Volver al inicio de sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
