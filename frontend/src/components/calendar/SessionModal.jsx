import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import api from '../../utils/api';

const localeMap = { es, en: enUS, da };

// Crear sesión (session = null) o reagendar una existente (session != null).
// Si el backend responde 409 (solape), muestra confirmación y reintenta con force.
export default function SessionModal({ open, initialDate, session, pacientes = [], onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || es;
  const [form, setForm] = useState({ paciente_id: '', fecha_hora: '', tipo: 'videollamada', duracion_minutos: 50 });
  const [saving, setSaving] = useState(false);
  const [conflicto, setConflicto] = useState(null);

  const reagendar = !!session;

  useEffect(() => {
    if (!open) return;
    setForm({
      paciente_id: '',
      fecha_hora: initialDate
        ? format(initialDate, "yyyy-MM-dd'T'HH:mm")
        : (session?.fecha_hora || '').slice(0, 16),
      tipo: session?.tipo || 'videollamada',
      duracion_minutos: session?.duracion_minutos || 50,
    });
    setConflicto(null);
  }, [open, session, initialDate]);

  if (!open) return null;

  const activos = pacientes.filter((p) => p.pacientes && p.pacientes.estado !== 'archivado');

  const guardar = async (force) => {
    setSaving(true);
    try {
      if (reagendar) {
        await api.put(`/sesiones/${session.id}/reagendar`, { fecha_hora: form.fecha_hora, force });
        toast.success(t('calendar.rescheduled'));
      } else {
        const sel = activos.find((p) => p.pacientes.id === form.paciente_id);
        const packActivo = sel?.pacientes?.packs?.find((pk) => pk.estado === 'activo');
        await api.post('/sesiones', {
          paciente_id: form.paciente_id,
          pack_id: packActivo?.id || null,
          fecha_hora: form.fecha_hora,
          tipo: form.tipo,
          duracion_minutos: Number(form.duracion_minutos),
          force,
        });
        toast.success(t('calendar.sessionCreated'));
      }
      onSaved();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.solapa_con) {
        setConflicto(err.response.data.solapa_con);
      } else {
        toast.error('Error: ' + (err.response?.data?.error || ''));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" style={{ border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-base mb-4" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}>
            {reagendar ? t('calendar.reschedule') : t('calendar.newSessionTitle')}
          </h3>

          <form onSubmit={(e) => { e.preventDefault(); guardar(false); }} className="space-y-3">
            {!reagendar && (
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text)' }}>
                  {t('calendar.patient')}
                </label>
                <select
                  required
                  value={form.paciente_id}
                  onChange={(e) => setForm({ ...form, paciente_id: e.target.value })}
                  className="field-input"
                >
                  <option value="">{t('calendar.selectPatient')}</option>
                  {activos.map((p) => (
                    <option key={p.pacientes.id} value={p.pacientes.id}>{p.nombre_completo}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text)' }}>
                {t('calendar.dateTime')}
              </label>
              <input
                type="datetime-local"
                required
                value={form.fecha_hora}
                onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })}
                className="field-input"
              />
            </div>

            {!reagendar && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text)' }}>
                    {t('calendar.type')}
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="field-input"
                  >
                    <option value="videollamada">{t('calendar.videocall')}</option>
                    <option value="presencial">{t('calendar.inPerson')}</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text)' }}>
                    {t('calendar.duration')}
                  </label>
                  <select
                    value={form.duracion_minutos}
                    onChange={(e) => setForm({ ...form, duracion_minutos: e.target.value })}
                    className="field-input"
                  >
                    {[50, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>✕</Button>
              <Button type="submit" size="sm" loading={saving}>
                {reagendar ? t('calendar.confirm') : t('calendar.create')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={!!conflicto}
        title={t('calendar.overlapTitle')}
        description={conflicto ? t('calendar.overlapDesc', {
          name: conflicto.paciente_nombre,
          time: format(new Date(conflicto.fecha_hora), 'd MMM · HH:mm', { locale }),
        }) : ''}
        confirmLabel={t('calendar.createAnyway')}
        danger={false}
        onConfirm={() => { setConflicto(null); guardar(true); }}
        onCancel={() => setConflicto(null)}
      />
    </>
  );
}
