import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  format, addMonths, addWeeks, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, startOfDay, setHours,
} from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';
import Layout from '../../components/common/Layout';
import Button from '../../components/common/Button';
import { badgeStyle } from '../../components/common/Badge';
import { SkeletonCard } from '../../components/common/Skeleton';
import MonthGrid from '../../components/calendar/MonthGrid';
import WeekGrid from '../../components/calendar/WeekGrid';
import SessionModal from '../../components/calendar/SessionModal';
import EventModal from '../../components/calendar/EventModal';
import SyncModal from '../../components/calendar/SyncModal';
import api from '../../utils/api';

const localeMap = { es, en: enUS, da };
const ESTADOS_LEYENDA = ['programada', 'solicitada', 'completada', 'cancelada', 'ocupado'];

export default function Calendario() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || es;

  const [fecha, setFecha] = useState(new Date());
  const [vista, setVista] = useState('month');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pacientes, setPacientes] = useState([]);
  const [createAt, setCreateAt] = useState(null);       // Date → SessionModal en modo crear
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [reagendando, setReagendando] = useState(null); // sesión → SessionModal en modo reagendar
  const [showSync, setShowSync] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);

  // En móvil la vista semanal de 7 columnas no cabe: se fuerza mes compacto
  const vistaActual = isMobile ? 'month' : vista;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const fn = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const cargar = () => {
    const rango = vistaActual === 'week'
      ? { start: startOfWeek(fecha, { locale }), end: endOfWeek(fecha, { locale }) }
      : { start: startOfWeek(startOfMonth(fecha), { locale }), end: endOfWeek(endOfMonth(fecha), { locale }) };
    // fechas naive (hora de pared, como en BD) — nunca toISOString()
    const desde = format(rango.start, "yyyy-MM-dd'T'00:00:00");
    const hasta = format(rango.end, "yyyy-MM-dd'T'23:59:59");
    Promise.all([
      api.get('/sesiones', { params: { desde, hasta } }),
      // bloques "Ocupado" de los calendarios personales — si falla, no bloquea la vista
      api.get('/calendarios/ocupado', { params: { desde, hasta } }).catch(() => ({ data: [] })),
    ])
      .then(([sesiones, ocupado]) => {
        const bloques = (ocupado.data || []).map((b, i) => ({
          id: `ext-${i}-${b.inicio}`,
          fecha_hora: b.inicio,
          duracion_minutos: Math.max(15, Math.round((new Date(b.fin) - new Date(b.inicio)) / 60000)),
          estado: 'ocupado',
          titulo: b.titulo,
        }));
        setEvents([...sesiones.data, ...bloques]);
      })
      .catch(() => toast.error(t('calendar.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [fecha, vistaActual, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/pacientes').then((res) => setPacientes(res.data)).catch(() => {});
  }, []);

  const navegar = (dir) => setFecha(vistaActual === 'week' ? addWeeks(fecha, dir) : addMonths(fecha, dir));

  const titulo = vistaActual === 'week'
    ? `${format(startOfWeek(fecha, { locale }), 'd MMM', { locale })} – ${format(endOfWeek(fecha, { locale }), 'd MMM yyyy', { locale })}`
    : format(fecha, 'MMMM yyyy', { locale });

  const cerrarYRecargar = () => {
    setCreateAt(null);
    setSelectedEvent(null);
    setReagendando(null);
    cargar();
  };

  // Los bloques de calendarios externos no se gestionan desde aquí
  const seleccionarEvento = (e) => {
    if (e.estado !== 'ocupado') setSelectedEvent(e);
  };

  return (
    <Layout>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="heading-serif capitalize" style={{ fontSize: '1.25rem' }}>{titulo}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navegar(-1)} className="px-2.5 py-1 text-base rounded-lg transition hover:bg-white" style={{ color: 'var(--navy)', border: '1px solid var(--border)' }}>
            ‹
          </button>
          <Button variant="ghost" size="sm" onClick={() => setFecha(new Date())}>
            {t('calendar.today')}
          </Button>
          <button onClick={() => navegar(1)} className="px-2.5 py-1 text-base rounded-lg transition hover:bg-white" style={{ color: 'var(--navy)', border: '1px solid var(--border)' }}>
            ›
          </button>

          {!isMobile && (
            <div className="flex items-center gap-1 rounded-lg p-1 ml-1" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
              {['month', 'week'].map((v) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md transition"
                  style={vista === v ? { backgroundColor: 'var(--navy)', color: 'white' } : { color: 'var(--text)' }}
                >
                  {t(`calendar.${v}`)}
                </button>
              ))}
            </div>
          )}

          <Button size="sm" onClick={() => setCreateAt(setHours(startOfDay(fecha), 10))}>
            {t('calendar.newSession')}
          </Button>
          <button
            onClick={() => setShowSync(true)}
            className="px-2.5 py-1 text-base rounded-lg transition hover:bg-white"
            style={{ color: 'var(--navy)', border: '1px solid var(--border)' }}
            title={t('calendar.syncTitle')}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
        {loading ? (
          <SkeletonCard lines={8} />
        ) : vistaActual === 'week' ? (
          <WeekGrid
            date={fecha}
            events={events}
            locale={locale}
            onSelectSlot={(d) => setCreateAt(d)}
            onSelectEvent={seleccionarEvento}
          />
        ) : (
          <MonthGrid
            date={fecha}
            events={events}
            locale={locale}
            compact={isMobile}
            onSelectDay={(day) => setCreateAt(setHours(startOfDay(day), 10))}
            onSelectEvent={seleccionarEvento}
          />
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 flex-wrap mt-3">
        {ESTADOS_LEYENDA.map((e) => {
          const s = badgeStyle(e);
          const key = `patientDetail.status${e.charAt(0).toUpperCase() + e.slice(1)}`;
          return (
            <span key={e} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {t(key)}
            </span>
          );
        })}
      </div>

      <SessionModal
        open={!!createAt || !!reagendando}
        initialDate={createAt}
        session={reagendando}
        pacientes={pacientes}
        onClose={() => { setCreateAt(null); setReagendando(null); }}
        onSaved={cerrarYRecargar}
      />
      <EventModal
        open={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onChanged={cerrarYRecargar}
        onReschedule={(e) => { setSelectedEvent(null); setReagendando(e); }}
      />
      <SyncModal
        open={showSync}
        onClose={() => setShowSync(false)}
        onChanged={cargar}
      />
    </Layout>
  );
}
