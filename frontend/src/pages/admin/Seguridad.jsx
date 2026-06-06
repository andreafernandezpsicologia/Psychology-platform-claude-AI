import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '../../components/common/Layout';
import api from '../../utils/api';

export default function Seguridad() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Setup flow
  const [showSetup, setShowSetup] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(false);

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [loadingDisable, setLoadingDisable] = useState(false);

  useEffect(() => {
    api.get('/auth/2fa/status')
      .then(res => setTotpEnabled(res.data.totp_enabled))
      .catch(() => toast.error('Error al obtener estado 2FA'))
      .finally(() => setLoadingStatus(false));
  }, []);

  // ── Iniciar configuración: genera QR ──────────────────────────────────────────
  const handleStartSetup = async () => {
    setLoadingSetup(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      setQrCodeDataUrl(res.data.qrCodeDataUrl);
      setSecret(res.data.secret);
      setShowSetup(true);
    } catch {
      toast.error('Error al generar el código QR');
    } finally {
      setLoadingSetup(false);
    }
  };

  // ── Verificar código y activar 2FA ─────────────────────────────────────────────
  const handleVerifySetup = async (e) => {
    e.preventDefault();
    setLoadingSetup(true);
    try {
      await api.post('/auth/2fa/verify-setup', { code: setupCode });
      setTotpEnabled(true);
      setShowSetup(false);
      setSetupCode('');
      setQrCodeDataUrl('');
      toast.success('✅ 2FA activado correctamente');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto. Inténtalo de nuevo.');
      setSetupCode('');
    } finally {
      setLoadingSetup(false);
    }
  };

  // ── Desactivar 2FA ─────────────────────────────────────────────────────────────
  const handleDisable = async (e) => {
    e.preventDefault();
    setLoadingDisable(true);
    try {
      await api.delete('/auth/2fa', { data: { code: disableCode } });
      setTotpEnabled(false);
      setShowDisable(false);
      setDisableCode('');
      toast.success('2FA desactivado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
      setDisableCode('');
    } finally {
      setLoadingDisable(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-8 px-4">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}
        >
          Seguridad
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text)' }}>
          Configuración de seguridad de tu cuenta de administración
        </p>

        {/* ── Tarjeta 2FA ─────────────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl p-6"
          style={{ border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(26,45,74,0.06)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: totpEnabled ? '#e8f5e9' : '#f5f5f5' }}
              >
                🔐
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--navy)' }}>
                  Autenticación en dos pasos (2FA)
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
                  Protege tu cuenta con Google Authenticator o Authy
                </p>
              </div>
            </div>

            {/* Badge de estado */}
            {!loadingStatus && (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: totpEnabled ? '#e8f5e9' : '#fff3e0',
                  color: totpEnabled ? '#2e7d32' : '#e65100',
                }}
              >
                {totpEnabled ? '✓ Activo' : '⚠ Inactivo'}
              </span>
            )}
          </div>

          <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--text)' }}>
            Con el doble factor activado, cada vez que inicies sesión necesitarás introducir
            un código temporal generado por tu aplicación de autenticación. Esto protege tu
            cuenta aunque alguien conozca tu contraseña.
          </p>

          {/* Aviso de normativa */}
          <div
            className="mt-4 p-3 rounded-xl text-xs"
            style={{ backgroundColor: '#f0f4ff', color: 'var(--navy)' }}
          >
            <strong>Normativa:</strong> La NIS2 y el ENS recomiendan el doble factor para
            acceso a plataformas que tratan datos de salud. Tu Política de Privacidad lo
            describe como medida de seguridad implementada.
          </div>

          {/* Botón de acción */}
          {!loadingStatus && (
            <div className="mt-5">
              {!totpEnabled ? (
                <button
                  onClick={handleStartSetup}
                  disabled={loadingSetup}
                  className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--navy)' }}
                >
                  {loadingSetup ? 'Generando QR...' : 'Activar 2FA'}
                </button>
              ) : (
                <button
                  onClick={() => setShowDisable(true)}
                  className="w-full font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-80"
                  style={{ backgroundColor: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}
                >
                  Desactivar 2FA
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Modal: configurar 2FA ─────────────────────────────────────────────── */}
        {showSetup && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--navy)' }}>
                Configura tu aplicación
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
                Escanea este código QR con <strong>Google Authenticator</strong> o <strong>Authy</strong>
              </p>

              {/* QR Code */}
              {qrCodeDataUrl && (
                <div className="flex justify-center mb-4">
                  <img src={qrCodeDataUrl} alt="Código QR para 2FA" className="w-48 h-48 rounded-lg" />
                </div>
              )}

              {/* Clave manual */}
              <div className="mb-4 p-3 rounded-xl text-center" style={{ backgroundColor: '#f5f5f5' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text)' }}>
                  ¿No puedes escanear? Introduce esta clave manualmente:
                </p>
                <p className="font-mono text-sm font-semibold tracking-widest" style={{ color: 'var(--navy)' }}>
                  {secret}
                </p>
              </div>

              {/* Verificación */}
              <form onSubmit={handleVerifySetup} className="space-y-3">
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
                    value={setupCode}
                    onChange={e => setSetupCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-center tracking-widest font-mono"
                    style={{ border: '1.5px solid var(--border)', color: 'var(--navy)' }}
                    placeholder="000000"
                    autoFocus
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text)' }}>
                    Introduce el código que muestra tu app para confirmar la configuración
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loadingSetup || setupCode.length !== 6}
                  className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--navy)' }}
                >
                  {loadingSetup ? 'Verificando...' : 'Activar 2FA'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSetup(false); setSetupCode(''); }}
                  className="w-full text-sm py-1"
                  style={{ color: 'var(--text)' }}
                >
                  Cancelar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: desactivar 2FA ────────────────────────────────────────────── */}
        {showDisable && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#c62828' }}>
                Desactivar 2FA
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
                Introduce tu código actual de autenticación para confirmar que quieres desactivar el 2FA.
              </p>

              <form onSubmit={handleDisable} className="space-y-3">
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-center tracking-widest font-mono"
                  style={{ border: '1.5px solid var(--border)', color: 'var(--navy)' }}
                  placeholder="000000"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loadingDisable || disableCode.length !== 6}
                  className="w-full font-semibold py-2.5 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#c62828', color: 'white' }}
                >
                  {loadingDisable ? 'Desactivando...' : 'Confirmar desactivación'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisable(false); setDisableCode(''); }}
                  className="w-full text-sm py-1"
                  style={{ color: 'var(--text)' }}
                >
                  Cancelar
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
