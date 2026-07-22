import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Button from './common/Button';
import api from '../utils/api';
import { preguntasDe, tituloDe, labelDe, opcionesDe } from '../config/feedbackPreguntas';

// Escalas ORS ("¿cómo estás esta semana?", antes de sesión) y SRS ("¿cómo ha
// ido la sesión?", al terminar). Preguntas y escalas definidas en el catálogo
// (config/feedbackPreguntas.js). Cada pregunta es un deslizador 0-10 o una
// escala de frecuencia con opciones. Siempre saltable con "Ahora no".
export default function FeedbackSliders({ tipo, sesionId, onDone }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const preguntas = preguntasDe(tipo);

  // Valor inicial: mitad para deslizadores (5), primera opción para frecuencia (0).
  const [respuestas, setRespuestas] = useState(() =>
    Object.fromEntries(preguntas.map((p) => [p.id, p.tipo === 'escala' ? 5 : 0]))
  );
  const [enviando, setEnviando] = useState(false);

  const set = (id, v) => setRespuestas((prev) => ({ ...prev, [id]: Number(v) }));

  const enviar = async () => {
    setEnviando(true);
    try {
      await api.post('/feedback', { sesion_id: sesionId, tipo, respuestas });
      toast.success(t('feedback.gracias', '¡Gracias por tu feedback!'));
      onDone?.();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--brand)' }}>{tituloDe(tipo, lang)}</p>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
        {t('feedback.subtitulo', 'Unas preguntas rápidas · 30 segundos · puedes dejarlo para luego')}
      </p>

      {preguntas.map((p) => (
        <div key={p.id} className="mb-4">
          <label className="text-xs block mb-1.5" style={{ color: 'var(--text)' }}>
            {labelDe(p, lang)}
          </label>

          {p.tipo === 'escala' ? (
            <div className="flex items-center gap-3">
              <input
                type="range" min="0" max="10" step="1"
                value={respuestas[p.id]}
                onChange={(e) => set(p.id, e.target.value)}
                className="w-full accent-[var(--brand)]"
              />
              <span className="text-xs font-semibold w-5 text-right" style={{ color: 'var(--brand)' }}>{respuestas[p.id]}</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {opcionesDe(p, lang).map((op, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => set(p.id, idx)}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition"
                  style={respuestas[p.id] === idx
                    ? { backgroundColor: 'var(--brand)', color: 'white' }
                    : { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 mt-2">
        <Button size="sm" loading={enviando} onClick={enviar}>
          {t('feedback.enviar', 'Enviar')}
        </Button>
        <Button size="sm" variant="ghost" disabled={enviando} onClick={() => onDone?.()}>
          {t('feedback.ahoraNo', 'Ahora no')}
        </Button>
      </div>
    </div>
  );
}
