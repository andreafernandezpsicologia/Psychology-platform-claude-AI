import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ConfirmDialog from '../common/ConfirmDialog';
import api from '../../utils/api';
import { estadoGoogle } from '../../utils/googleMeet';
import { parseWall } from '../../utils/fechaPared';

const localeMap = { es, en: enUS, da };

// Detalle de una cita al clicarla en el calendario. Si está programada permite
// confirmar asistencia, cancelar (con o sin cargo) o reagendar.
export default function EventModal({ open, event, onClose, onChanged, onReschedule }) {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || es;
  const [saving, setSaving] = useState(false);
  const [confirmando, setConfirmando] = useState(null); // 'cancelada' | 'cancelada_con_cargo'
  const [editandoEnlace, setEditandoEnlace] = useState(false);
  const [enlaceInput, setEnlaceInput] = useState('');
  const [savingEnlace, setSavingEnlace] = useState(false);
  const [googleOk, setGoogleOk] = useState(false);
  const [generandoMeet, setGenerandoMeet] = useState(false);

  // Al cambiar de sesión (o cerrar y abrir otra), no arrastrar el modo edición.
  useEffect(() => { setEditandoEnlace(false); }, [event?.id]);

  useEffect(() => {
    if (open) estadoGoogle().then((g) => setGoogleOk(g.conectado));
  }, [open]);

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

  const abrirEdicionEnlace = () => {
    setEnlaceInput(event.enlace_videollamada || '');
    setEditandoEnlace(true);
  };

  const generarMeet = async () => {
    setGenerandoMeet(true);
    try {
      await api.post(`/sesiones/${event.id}/generar-meet`);
      toast.success(t('calendar.meetGenerated'));
      onChanged();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setGenerandoMeet(false);
    }
  };

  const guardarEnlace = async () => {
    setSavingEnlace(true);
    try {
      await api.put(`/sesiones/${event.id}/enlace`, { enlace_videollamada: enlaceInput.trim() });
      toast.success(t('calendar.videoLinkSaved'));
      setEditandoEnlace(false);
      onChanged();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setSavingEnlace(false);
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
            <h3 className="font-bold text-base" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>
              {nombre}
            </h3>
            <Badge estado={event.estado} label={t(statusKey)} />
          </div>
          <p className="text-sm font-semibold capitalize" style={{ color: 'var(--brand)' }}>
            {format(parseWall(event.fecha_hora), 'EEEE d MMMM · HH:mm', { locale })}
          </p>
          <p className={`text-xs mt-0.5 ${event.tipo === 'videollamada' ? '' : 'mb-4'}`} style={{ color: 'var(--text)' }}>
            {t(event.tipo === 'videollamada' ? 'calendar.videocall' : 'calendar.inPerson')} · {event.duracion_minutos} min
          </p>

          {event.tipo === 'videollamada' && (
            <div className="mt-2 mb-4">
              {editandoEnlace ? (
                <div className="flex gap-2">
                  <input
                    type="url"
                    autoFocus
                    placeholder={t('calendar.videoLinkPlaceholder')}
                    value={enlaceInput}
                    onChange={(e) => setEnlaceInput(e.target.value)}
                    className="field-input text-xs"
                  />
                  <Button size="sm" loading={savingEnlace} onClick={guardarEnlace}>
                    {t('calendar.videoLinkSave')}
                  </Button>
                </div>
              ) : event.enlace_videollamada ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={event.enlace_videollamada}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium truncate max-w-[200px]"
                    style={{ color: '#2C3E54' }}
                  >
                    🔗 {event.enlace_videollamada}
                  </a>
                  <button onClick={abrirEdicionEnlace} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--brand)' }}>
                    {t('calendar.videoLinkEdit')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  {googleOk && ['programada', 'solicitada'].includes(event.estado) && (
                    <button disabled={generandoMeet} onClick={generarMeet}
                      className="text-xs font-medium hover:opacity-70 disabled:opacity-50" style={{ color: 'var(--brand)' }}>
                      ⚡ {generandoMeet ? t('calendar.meetGenerating') : t('calendar.meetGenerate')}
                    </button>
                  )}
                  <button onClick={abrirEdicionEnlace} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--brand)' }}>
                    + {t('calendar.videoLinkAdd')}
                  </button>
                </div>
              )}
            </div>
          )}

          {event.estado === 'programada' && (
            <div className="flex flex-wrap gap-2">
              <button disabled={saving} onClick={() => cambiarEstado('completada')}
                className={accion} style={{ backgroundColor: '#E9F0E1', color: '#3B6D2A' }}>
                ✓ {t('patientDetail.confirmAttendance')}
              </button>
              <button disabled={saving} onClick={() => setConfirmando('cancelada_con_cargo')}
                className={accion} style={{ backgroundColor: '#F6E3DD', color: '#A33B2D' }}>
                ✕ {t('patientDetail.cancelLate')}
              </button>
              <button disabled={saving} onClick={() => setConfirmando('cancelada')}
                className={accion} style={{ backgroundColor: '#F1EBDE', color: '#7A6A53' }}>
                ✕ {t('calendar.cancelSession')}
              </button>
              <button disabled={saving} onClick={() => onReschedule(event)}
                className={accion} style={{ backgroundColor: '#F8EFD2', color: '#B07A2B' }}>
                ↻ {t('calendar.reschedule')}
              </button>
            </div>
          )}

          {event.estado === 'solicitada' && (
            <div>
              <p className="text-xs mb-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: '#ECE6F0', color: '#6A4E8F' }}>
                {t('calendar.requestedHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button disabled={saving} onClick={() => cambiarEstado('programada')}
                  className={accion} style={{ backgroundColor: '#E9F0E1', color: '#3B6D2A' }}>
                  ✓ {t('calendar.confirmAppointment')}
                </button>
                <button disabled={saving} onClick={() => setConfirmando('rechazar')}
                  className={accion} style={{ backgroundColor: '#F6E3DD', color: '#A33B2D' }}>
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
