import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Layout from '../../components/common/Layout';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { SkeletonCard } from '../../components/common/Skeleton';
import api from '../../utils/api';

// Programas lanzables y su presentación. 'todos' y 'general' son intereses,
// no lanzamientos: se muestran en el resumen pero no tienen botón de envío.
const PROGRAMAS = {
  calma:    { nombre: 'CALMA',    tema: 'Ansiedad · Estrés' },
  vinculos: { nombre: 'VÍNCULOS', tema: 'Relaciones · Comunicación' },
  raices:   { nombre: 'RAÍCES',   tema: 'Heridas emocionales' },
};
const INTERES_LABEL = { calma: 'CALMA', vinculos: 'VÍNCULOS', raices: 'RAÍCES', todos: 'Todos', general: 'Guía (general)' };

const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' });

function Card({ title, children, count }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>{title}</h3>
        {count > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--brand)' }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ChipInteres({ programa }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--brand)' }}>
      {INTERES_LABEL[programa] || programa}
    </span>
  );
}

export default function AdminFormaciones() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmar, setConfirmar] = useState(null); // programa a lanzar
  const [enviando, setEnviando] = useState(false);
  const { t } = useTranslation();

  const cargar = async () => {
    try {
      const res = await api.get('/formaciones/waitlist');
      setData(res.data);
    } catch {
      toast.error(t('formaciones.errorCarga', 'No se pudo cargar la lista de espera'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const lanzar = async (programa) => {
    setEnviando(true);
    try {
      const res = await api.post('/formaciones/lanzamiento', { programa });
      const { enviados, fallidos } = res.data;
      if (fallidos?.length) {
        toast.warning(t('formaciones.envioParcial', 'Enviados {{ok}} avisos; fallaron {{ko}}', { ok: enviados, ko: fallidos.length }));
      } else {
        toast.success(t('formaciones.envioOk', '{{n}} avisos de lanzamiento enviados', { n: enviados }));
      }
      await cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || t('formaciones.errorEnvio', 'Error enviando los avisos'));
    } finally {
      setEnviando(false);
      setConfirmar(null);
    }
  };

  const rows = data?.rows || [];
  const interesados = data?.interesados || {};
  const pendientes = data?.pendientes || {};

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>
            {t('formaciones.heading', 'Lista de espera de Renacer en casa')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {t('formaciones.sub', 'Personas apuntadas desde la web. Cuando un programa esté listo, envía el aviso de lanzamiento desde aquí: solo se escribe a quien lo pidió y nunca dos veces a la misma persona.')}
          </p>
        </div>

        {loading ? (
          <SkeletonCard />
        ) : (
          <>
            {/* ── Programas: interesados, pendientes y botón de lanzamiento ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(PROGRAMAS).map(([key, p]) => (
                <div key={key} className="bg-white rounded-xl p-5 flex flex-col gap-2" style={{ border: '1px solid var(--border)' }}>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{p.tema}</p>
                    <h3 className="font-bold text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>{p.nombre}</h3>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    <b>{(interesados[key] || 0) + (interesados.todos || 0)}</b> {t('formaciones.interesadas', 'personas recibirán el aviso')}
                    <span style={{ color: 'var(--muted)' }}> · {pendientes[key] || 0} {t('formaciones.pendientes', 'pendientes')}</span>
                  </p>
                  <button
                    onClick={() => setConfirmar(key)}
                    disabled={!pendientes[key] || enviando}
                    className="mt-auto text-xs font-semibold px-3 py-2 rounded-lg transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                  >
                    {t('formaciones.lanzar', 'Enviar aviso de lanzamiento')}
                  </button>
                </div>
              ))}
            </div>

            {/* ── Altas ── */}
            <Card title={t('formaciones.altas', 'Personas en la lista')} count={rows.length}>
              {rows.length === 0 ? (
                <p className="text-sm py-2" style={{ color: 'var(--muted)' }}>
                  {t('formaciones.vacio', 'Todavía no hay nadie apuntado. Las altas de la web aparecerán aquí.')}
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {rows.map((r) => {
                    const avisos = r.formaciones_waitlist_avisos || [];
                    return (
                      <div key={r.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                            {r.nombre || '—'} <span className="font-normal" style={{ color: 'var(--muted)' }}>· {r.email}</span>
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                            {fechaCorta(r.created_at)} · {r.source || 'landing'}
                            {avisos.length > 0 && (
                              <> · {t('formaciones.avisado', 'avisada de')}: {avisos.map((a) => INTERES_LABEL[a.programa] || a.programa).join(', ')}</>
                            )}
                          </p>
                        </div>
                        <ChipInteres programa={r.programa} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmar}
        danger={false}
        title={t('formaciones.confirmTitle', 'Enviar aviso de lanzamiento')}
        description={confirmar ? t('formaciones.confirmDesc',
          'Se enviará el email de lanzamiento de {{prog}} a {{n}} personas (las interesadas en ese programa o en todos, que aún no lo hayan recibido). Esta acción envía emails reales.',
          { prog: PROGRAMAS[confirmar]?.nombre, n: pendientes[confirmar] || 0 }) : ''}
        confirmLabel={enviando ? t('formaciones.enviando', 'Enviando…') : t('formaciones.confirmar', 'Enviar avisos')}
        onConfirm={() => !enviando && lanzar(confirmar)}
        onCancel={() => !enviando && setConfirmar(null)}
      />
    </Layout>
  );
}
