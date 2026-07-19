import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Button from './common/Button';
import api from '../utils/api';

// Escalas ORS ("¿cómo estás esta semana?", antes de sesión) y SRS ("¿cómo ha
// ido la sesión?", al terminar). 4 deslizadores 0-10 cada una, digitalizando
// lo que Andrea ya pregunta de palabra. Siempre saltable con "Ahora no".
const ETIQUETAS = {
  ors: [
    'feedback.ors.p1', 'feedback.ors.p2', 'feedback.ors.p3', 'feedback.ors.p4',
  ],
  srs: [
    'feedback.srs.p1', 'feedback.srs.p2', 'feedback.srs.p3', 'feedback.srs.p4',
  ],
};

const FALLBACK = {
  ors: [
    'Cómo me siento a nivel personal',
    'Cómo van mis relaciones cercanas (familia, pareja)',
    'Cómo van mis relaciones sociales (amigos, trabajo)',
    'En general, cómo estoy esta semana',
  ],
  srs: [
    'Me sentí escuchada/o y entendida/o',
    'Trabajamos en lo que a mí me importa',
    'El enfoque de hoy me ha encajado',
    'En general, cómo ha ido la sesión',
  ],
};

export default function FeedbackSliders({ tipo, sesionId, onDone }) {
  const { t } = useTranslation();
  const [valores, setValores] = useState([5, 5, 5, 5]);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (i, v) => setValores((prev) => prev.map((x, idx) => (idx === i ? Number(v) : x)));

  const enviar = async () => {
    setEnviando(true);
    try {
      await api.post('/feedback', { sesion_id: sesionId, tipo, valores });
      toast.success(t('feedback.gracias', '¡Gracias por tu feedback!'));
      onDone?.();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setEnviando(false);
    }
  };

  const titulo = tipo === 'ors'
    ? t('feedback.tituloOrs', '¿Cómo estás esta semana?')
    : t('feedback.tituloSrs', '¿Cómo ha ido la sesión?');

  return (
    <div>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--brand)' }}>{titulo}</p>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
        {t('feedback.subtitulo', '4 preguntas rápidas · 30 segundos · puedes dejarlo para luego')}
      </p>

      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs" style={{ color: 'var(--text)' }}>
              {t(ETIQUETAS[tipo][i], FALLBACK[tipo][i])}
            </label>
            <span className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>{valores[i]}</span>
          </div>
          <input
            type="range" min="0" max="10" step="1"
            value={valores[i]}
            onChange={(e) => cambiar(i, e.target.value)}
            className="w-full accent-[var(--brand)]"
          />
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
