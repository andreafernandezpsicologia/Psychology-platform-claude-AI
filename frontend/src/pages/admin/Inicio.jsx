import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Layout from '../../components/common/Layout';
import Badge from '../../components/common/Badge';
import { SkeletonCard } from '../../components/common/Skeleton';
import api from '../../utils/api';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const eur = (cents) => (cents == null ? '—' : (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }));
const hora = (naive) => String(naive).slice(11, 16);
const fechaCorta = (naive) => { const [y, m, d] = String(naive).slice(0, 10).split('-'); return `${+d} ${MESES[+m - 1] || ''}`; };
const fmtDiaMadrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });

function Kpi({ label, value, hint }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
      <p className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{label}</p>
      {hint && <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  );
}

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

// Fila clicable que lleva a la ficha del paciente
function Fila({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 py-2 text-left transition hover:opacity-70"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      {children}
    </button>
  );
}

const tipoFeedbackLabel = (tipo, t) => ({
  ors: t('home.fbOrs', 'ORS (antes de sesión)'),
  srs: t('home.fbSrs', 'SRS (tras sesión)'),
  cierre: t('home.fbCierre', 'Cierre de terapia'),
}[tipo] || tipo);

export default function AdminInicio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    api.get('/admin/resumen')
      .then((res) => setData(res.data))
      .catch(() => toast.error(t('home.loadError', 'Error al cargar el resumen')))
      .finally(() => setLoading(false));
  }, []);

  const irFicha = (userId) => userId && navigate(`/admin/paciente/${userId}`);

  if (loading) {
    return <Layout><SkeletonCard /></Layout>;
  }

  const k = data?.kpis || {};
  const hoy = data?.hoy || [];
  const at = data?.atencion || {};
  const sinPagar = at.sesiones_sin_pagar || [];
  const feedback = at.feedback_reciente || [];
  const candidatos = at.candidatos_bono || [];
  const nadaAtencion = sinPagar.length === 0 && feedback.length === 0 && candidatos.length === 0;

  return (
    <Layout>
      <h2 className="heading-serif mb-5" style={{ fontSize: '1.5rem' }}>{t('home.title', 'Inicio')}</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label={t('home.kpiIngresos', 'Ingresos del mes')} value={eur(k.ingresos_cents_mes)} />
        <Kpi label={t('home.kpiSesiones', 'Sesiones hechas')} value={k.sesiones_hechas_mes ?? 0} hint={t('home.esteMes', 'este mes')} />
        <Kpi label={t('home.kpiNoShows', 'No-shows')} value={k.no_shows_mes ?? 0} hint={t('home.esteMes', 'este mes')} />
        <Kpi label={t('home.kpiActivos', 'Pacientes activos')} value={k.pacientes_activos ?? 0} />
      </div>

      {/* Hoy */}
      <div className="mb-6">
        <Card title={t('home.hoy', 'Hoy')} count={hoy.length}>
          {hoy.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.hoyVacio', 'No hay sesiones hoy.')}</p>
          ) : (
            <div>
              {hoy.map((s) => (
                <Fila key={s.id} onClick={() => irFicha(s.paciente.user_id)}>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-sm tabular-nums" style={{ color: 'var(--brand)' }}>{hora(s.fecha_hora)}</span>
                    <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.paciente.nombre}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {s.tipo === 'videollamada' ? t('patientDetail.videocall', 'Videollamada') : t('patientDetail.inPerson', 'Presencial')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {s.enlace && s.tipo === 'videollamada' && (
                      <a href={s.enlace} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
                        {t('home.unirse', 'Unirse')} ↗
                      </a>
                    )}
                    <Badge estado={s.estado} label={t(`patientDetail.status${s.estado.charAt(0).toUpperCase() + s.estado.slice(1)}`)} />
                  </span>
                </Fila>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Requiere atención */}
      <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--brand)' }}>{t('home.atencion', 'Requiere atención')}</h3>
      {nadaAtencion ? (
        <div className="bg-white rounded-xl p-8 text-center" style={{ border: '1px solid var(--border)' }}>
          <p className="font-medium" style={{ color: 'var(--brand)' }}>{t('home.todoAlDia', 'Todo al día ✨')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Sesiones sin pagar */}
          <Card title={t('home.sinPagar', 'Sesiones sin pagar')} count={sinPagar.length}>
            {sinPagar.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.sinPagarVacio', 'Ninguna.')}</p>
            ) : sinPagar.map((s) => (
              <Fila key={s.id} onClick={() => irFicha(s.paciente.user_id)}>
                <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.paciente.nombre}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>
                  {fechaCorta(s.fecha_hora)}{s.precio_cents != null ? ` · ${eur(s.precio_cents)}` : ''}
                </span>
              </Fila>
            ))}
          </Card>

          {/* Feedback reciente */}
          <Card title={t('home.feedback', 'Feedback por revisar')} count={feedback.length}>
            {feedback.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.feedbackVacio', 'Sin novedades (7 días).')}</p>
            ) : feedback.map((f, i) => (
              <Fila key={i} onClick={() => irFicha(f.paciente.user_id)}>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{f.paciente.nombre}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{tipoFeedbackLabel(f.tipo, t)}</span>
                </span>
                <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{fmtDiaMadrid.format(new Date(f.fecha))}</span>
              </Fila>
            ))}
          </Card>

          {/* Candidatos a bono */}
          <Card title={t('home.candidatos', 'Candidatos a bono')} count={candidatos.length}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>{t('home.candidatosHint', '≥3 sesiones sueltas, sin bono')}</p>
            {candidatos.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.candidatosVacio', 'Ninguno.')}</p>
            ) : candidatos.map((c) => (
              <Fila key={c.user_id} onClick={() => irFicha(c.user_id)}>
                <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{c.nombre}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{c.sueltas} {t('home.sueltas', 'sueltas')}</span>
              </Fila>
            ))}
          </Card>
        </div>
      )}
    </Layout>
  );
}
