import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../../components/common/Button';
import api from '../../utils/api';

const LANGS = ['ES', 'EN', 'DA'];

// Consentimiento por defecto si no hay documento en BD
const FALLBACK_CONSENT = `CONSENTIMIENTO INFORMADO Y POLÍTICA DE PRIVACIDAD
Studio Renacer — Andrea Fernández, Psicóloga (Col. 27327)

1. INFORMACIÓN DEL RESPONSABLE
Responsable del tratamiento: Andrea Fernández García · NIF 23816407E · Nº de colegiación 27327 · andrea@studiorenacer.com

2. FINALIDAD DEL TRATAMIENTO
Sus datos personales (nombre, email, historial de sesiones) se tratan con la finalidad de gestionar la relación terapéutica, programar y registrar las sesiones de psicología y hacer seguimiento del proceso.

3. BASE LEGAL
El tratamiento se basa en su consentimiento explícito (Art. 6.1.a RGPD) y en la ejecución del contrato de servicios psicológicos (Art. 6.1.b RGPD). Los datos de salud se tratan al amparo del Art. 9.2.a RGPD (consentimiento explícito).

4. CONSERVACIÓN DE DATOS
Sus datos se conservarán durante la vigencia de la relación terapéutica y, posteriormente, durante el plazo legalmente exigido (mínimo 5 años conforme a la legislación sanitaria española).

5. DESTINATARIOS
No se ceden datos a terceros salvo obligación legal. Los datos se alojan en servidores seguros con cifrado en tránsito y en reposo.

6. SUS DERECHOS
Tiene derecho a acceder, rectificar, suprimir, oponerse y limitar el tratamiento de sus datos, así como a la portabilidad. Puede ejercerlos dirigiéndose a andrea@studiorenacer.com. Tiene derecho a presentar reclamación ante la Agencia Española de Protección de Datos (aepd.es).

7. CONSENTIMIENTO INFORMADO PARA EL TRATAMIENTO PSICOLÓGICO
El proceso terapéutico es voluntario y confidencial. La información compartida en sesión es estrictamente confidencial, salvo en los casos legalmente previstos (riesgo vital para usted u otras personas). Las sesiones se realizan de forma telemática o presencial según se acuerde. Usted puede interrumpir el proceso terapéutico en cualquier momento comunicándolo a la psicóloga.

Al aceptar este documento, confirma haber leído y comprendido la información anterior y presta su consentimiento libre, informado y específico para el tratamiento de sus datos personales y de salud con las finalidades descritas.`;

