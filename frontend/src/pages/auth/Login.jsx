import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

const LANGS = ['ES', 'EN', 'DA'];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/paciente');
    } catch {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Language switcher */}
      <div className="flex gap-2 mb-8">
        {LANGS.map((lang) => {
          const code = lang.toLowerCase();
          const active = i18n.language === code;
          return (
            <button
              key={lang}
              onClick={() => i18n.changeLanguage(code)}
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
            {t('login.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
        </form>
      </div>
    </div>
  );
}
