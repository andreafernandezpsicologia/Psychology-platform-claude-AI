import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import api from '../../utils/api';

// Sincronización de calendarios (solo admin):
// 1) Saliente: URL de suscripción iCal para ver la agenda en Google/Apple/Outlook.
// 2) Entrante: conectar calendarios personales cuyas citas bloquean horas como "Ocupado".
export default function SyncModal({ open, onClose, onChanged }) {
  const { t } = useTranslation();
  const [feedUrl, setFeedUrl] = useState('');
  const [externos, setExternos] = useState([]);
  const [form, setForm] = useState({ nombre: '', url: '' });
  const [saving, setSaving] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const cargar = () => {
    api.get('/calendarios/feed-url').then((res) => setFeedUrl(res.data.url)).catch(() => {});
    api.get('/calendarios/externos').then((res) => setExternos(res.data)).catch(() => {});
  };

  useEffect(() => { if (open) cargar(); }, [open]);

  if (!open) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success(t('calendar.copied'));
    } catch {
      toast.error('Error');
    }
  };

  const regenerar = async () => {
    setConfirmRegen(false);
    try {
      const res = await api.post('/calendarios/feed-url/regenerar');
      setFeedUrl(res.data.url);
      toast.success(t('calendar.regenerated'));
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    }
  };

  const agregar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/calendarios/externos', form);
      setForm({ nombre: '', url: '' });
      toast.success(t('calendar.externalAdded'));
      cargar();
      onChanged?.();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/calendarios/externos/${id}`);
      toast.success(t('calendar.externalDeleted'));
      cargar();
      onChanged?.();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-8" style={{ border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-base mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--brand)' }}>
            🔄 {t('calendar.syncTitle')}
          </h3>

          {/* ── Saliente: feed de suscripción ── */}
          <div className="mb-5">
            <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--brand)' }}>
              {t('calendar.feedSectionTitle')}
            </h4>
            <p className="text-xs mb-2" style={{ color: 'var(--text)' }}>{t('calendar.feedHint')}</p>
            <div className="flex gap-2 items-center">
              <input readOnly value={feedUrl} className="field-input text-xs" onFocus={(e) => e.target.select()} />
              <Button size="sm" onClick={copiar}>{t('calendar.copy')}</Button>
            </div>
            <button
              onClick={() => setConfirmRegen(true)}
              className="mt-1.5 text-xs font-medium transition hover:opacity-70"
              style={{ color: '#A33B2D' }}
            >
              ↻ {t('calendar.regenerate')}
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} className="my-4" />

          {/* ── Entrante: calendarios externos ── */}
          <div>
            <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--brand)' }}>
              {t('calendar.externalSectionTitle')}
            </h4>
            <p className="text-xs mb-3" style={{ color: 'var(--text)' }}>{t('calendar.externalHint')}</p>

            {externos.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>{c.nombre}</p>
                  <p className="text-xs" style={{ color: c.last_error ? '#A33B2D' : 'var(--text)' }}>
                    {c.last_error
                      ? `⚠ ${t('calendar.externalError')}`
                      : c.last_synced_at
                        ? `✓ ${t('calendar.externalSynced')}`
                        : t('calendar.externalPending')}
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(c.id)}>
                  {t('calendar.delete')}
                </Button>
              </div>
            ))}

            <form onSubmit={agregar} className="mt-3 space-y-2">
              <input
                required
                placeholder={t('calendar.externalName')}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="field-input"
              />
              <input
                required
                type="url"
                placeholder={t('calendar.externalUrl')}
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="field-input"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={saving}>{t('calendar.add')}</Button>
              </div>
            </form>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRegen}
        title={t('calendar.regenerateConfirmTitle')}
        description={t('calendar.regenerateConfirmDesc')}
        confirmLabel={t('calendar.regenerate')}
        onConfirm={regenerar}
        onCancel={() => setConfirmRegen(false)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('calendar.externalDeleteConfirmTitle')}
        description={t('calendar.externalDeleteConfirmDesc')}
        confirmLabel={t('calendar.delete')}
        onConfirm={eliminar}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