export default function Activate() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState(1); // 1 = contraseña, 2 = RGPD
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [rgpdDoc, setRgpdDoc] = useState(null); // { id, titulo, contenido }

  const token = params.get('token');
  // El email de bienvenida incluye &lang=<idioma del paciente>: la pantalla (y el
  // texto del consentimiento) deben salir en SU idioma, no en el del navegador.
  const langParam = params.get('lang');

  useEffect(() => {
    if (['es', 'en', 'da'].includes(langParam) && i18n.language !== langParam) {
      i18n.changeLanguage(langParam);
    }
    // solo al montar: después manda el selector manual de idioma
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Carga el consentimiento vigente en el idioma seleccionado (ruta pública).
    // Se recarga al cambiar de idioma para mostrar el texto correspondiente.
    api.get(`/documentos/consentimiento?idioma=${i18n.language}`)
      .then((r) => setRgpdDoc(r.data))
      .catch(() => {
        // Si falla, usamos el texto por defecto — el flujo no se rompe
      });
  }, [i18n.language]);

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <p className="text-red-500">{t('activate.invalidLink')}</p>
    </div>
  );

  // ── PASO 1: establecer contraseña ──────────────────────────────────────────
  const handlePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError(t('activate.errorMatch')); return; }
    if (form.password.length < 8) { setError(t('activate.errorLength')); return; }
    setLoading(true);
    try {
      // El servidor activa la cuenta y setea la cookie httpOnly automáticamente
      await api.post('/auth/activar', { token, password: form.password });
      setStep(2);
    } catch {
      setError(t('activate.errorToken'));
    } finally {
      setLoading(false);
    }
  };

  // ── PASO 2: aceptar RGPD y acceder ────────────────────────────────────────
  const handleRgpd = async (e) => {
    e.preventDefault();
    if (!rgpdAccepted) { setError(t('activate.rgpdRequired')); return; }
    setError('');
    setLoading(true);
    try {
      // Registrar aceptación — la cookie httpOnly se envía automáticamente
      if (rgpdDoc?.id) {
        await api.post('/documentos/aceptar', { documento_id: rgpdDoc.id });
      }
      navigate('/paciente');
    } catch {
      setError(t('activate.errorRgpd'));
    } finally {
      setLoading(false);
    }
  };

  const consentText = rgpdDoc?.contenido || FALLBACK_CONSENT;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: 'var(--bg)' }}>

      {/* Selector de idioma */}
      <div className="flex gap-2 mb-8">
        {LANGS.map((lang) => {
          const code = lang.toLowerCase();
          const active = i18n.language === code;
          return (
            <button key={lang} onClick={() => i18n.changeLanguage(code)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
              style={{
                backgroundColor: active ? 'var(--brand)' : 'white',
                color: active ? 'white' : 'var(--brand)',
                border: '1px solid var(--brand)',
              }}>
              {lang}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl w-full shadow-sm"
        style={{
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(26,45,74,0.08)',
          maxWidth: step === 2 ? '640px' : '384px',
          transition: 'max-width 0.3s ease',
        }}>

        {/* Cabecera */}
        <div className="text-center pt-8 px-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <img src="/logo-studio-renacer.svg" alt="Studio Renacer" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>
            {t('activate.title')}
          </h1>
          {/* Indicador de pasos */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: step >= s ? 'var(--brand)' : 'var(--border)',
                    color: step >= s ? 'white' : 'var(--text)',
                  }}>
                  {step > s ? '✓' : s}
                </div>
                <span className="text-xs font-medium" style={{ color: step >= s ? 'var(--brand)' : 'var(--text)' }}>
                  {t(`activate.step${s}`)}
                </span>
                {s < 2 && <div className="w-8 h-px" style={{ backgroundColor: step > s ? 'var(--brand)' : 'var(--border)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── PASO 1: Contraseña ── */}
        {step === 1 && (
          <form onSubmit={handlePassword} className="p-8 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand)' }}>
                {t('activate.newPassword')}
              </label>
              <input
                type="password" required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="field-input"
                placeholder={t('activate.placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand)' }}>
                {t('activate.confirmPassword')}
              </label>
              <input
                type="password" required
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className="field-input"
                placeholder={t('activate.placeholderConfirm')}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" size="lg" loading={loading}>
              {t('activate.next')}
            </Button>
          </form>
        )}

        {/* ── PASO 2: Consentimiento RGPD ── */}
        {step === 2 && (
          <form onSubmit={handleRgpd} className="p-8">
            <p className="text-sm mb-3" style={{ color: 'var(--text)' }}>
              {t('activate.rgpdIntro')}
            </p>

            {/* Texto del documento — scrollable */}
            <div
              className="rounded-xl p-4 mb-5 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                maxHeight: '320px',
                fontFamily: 'ui-monospace, monospace',
              }}>
              {consentText}
            </div>

            {/* Checkbox de aceptación */}
            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={rgpdAccepted}
                onChange={(e) => { setRgpdAccepted(e.target.checked); setError(''); }}
                className="mt-0.5 w-4 h-4 rounded accent-[var(--brand)] shrink-0"
              />
              <span className="text-sm font-medium leading-snug" style={{ color: 'var(--brand)' }}>
                {t('activate.rgpdCheckbox')}
              </span>
            </label>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="text-sm font-medium hover:opacity-70 transition"
                style={{ color: 'var(--text)' }}>
                ← Volver
              </button>
              <div className="flex-1">
                <Button type="submit" size="lg" loading={loading} disabled={!rgpdAccepted}>
                  {t('activate.submitRgpd')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
