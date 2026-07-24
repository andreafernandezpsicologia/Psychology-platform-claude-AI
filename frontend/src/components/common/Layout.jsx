import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

const LANGS = ['ES', 'EN', 'DA'];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.role === 'admin';
  const path = location.pathname;

  // Navegación admin: Inicio · Pacientes · Agenda. "Pacientes" queda activo
  // también en la ficha de un paciente (/admin/paciente/:id).
  const navItems = [
    { to: '/admin', label: t('layout.navHome', 'Inicio'), active: path === '/admin' },
    { to: '/admin/pacientes', label: t('layout.navPatients', 'Pacientes'), active: path === '/admin/pacientes' || path.startsWith('/admin/paciente/') },
    { to: '/admin/calendario', label: t('layout.navAgenda', 'Agenda'), active: path === '/admin/calendario' },
    { to: '/admin/formaciones', label: t('layout.navFormaciones', 'Formaciones'), active: path === '/admin/formaciones' },
  ];

  // Flecha de volver: solo para el paciente (el admin navega con la barra y las
  // fichas tienen su propio "Volver").
  const home = isAdmin ? '/admin' : '/paciente';
  const showBack = !isAdmin && path !== home;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="header-glass px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(home)}
              className="back-arrow"
              title={t('layout.back')}
              aria-label={t('layout.back')}
            >
              ←
            </button>
          )}
          <a
            href="https://www.studiorenacer.com"
            className="flex items-center gap-2.5 transition hover:opacity-80"
            title="Ir a studiorenacer.com"
          >
            <img src="/logo-studio-renacer.svg" alt="" className="h-9 w-auto" />
            <span className="font-semibold text-lg" style={{ color: 'var(--brand)', fontFamily: "'Cormorant Garamond', serif" }}>
              Studio Renacer
            </span>
          </a>
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--brand)', color: 'white' }}>
              {t('layout.admin')}
            </span>
          )}

          {/* Navegación admin */}
          {isAdmin && (
            <nav className="hidden sm:flex items-center gap-1 ml-4">
              {navItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg transition"
                  style={item.active
                    ? { backgroundColor: 'var(--brand)', color: 'white' }
                    : { color: 'var(--brand)', backgroundColor: 'transparent' }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
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
                    backgroundColor: active ? 'var(--brand)' : 'transparent',
                    color: active ? 'white' : 'var(--brand)',
                  }}
                >
                  {lang}
                </button>
              );
            })}
          </div>

          <span className="hidden md:inline text-sm" style={{ color: 'var(--text)' }}>{user?.nombre_completo}</span>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin/seguridad')}
              className="text-sm font-medium transition hover:opacity-70"
              style={{ color: 'var(--brand)' }}
              title="Seguridad y 2FA"
            >
              🔐
            </button>
          )}
          <button onClick={handleLogout} className="text-sm font-medium transition hover:opacity-70" style={{ color: 'var(--brand)' }}>
            {t('layout.logout')}
          </button>
        </div>
      </header>

      {/* Navegación admin en móvil (la barra del header se oculta en pantallas pequeñas) */}
      {isAdmin && (
        <nav className="sm:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card, #fff)' }}>
          {navItems.map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="text-sm font-medium px-3 py-1.5 rounded-lg transition whitespace-nowrap"
              style={item.active
                ? { backgroundColor: 'var(--brand)', color: 'white' }
                : { color: 'var(--brand)', backgroundColor: 'transparent' }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <main className="p-6 max-w-5xl mx-auto page-enter">{children}</main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
