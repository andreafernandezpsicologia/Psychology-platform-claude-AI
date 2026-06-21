import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ConfirmDialog from '../common/ConfirmDialog';
import api from '../../utils/api';
import { parseWall } from '../../utils/fechaPared';

const localeMap = { es, en: enUS, da };

// Detalle de una cita al clicarla en el calendario. Si está programada permite
// confirmar asistencia, cancelar (con o sin cargo) o reagendar.
export default function EventModal({ open, event, onClose, onChanged, onReschedule }) {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || es;
  const [saving, setSaving] = useState(false);
  const [confirmando, setConfirmando] = useState(null); // 'cancelada' | 'cancelada_con_cargo'

  if (!open || !event) return null;

  const nombre = event.pacientes?.users?.nombre_completo || '—';
  const statusKey = `patientDetail.status${event.estado.charAt(0).toUpperCase() + event.estado.slice(1)}`;

  const cambiarEstado = async (estado) => {
    setSaving(true);
    try {
      await api.put(`/sesiones/${event.id}/estado`, { estado });
      toast.success(t('calendar.updated'));
      onChanged();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setSaving(false);
      setConfirmando(null);
    }
  };

  const accion = 'text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-90 disabled:opacity-50';

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}>
              {nombre}
            </h3>
            <Badge estado={event.estado} label={t(statusKey)} />
          </div>
          <p className="text-sm font-semibold capitalize" style={{ color: 'var(--navy)' }}>
            {format(parseWall(event.fecha_hora), 'EEEE d MMMM · HH:mm', { locale })}
          </p>
          <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text)' }}>
            {t(event.tipo === 'videollamada' ? 'calendar.videocall' : 'calendar.inPerson')} · {event.duracion_minutos} min
          </p>

          {event.estado === 'programada' && (
            <div className="flex flex-wrap gap-2">
              <button disabled={saving} onClick={() => cambiarEstado('completada')}
                className={accion} style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
                ✓ {t('patientDetail.confirmAttendance')}
              </button>
              <button disabled={saving} onClick={() => setConfirmando('cancelada_con_cargo')}
                className={accion} style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                ✕ {t('patientDetail.cancelLate')}
              </button>
              <button disabled={saving} onClick={() => setConfirmando('cancelada')}
                className={accion} style={{ backgroundColor: '#f5f5f5', color: '#757575' }}>
                ✕ {t('calendar.cancelSession')}
              </button>
              <button disabled={saving} onClick={() => onReschedule(event)}
                className={accion} style={{ backgroundColor: '#fff8e1', color: '#f57f17' }}>
                ↻ {t('calendar.reschedule')}
              </button>
            </div>
          )}

          {event.estado === 'solicitada' && (
            <div>
              <p className="text-xs mb-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: '#ede7f6', color: '#5e35b1' }}>
                {t('calendar.requestedHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button disabled={saving} onClick={() => cambiarEstado('programada')}
                  className={accion} style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
                  ✓ {t('calendar.confirmAppointment')}
                </button>
                <button disabled={saving} onClick={() => setConfirmando('rechazar')}
                  className={accion} style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                  ✕ {t('calendar.reject')}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmando}
        title={confirmando === 'rechazar' ? t('calendar.rejectConfirmTitle') : t('calendar.cancelConfirmTitle')}
        description={
          confirmando === 'rechazar' ? t('calendar.rejectConfirmDesc')
          : confirmando === 'cancelada_con_cargo' ? t('calendar.cancelLateConfirmDesc')
          : t('calendar.cancelConfirmDesc')
        }
        confirmLabel={confirmando === 'rechazar' ? t('calendar.reject') : t('calendar.confirmCancel')}
        onConfirm={() => cambiarEstado(confirmando === 'rechazar' ? 'cancelada' : confirmando)}
        onCancel={() => setConfirmando(null)}
      />
    </>
  );
}
