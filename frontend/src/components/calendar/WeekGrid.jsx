import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, setHours, isToday, isSameDay, getDay } from 'date-fns';
import { badgeStyle } from '../common/Badge';
import { HORA_INICIO, HORA_FIN, DIAS_LABORALES } from '../../utils/calendarConfig';
import { parseWall } from '../../utils/fechaPared';

const HOUR_PX = 48;
const H_DESDE = Math.max(0, HORA_INICIO - 1);
const H_HASTA = Math.min(24, HORA_FIN + 1);
const HORAS = Array.from({ length: H_HASTA - H_DESDE }, (_, i) => H_DESDE + i);

// Vista semanal con franjas horarias. Las horas fuera del horario de consulta
// y los días no laborales se atenúan. Clic en franja vacía → crear sesión.
export default function WeekGrid({ date, events, locale, onSelectSlot, onSelectEvent }) {
  const days = eachDayOfInterval({
    start: startOfWeek(date, { locale }),
    end: endOfWeek(date, { locale }),
  });

  // Eventos de un día, con indentado para los que se solapan con el anterior
  const eventosDe = (day) => {
    const evs = events
      .filter((e) => isSameDay(parseWall(e.fecha_hora), day))
      .sort((a, b) => parseWall(a.fecha_hora) - parseWall(b.fecha_hora));
    let prevFin = -1;
    let offset = 0;
    return evs.map((e) => {
      const d = parseWall(e.fecha_hora);
      const ini = d.getHours() + d.getMinutes() / 60;
      const fin = ini + (e.duracion_minutos || 50) / 60;
      offset = ini < prevFin ? offset + 12 : 0;
      prevFin = Math.max(prevFin, fin);
      return { e, d, ini, offset };
    });
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Cabecera de días */}
        <div className="grid" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className="text-center py-1.5">
              <p className="text-xs font-semibold capitalize" style={{ color: 'var(--text)' }}>
                {format(day, 'EEEEEE', { locale })}
              </p>
              <p
                className="text-sm font-bold w-7 h-7 mx-auto flex items-center justify-center rounded-full"
                style={isToday(day) ? { backgroundColor: 'var(--navy)', color: 'white' } : { color: 'var(--navy)' }}
              >
                {format(day, 'd')}
              </p>
            </div>
          ))}
        </div>

        {/* Rejilla horaria */}
        <div
          className="grid rounded-lg overflow-hidden bg-white"
          style={{ gridTemplateColumns: '44px repeat(7, 1fr)', border: '1px solid var(--border)' }}
        >
          <div>
            {HORAS.map((h) => (
              <div key={h} className="text-[10px] text-right pr-1.5 pt-0.5" style={{ height: HOUR_PX, color: 'var(--text)' }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const laboral = DIAS_LABORALES.includes(getDay(day));
            return (
              <div key={day.toISOString()} className="relative" style={{ borderLeft: '1px solid var(--border)' }}>
                {HORAS.map((h) => {
                  const fueraHorario = !laboral || h < HORA_INICIO || h >= HORA_FIN;
                  return (
                    <div
                      key={h}
                      onClick={() => onSelectSlot?.(setHours(startOfDay(day), h))}
                      className="cursor-pointer transition hover:bg-[var(--bg)]"
                      style={{
                        height: HOUR_PX,
                        borderTop: '1px solid var(--border)',
                        backgroundColor: fueraHorario ? 'var(--bg)' : 'white',
                        opacity: fueraHorario ? 0.55 : 1,
                      }}
                    />
                  );
                })}

                {eventosDe(day).map(({ e, d, ini, offset }) => {
                  const s = badgeStyle(e.estado);
                  const nombre = e.estado === 'ocupado'
                    ? (e.titulo || '—')
                    : (e.pacientes?.users?.nombre_completo || '—');
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); onSelectEvent?.(e); }}
                      title={`${format(d, 'HH:mm')} ${nombre}`}
                      className="absolute rounded px-1 py-0.5 text-left text-[11px] leading-tight font-medium overflow-hidden hover:opacity-85 transition"
                      style={{
                        top: Math.max(0, (ini - H_DESDE) * HOUR_PX),
                        height: Math.max(20, ((e.duracion_minutos || 50) / 60) * HOUR_PX - 2),
                        left: 2 + offset,
                        right: 2,
                        backgroundColor: s.bg,
                        color: s.color,
                        border: `1px solid ${s.color}`,
                      }}
                    >
                      <span className="font-bold">{format(d, 'HH:mm')}</span> {nombre}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
