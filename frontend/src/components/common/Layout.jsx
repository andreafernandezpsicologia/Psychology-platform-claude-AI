import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

const LANGS = ['ES', 'EN', 'DA'];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: 'var(--navy)' }}>
            R
          </div>
          <span className="font-semibold text-base" style={{ color: 'var(--navy)', fontFamily: "'Playfair Display', serif" }}>
            Studio Renacer
          </span>
          {user?.role === 'admin' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--navy)', color: 'white' }}>
              {t('layout.admin')}
            </span>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">
          {/* Language switcher */}
          <div className="flex items-center gap-1">
            {LANGS.map((lang) => {
              const code = lang.toLowerCase();
              const active = i18n.language === code;
              return (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(code)}
                  className="text-xs font-semibold px-2 py-1 rounded transition"
                  style={{
                    backgroundColor: active ? 'var(--navy)' : 'transparent',
                    color: active ? 'white' : 'var(--navy)',
                  }}
                >
                  {lang}
                </button>
              );
            })}
          </div>

          <span className="text-sm" style={{ color: 'var(--text)' }}>{user?.nombre_completo}</span>
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin/seguridad')}
              className="text-sm font-medium transition hover:opacity-70"
              style={{ color: 'var(--navy)' }}
              title="Seguridad y 2FA"
            >
              🔐
            </button>
          )}
          <button onClick={handleLogout} className="text-sm font-medium transition hover:opacity-70" style={{ color: 'var(--navy)' }}>
            {t('layout.logout')}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">{children}</main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
