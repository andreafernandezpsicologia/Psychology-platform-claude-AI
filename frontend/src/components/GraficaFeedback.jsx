import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';
import { preguntasDe, tituloDe, labelDe, opcionesDe } from '../config/feedbackPreguntas';

const localeMap = { es, en: enUS, da };

// Mini-gráfica (sparkline) SVG de una serie de puntos {fecha, valor} en [0, max].
function Sparkline({ puntos, max, color }) {
  const W = 260, H = 44, P = 4;
  if (puntos.length === 0) return null;
  const n = puntos.length;
  const x = (i) => (n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const linea = puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
      {/* línea base */}
      <line x1="0" y1={H - P} x2={W} y2={H - P} stroke="var(--border)" strokeWidth="1" />
      {n > 1 && <polyline points={linea} fill="none" stroke={color} strokeWidth="2" />}
      {puntos.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.valor)} r="3" fill={color} />
      ))}
    </svg>
  );
}

export default function GraficaFeedback({ serie }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const locale = localeMap[lang] || es;

  if (!serie || serie.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('feedbackGrafica.vacio', 'Todavía no hay respuestas de feedback de este paciente.')}</p>;
  }

  const fechaDe = (f) => f.sesiones?.fecha_hora || f.creado_en;

  const renderTipo = (tipo, titulo) => {
    const items = serie.filter((f) => f.tipo === tipo).sort((a, b) => String(fechaDe(a)).localeCompare(String(fechaDe(b))));
    if (items.length === 0) return null;

    return (
      <div className="mb-5">
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--brand)' }}>{titulo}</p>
        {preguntasDe(tipo).map((q) => {
          const esFrecuencia = q.tipo === 'frecuencia';
          const opciones = esFrecuencia ? opcionesDe(q, lang) : null;
          const max = esFrecuencia ? opciones.length - 1 : 10;
          const color = esFrecuencia ? '#A33B2D' : 'var(--brand)';
          const puntos = items
            .map((f) => ({ fecha: fechaDe(f), valor: f.respuestas?.[q.id] }))
            .filter((p) => typeof p.valor === 'number');
          if (puntos.length === 0) return null;
          const ultimo = puntos[puntos.length - 1].valor;
          const ultimoTxt = esFrecuencia ? opciones[ultimo] : `${ultimo}/10`;

          return (
            <div key={q.id} className="mb-3">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span className="text-xs" style={{ color: 'var(--text)' }}>{labelDe(q, lang)}</span>
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color }}>{ultimoTxt}</span>
              </div>
              <Sparkline puntos={puntos} max={max} color={color} />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                <span>{format(new Date(String(puntos[0].fecha).slice(0, 19)), 'd MMM', { locale })}</span>
                {puntos.length > 1 && <span>{format(new Date(String(puntos[puntos.length - 1].fecha).slice(0, 19)), 'd MMM', { locale })}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {renderTipo('ors', tituloDe('ors', lang))}
      {renderTipo('srs', tituloDe('srs', lang))}
    </div>
  );
}
