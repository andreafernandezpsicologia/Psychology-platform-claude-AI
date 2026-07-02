import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import Button from '../common/Button';

// Puerta de consentimiento: antes de mostrar el área del paciente, comprueba que
// haya aceptado el consentimiento informado vigente. Si no, lo muestra y obliga a
// aceptarlo antes de continuar (RGPD Art. 7.1). Reutiliza el documento de la BD y
// los textos de la pantalla de activación (claves i18n `activate.*`).
export default function ConsentGate({ children }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState('cargando'); // cargando | requerido | ok
  const [doc, setDoc] = useState(null);
  const [aceptado, setAceptado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;
    api.get('/documentos/consentimiento-requerido')
      .then((res) => {
        if (!activo) return;
        if (res.data.requerido && res.data.documento) {
          setDoc(res.data.documento);
          setEstado('requerido');
        } else {
          setEstado('ok');
        }
      })
      // fail-open: un fallo de red no debe dejar al paciente fuera de su espacio;
      // se vuelve a comprobar en la siguiente carga/login.
      .catch(() => { if (activo) setEstado('ok'); });
    return () => { activo = false; };
  }, []);

  const aceptar = async (e) => {
    e.preventDefault();
    if (!aceptado) { setError(t('activate.rgpdRequired')); return; }
    setError('');
    setEnviando(true);
    try {
      await api.post('/documentos/aceptar', { documento_id: doc.id });
      setEstado('ok');
    } catch {
      setError(t('activate.errorRgpd'));
    } finally {
      setEnviando(false);
    }
  };

  if (estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (estado === 'ok') return children;

  // estado === 'requerido' → pantalla de consentimiento bloqueante
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="bg-white rounded-2xl w-full shadow-sm"
        style={{ border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(26,45,74,0.08)', maxWidth: '640px' }}>

        <div className="text-center pt-8 px-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <img src="/logo-studio-renacer.svg" alt="Studio Renacer" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>
            {t('activate.rgpdTitle')}
          </h1>
        </div>

        <form onSubmit={aceptar} className="p-8">
          <p className="text-sm mb-3" style={{ color: 'var(--text)' }}>{t('activate.rgpdIntro')}</p>

          <div className="rounded-xl p-4 mb-5 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', maxHeight: '320px', fontFamily: 'ui-monospace, monospace' }}>
            {doc?.contenido}
          </div>

          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <input type="checkbox" checked={aceptado}
              onChange={(e) => { setAceptado(e.target.checked); setError(''); }}
              className="mt-0.5 w-4 h-4 rounded accent-[var(--brand)] shrink-0" />
            <span className="text-sm font-medium leading-snug" style={{ color: 'var(--brand)' }}>
              {t('activate.rgpdCheckbox')}
            </span>
          </label>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <Button type="submit" size="lg" loading={enviando} disabled={!aceptado}>
            {t('activate.submitRgpd')}
          </Button>
        </form>
      </div>
    </div>
  );
}
