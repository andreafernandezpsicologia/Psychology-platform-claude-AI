import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { badgeStyle } from '../common/Badge';
import { parseWall } from '../../utils/fechaPared';

function groupByDay(events) {
  const map = {};
  for (const e of events) {
    const key = format(parseWall(e.fecha_hora), 'yyyy-MM-dd');
    (map[key] = map[key] || []).push(e);
  }
  Object.values(map).forEach((list) =>
    list.sort((a, b) => parseWall(a.fecha_hora) - parseWall(b.fecha_hora))
  );
  return map;
}

// Vista mensual. En modo compact (móvil / portal paciente) las celdas muestran
// puntos de color y la agenda del día seleccionado se lista debajo del grid.
export default function MonthGrid({ date, events, locale, onSelectDay, onSelectEvent, readOnly = false, compact = false }) {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  useEffect(() => {
    if (!isSameMonth(selectedDay, date)) setSelectedDay(startOfMonth(date));
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { locale }),
    end: endOfWeek(endOfMonth(date), { locale }),
  });
  const porDia = groupByDay(events);
  const eventosDe = (day) => porDia[format(day, 'yyyy-MM-dd')] || [];
  const headers = days.slice(0, 7).map((d) => format(d, 'EEEEEE', { locale }));
  const agenda = compact ? eventosDe(selectedDay) : [];

  const nombreDe = (e) => {
    if (e.estado === 'ocupado') return e.titulo || t('calendar.busy');
    return e.pacientes?.users?.nombre_completo
      || t(e.tipo === 'videollamada' ? 'calendar.videocall' : 'calendar.inPerson');
  };

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {headers.map((h) => (
          <div key={h} className="text-center text-xs font-semibold py-1 capitalize" style={{ color: 'var(--text)' }}>
            {h}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)', gap: 1, backgroundColor: 'var(--border)' }}
      >
        {days.map((day) => {
          const evs = eventosDe(day);
          const dentro = isSameMonth(day, date);
          const seleccionado = compact && isSameDay(day, selectedDay);
          const clickable = compact || (!readOnly && onSelectDay);
          return (
            <div
              key={day.toISOString()}
              onClick={() => {
                if (compact) setSelectedDay(day);
                else if (!readOnly && onSelectDay) onSelectDay(day);
              }}
              className={`bg-white p-1 ${compact ? 'min-h-11' : 'min-h-24'} ${clickable ? 'cursor-pointer hover:bg-[var(--bg)]' : ''} transition`}
              style={{
                opacity: dentro ? 1 : 0.45,
                ...(seleccionado ? { backgroundColor: 'var(--bg)', boxShadow: 'inset 0 0 0 2px var(--brand)' } : {}),
              }}
            >
              <div
                className={`text-xs font-semibold mb-0.5 w-5 h-5 flex items-center justify-center rounded-full ${compact ? 'mx-auto' : ''}`}
                style={isToday(day) ? { backgroundColor: 'var(--brand)', color: 'white' } : { color: 'var(--brand)' }}
              >
                {format(day, 'd')}
              </div>

              {compact ? (
                <div className="flex justify-center gap-0.5 flex-wrap">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badgeStyle(e.estado).color }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((e) => {
                    const s = badgeStyle(e.estado);
                    return (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); onSelectEvent?.(e); }}
                        className="block w-full text-left text-[11px] leading-tight font-medium px-1 py-0.5 rounded truncate hover:opacity-80 transition"
                        style={{ backgroundColor: s.bg, color: s.color }}
                      >
                        {format(parseWall(e.fecha_hora), 'HH:mm')} {nombreDe(e)}
                      </button>
                    );
                  })}
                  {evs.length > 3 && (
                    <p className="text-[10px] px-1" style={{ color: 'var(--text)' }}>
                      {t('calendar.moreEvents', { n: evs.length - 3 })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compact && (
        <div className="mt-3">
          <p className="text-xs font-semibold mb-1.5 capitalize" style={{ color: 'var(--brand)' }}>
            {format(selectedDay, 'EEEE d MMMM', { locale })}
          </p>
          {agenda.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text)' }}>{t('calendar.noEventsDay')}</p>
          ) : agenda.map((e) => {
            const s = badgeStyle(e.estado);
            const contenido = (
              <>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="font-semibold" style={{ color: 'var(--brand)' }}>
                  {format(parseWall(e.fecha_hora), 'HH:mm')}
                </span>
                <span className="truncate" style={{ color: 'var(--text)' }}>
                  {nombreDe(e)} · {e.duracion_minutos} min
                </span>
              </>
            );
            return readOnly ? (
              <div key={e.id} className="flex items-center gap-2 w-full text-xs py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                {contenido}
              </div>
            ) : (
              <button
                key={e.id}
                onClick={() => onSelectEvent?.(e)}
                className="flex items-center gap-2 w-full text-left text-xs py-1.5 hover:opacity-75 transition"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {contenido}
              </button>
            );
          })}
          {!readOnly && onSelectDay && (
            <button
              onClick={() => onSelectDay(selectedDay)}
              className="mt-2 text-xs font-semibold transition hover:opacity-70"
              style={{ color: 'var(--brand)' }}
            >
              {t('calendar.newSession')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
