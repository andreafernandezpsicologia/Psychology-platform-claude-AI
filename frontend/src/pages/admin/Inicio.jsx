import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Layout from '../../components/common/Layout';
import Badge from '../../components/common/Badge';
import { SkeletonCard } from '../../components/common/Skeleton';
import api from '../../utils/api';

// ── Helpers de formato ───────────────────────────────────────────────────────
const eur = (cents) => (cents == null ? '—'
  : (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }));
const hora = (naive) => String(naive).slice(11, 16);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (naive) => { const [, m, d] = String(naive).slice(0, 10).split('-'); return `${+d} ${MESES[+m - 1] || ''}`; };
const mesLabel = (mes, lang) => {
  const [y, m] = String(mes).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'da' ? 'da-DK' : lang === 'en' ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const mesCortito = (mes) => MESES[Number(String(mes).slice(5, 7)) - 1] || mes;
const fmtDiaMadrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
// Mes actual en Madrid (YYYY-MM)
const mesAhora = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(new Date());
const diaSemanaCorto = (naive, lang) => {
  const [y, m, d] = String(naive).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === 'da' ? 'da-DK' : lang === 'en' ? 'en-GB' : 'es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
};

// ── Piezas de UI (fuera del componente: no se remontan en cada render) ───────
function Delta({ actual, previo, invertir = false, formato = (v) => v }) {
  if (previo == null) return null;
  const diff = (actual || 0) - (previo || 0);
  if (diff === 0) return <span className="text-[11px]" style={{ color: 'var(--muted)' }}>=</span>;
  const sube = diff > 0;
  const bueno = invertir ? !sube : sube;
  return (
    <span className="text-[11px] font-semibold" style={{ color: bueno ? '#3B6D2A' : '#A33B2D' }}>
      {sube ? '↑' : '↓'} {formato(Math.abs(diff))}
    </span>
  );
}

function Kpi({ label, value, delta, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl p-4 text-left transition hover:shadow-sm"
      style={{ border: active ? '2px solid var(--brand)' : '1px solid var(--border)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold truncate" style={{ color: 'var(--brand)' }}>{value}</p>
        {delta}
      </div>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{label} {active ? '▴' : '▾'}</p>
    </button>
  );
}

function Card({ title, children, count, extra }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>{title}</h3>
        <div className="flex items-center gap-2">
          {extra}
          {count > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--brand)' }}>{count}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

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

// Mini-gráfica de barras: ingresos de los últimos 6 meses
function BarrasIngresos({ serie, mesSel }) {
  const max = Math.max(...serie.map((p) => p.total_cents), 1);
  return (
    <div className="flex items-end gap-3 mb-4 px-1" style={{ height: 90 }}>
      {serie.map((p) => {
        const h = p.total_cents > 0 ? Math.max((p.total_cents / max) * 64, 4) : 2;
        const esSel = p.mes === mesSel;
        return (
          <div key={p.mes} className="flex flex-col items-center gap-1 flex-1 min-w-0" title={`${p.mes}: ${eur(p.total_cents)}`}>
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>{p.total_cents > 0 ? eur(p.total_cents) : ''}</span>
            <div className="w-full rounded-t" style={{ height: h, backgroundColor: esSel ? 'var(--brand)' : '#D9C9A8' }} />
            <span className="text-[10px] font-medium" style={{ color: esSel ? 'var(--brand)' : 'var(--muted)' }}>{mesCortito(p.mes)}</span>
          </div>
        );
      })}
    </div>
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
  const [mes, setMes] = useState(mesAhora());
  const [sel, setSel] = useState(null); // KPI abierto: ingresos|sesiones|noshows|activos|pendiente
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/resumen', { params: { mes } })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t('home.loadError', 'Error al cargar el resumen')))
      .finally(() => setLoading(false));
  }, [mes]);

  const irFicha = (userId) => userId && navigate(`/admin/paciente/${userId}`);
  const toggle = (key) => setSel(sel === key ? null : key);

  if (!data && loading) return <Layout><SkeletonCard /></Layout>;
  if (!data) return <Layout><p style={{ color: 'var(--muted)' }}>{t('home.loadError', 'Error al cargar el resumen')}</p></Layout>;

  const k = data.kpis || {};
  const kp = data.kpis_prev || {};
  const det = data.detalle || {};
  const esMesActual = data.mes === data.mes_actual;
  const hoy = data.hoy || [];
  const semana = data.semana || [];
  const at = data.atencion || {};
  const sinPagar = at.sesiones_sin_pagar || [];
  const feedback = at.feedback_reciente || [];
  const candidatos = at.candidatos_bono || [];
  const nadaAtencion = sinPagar.length === 0 && feedback.length === 0 && candidatos.length === 0;

  const conceptoPendiente = (r) => {
    if (r.tipo === 'sesion') return `${t('home.conSesion', 'Sesión')} ${fechaCorta(r.fecha)}`;
    if (r.tipo === 'cuota') return `${t('home.conCuota', 'Cuota')} ${r.numero}/${r.total_cuotas}${r.fecha ? ` · ${t('home.vence', 'vence')} ${fechaCorta(r.fecha)}` : ''}`;
    return `${t('home.conBono', 'Bono')}${r.sesiones ? ` ${r.sesiones}` : ''}${r.parcial ? ` · ${t('home.pagoParcial', 'pago parcial')}` : ''}`;
  };

  // ── Contenido del panel de detalle según el KPI abierto ──
  const detalles = {
    ingresos: (
      <>
        <BarrasIngresos serie={data.ingresos_6m || []} mesSel={data.mes} />
        {det.ingresos?.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.detVacio', 'Nada este mes.')}</p>
        ) : det.ingresos.map((r, i) => (
          <Fila key={i} onClick={() => irFicha(r.paciente.user_id)}>
            <span className="flex flex-col min-w-0">
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{r.paciente.nombre}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {r.tipo === 'cuota'
                  ? `${t('home.conCuota', 'Cuota')} ${r.numero}/${r.total_cuotas} · ${t('home.conBono', 'Bono')}${r.sesiones ? ` ${r.sesiones}` : ''}`
                  : r.tipo === 'bono'
                    ? `${t('home.conBono', 'Bono')}${r.sesiones ? ` ${r.sesiones}` : ''}`
                    : `${t('home.conSesion', 'Sesión')} ${fechaCorta(r.fecha_sesion)}`}
                {' · '}{t('home.pagadoEl', 'pagado el')} {fmtDiaMadrid.format(new Date(r.fecha))}
              </span>
            </span>
            <span className="text-sm font-semibold shrink-0 tabular-nums" style={{ color: 'var(--brand)' }}>{eur(r.importe_cents)}</span>
          </Fila>
        ))}
      </>
    ),
    sesiones: det.sesiones?.length === 0
      ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.detVacio', 'Nada este mes.')}</p>
      : det.sesiones?.map((s, i) => (
        <Fila key={i} onClick={() => irFicha(s.paciente.user_id)}>
          <span className="flex items-center gap-3 min-w-0">
            <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--muted)' }}>{fechaCorta(s.fecha_hora)} · {hora(s.fecha_hora)}</span>
            <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.paciente.nombre}</span>
          </span>
          <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>
            {s.tipo === 'videollamada' ? t('patientDetail.videocall', 'Videollamada') : t('patientDetail.inPerson', 'Presencial')}
            {s.con_bono ? ` · ${t('home.conBono', 'Bono')}` : ''}
          </span>
        </Fila>
      )),
    noshows: det.no_shows?.length === 0
      ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.sinNoShows', 'Sin faltas este mes 🎉')}</p>
      : det.no_shows?.map((s, i) => (
        <Fila key={i} onClick={() => irFicha(s.paciente.user_id)}>
          <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.paciente.nombre}</span>
          <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{fechaCorta(s.fecha_hora)} · {hora(s.fecha_hora)}</span>
        </Fila>
      )),
    activos: det.pacientes?.map((p) => (
      <Fila key={p.user_id} onClick={() => irFicha(p.user_id)}>
        <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{p.nombre}</span>
        <span className="text-xs shrink-0 text-right" style={{ color: 'var(--muted)' }}>
          {p.proxima
            ? `${t('home.proxima', 'próxima')}: ${fechaCorta(p.proxima)}`
            : p.ultima
              ? `${t('home.ultima', 'última')}: ${fechaCorta(p.ultima)}`
              : t('home.sinSesiones', 'sin sesiones')}
        </span>
      </Fila>
    )),
    pendiente: det.pendiente?.length === 0
      ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.todoCobrado', 'Todo cobrado ✨')}</p>
      : det.pendiente?.map((r, i) => (
        <Fila key={i} onClick={() => irFicha(r.paciente.user_id)}>
          <span className="flex flex-col min-w-0">
            <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{r.paciente.nombre}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{conceptoPendiente(r)}</span>
          </span>
          <span className="text-sm font-semibold shrink-0 tabular-nums" style={{ color: '#A33B2D' }}>{eur(r.importe_cents)}</span>
        </Fila>
      )),
  };

  const titulosDetalle = {
    ingresos: t('home.detIngresos', 'Pagos del mes'),
    sesiones: t('home.detSesiones', 'Sesiones hechas'),
    noshows: t('home.detNoShows', 'No-shows del mes'),
    activos: t('home.detActivos', 'Pacientes activos'),
    pendiente: t('home.detPendiente', 'Pendiente de cobro'),
  };

  return (
    <Layout>
      {/* Título + navegación de meses */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2 className="heading-serif" style={{ fontSize: '1.5rem' }}>{t('home.title', 'Inicio')}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMes(mesLoQueSea(data.mes, -1)); setSel(null); }}
            className="w-8 h-8 rounded-lg font-semibold transition hover:opacity-70"
            style={{ border: '1px solid var(--border)', color: 'var(--brand)', backgroundColor: 'white' }}>←</button>
          <span className="text-sm font-semibold capitalize min-w-32 text-center" style={{ color: 'var(--brand)' }}>
            {mesLabel(data.mes, lang)}
          </span>
          <button onClick={() => { setMes(mesLoQueSea(data.mes, 1)); setSel(null); }}
            disabled={esMesActual}
            className="w-8 h-8 rounded-lg font-semibold transition hover:opacity-70 disabled:opacity-30"
            style={{ border: '1px solid var(--border)', color: 'var(--brand)', backgroundColor: 'white' }}>→</button>
        </div>
      </div>

      <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .15s' }}>
        {/* KPIs clicables */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <Kpi label={t('home.kpiIngresos', 'Ingresos del mes')} value={eur(k.ingresos_cents)}
            delta={<Delta actual={k.ingresos_cents} previo={kp.ingresos_cents} formato={eur} />}
            active={sel === 'ingresos'} onClick={() => toggle('ingresos')} />
          <Kpi label={t('home.kpiSesiones', 'Sesiones hechas')} value={k.sesiones_hechas ?? 0}
            delta={<Delta actual={k.sesiones_hechas} previo={kp.sesiones_hechas} />}
            active={sel === 'sesiones'} onClick={() => toggle('sesiones')} />
          <Kpi label={t('home.kpiNoShows', 'No-shows')} value={k.no_shows ?? 0}
            delta={<Delta actual={k.no_shows} previo={kp.no_shows} invertir />}
            active={sel === 'noshows'} onClick={() => toggle('noshows')} />
          <Kpi label={t('home.kpiActivos', 'Pacientes activos')} value={k.pacientes_activos ?? 0}
            active={sel === 'activos'} onClick={() => toggle('activos')} />
          <Kpi label={t('home.kpiPendiente', 'Pendiente de cobro')} value={eur(k.pendiente_cents)}
            active={sel === 'pendiente'} onClick={() => toggle('pendiente')} />
        </div>

        {/* Panel de detalle del KPI abierto */}
        {sel && (
          <div className="bg-white rounded-xl p-5 mb-6" style={{ border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>{titulosDetalle[sel]}</h3>
              <button onClick={() => setSel(null)} className="text-xs transition hover:opacity-70" style={{ color: 'var(--muted)' }}>✕ {t('home.cerrar', 'Cerrar')}</button>
            </div>
            {detalles[sel]}
          </div>
        )}
        {!sel && <div className="mb-3" />}

        {/* Hoy + Próximos 7 días */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card title={t('home.hoy', 'Hoy')} count={hoy.length}>
            {hoy.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.hoyVacio', 'No hay sesiones hoy.')}</p>
            ) : hoy.map((s) => (
              <Fila key={s.id} onClick={() => irFicha(s.paciente.user_id)}>
                <span className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-sm tabular-nums" style={{ color: 'var(--brand)' }}>{hora(s.fecha_hora)}</span>
                  <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.paciente.nombre}</span>
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
          </Card>

          <Card title={t('home.semana', 'Próximos 7 días')} count={semana.length}>
            {semana.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('home.semanaVacio', 'Sin sesiones programadas.')}</p>
            ) : semana.map((s) => (
              <Fila key={s.id} onClick={() => irFicha(s.paciente.user_id)}>
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-semibold capitalize tabular-nums shrink-0" style={{ color: 'var(--brand)' }}>
                    {diaSemanaCorto(s.fecha_hora, lang)} · {hora(s.fecha_hora)}
                  </span>
                  <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.paciente.nombre}</span>
                </span>
                <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>
                  {s.tipo === 'videollamada' ? t('patientDetail.videocall', 'Videollamada') : t('patientDetail.inPerson', 'Presencial')}
                </span>
              </Fila>
            ))}
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
      </div>
    </Layout>
  );
}

// Mes ± n en formato YYYY-MM
function mesLoQueSea(mes, n) {
  const [y, m] = String(mes).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
