import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Layout from '../../components/common/Layout';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { SkeletonCard } from '../../components/common/Skeleton';
import MonthGrid from '../../components/calendar/MonthGrid';
import api from '../../utils/api';
import { format, addMonths } from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';

const localeMap = { es, en: enUS, da };


export default function PacienteDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingContrato, setUploadingContrato] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(() => new Date());
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || es;
  const fileInputRef = useRef(null);
  const [contratoPackRef, setContratoPackRef] = useState(null);

  const cargar = () => {
    api.get('/pacientes/me/perfil').then((res) => setData(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const exportarMisDatos = async () => {
    setExportando(true);
    try {
      const res = await api.get('/pacientes/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mis-datos-studio-renacer-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Error al exportar datos: ' + (err.response?.data?.error || ''));
    } finally {
      setExportando(false);
    }
  };

  const descargarIcs = async (sesionId) => {
    try {
      const res = await api.get(`/sesiones/${sesionId}/ics`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cita-studio-renacer.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(t('calendar.icsError'));
    }
  };

  const descargarPlantilla = () => {
    const a = document.createElement('a');
    a.href = '/Contrato_de_Servicios.pdf';
    a.download = 'Contrato_de_Servicios.pdf';
    a.click();
  };

  const subirContratoFirmado = async (packId, file) => {
    if (!file) return;
    setUploadingContrato(packId);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      await api.post(`/contratos/pack/${packId}/subir-paciente`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('patientDashboard.contratoSubidoOk'));
      cargar();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    } finally {
      setUploadingContrato(null);
      setContratoPackRef(null);
    }
  };

  const descargarContratoFinal = async (packId) => {
    try {
      const res = await api.get(`/contratos/pack/${packId}/firmado-admin`);
      window.open(res.data.url, '_blank');
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.error || ''));
    }
  };

  if (loading) return (
    <Layout>
      <div className="space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={5} />
      </div>
    </Layout>
  );

  const info = data?.pacientes;
  const packActivo = info?.packs?.find((p) => p.estado === 'activo');
  const sesiones = info?.sesiones || [];
  const proximas = sesiones
    .filter((s) => s.estado === 'programada' && new Date(s.fecha_hora) >= new Date())
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const pct = packActivo ? (packActivo.num_sesiones_usadas / packActivo.num_sesiones_total) * 100 : 0;
  const contratoEstado = packActivo?.contrato_estado || 'sin_contrato';

  return (
    <Layout>
      {/* File input oculto */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(e) => { if (contratoPackRef) subirContratoFirmado(contratoPackRef, e.target.files[0]); }}
      />

      <h2 className="heading-serif mb-5" style={{ fontSize: '1.5rem' }}>
        {t('patientDashboard.hello', { name: data?.nombre_completo?.split(' ')[0] })}
      </h2>

      <div className="space-y-4">
        {/* ── Cobertura ── */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--navy)' }}>{t('patientDashboard.coverage')}</h3>
          {packActivo ? (
            <div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold heading-serif" style={{ color: 'var(--navy)' }}>
                  {packActivo.num_sesiones_total - packActivo.num_sesiones_usadas}
                </span>
                <span className="text-sm mb-1" style={{ color: 'var(--text)' }}>{t('patientDashboard.sessionsAvailable')}</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ backgroundColor: 'var(--border)' }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--navy)' }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text)' }}>
                {t('patientDashboard.sessionsUsed', { used: packActivo.num_sesiones_usadas, total: packActivo.num_sesiones_total })}
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text)' }}>{t('patientDashboard.noPack')}</p>
          )}
        </div>

        {/* ── Contrato de servicios ── */}
        {packActivo && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--navy)' }}>
              {t('patientDashboard.contratoTitle')}
            </h3>

            {contratoEstado === 'sin_contrato' && (
              <div>
                <p className="text-sm mb-3" style={{ color: 'var(--text)' }}>
                  {t('patientDashboard.contratoPendiente')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={descargarPlantilla}>
                    ⬇ {t('patientDashboard.contratoDescargarPlantilla')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={uploadingContrato === packActivo.id}
                    onClick={() => { setContratoPackRef(packActivo.id); fileInputRef.current?.click(); }}
                  >
                    ⬆ {t('patientDashboard.contratoSubirFirmado')}
                  </Button>
                </div>
              </div>
            )}

            {contratoEstado === 'firmado_paciente' && (
              <div className="flex items-center gap-3">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#fff8e1', color: '#f57f17' }}>
                  ✓ {t('patientDashboard.contratoEnviado')}
                </span>
                <Button size="sm" variant="ghost"
                  loading={uploadingContrato === packActivo.id}
                  onClick={() => { setContratoPackRef(packActivo.id); fileInputRef.current?.click(); }}>
                  ↻ {t('patientDashboard.contratoSubirFirmado')}
                </Button>
              </div>
            )}

            {contratoEstado === 'completado' && (
              <div className="flex items-center gap-3">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
                  ✓ {t('patientDashboard.contratoFirmadoAmbos')}
                </span>
                <Button size="sm" onClick={() => descargarContratoFinal(packActivo.id)}>
                  ⬇ {t('patientDashboard.contratoDescargarFinal')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Próximas sesiones ── */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--navy)' }}>{t('patientDashboard.upcoming')}</h3>
          {proximas.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text)' }}>{t('patientDashboard.noUpcoming')}</p>
          ) : proximas.map((s) => (
            <div key={s.id} className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
                    {format(new Date(s.fecha_hora), "EEEE d 'de' MMMM · HH:mm", { locale })}
                  </p>
                  <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text)' }}>
                    {s.tipo === 'videollamada' ? t('patientDashboard.videocall') : t('patientDashboard.inPerson')} · {s.duracion_minutos} {t('patientDashboard.min')}
                  </p>
                </div>
                <Badge estado="programada" label={t('patientDashboard.scheduled')} />
              </div>
              <button
                onClick={() => descargarIcs(s.id)}
                className="mt-2 text-xs font-medium transition hover:opacity-70"
                style={{ color: 'var(--navy)' }}
              >
                📅 {t('calendar.addToCalendar')}
              </button>
            </div>
          ))}
        </div>

        {/* ── Mi calendario ── */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>{t('calendar.myCalendar')}</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMesCalendario(addMonths(mesCalendario, -1))}
                className="px-2 py-0.5 text-sm rounded transition hover:bg-[var(--bg)]"
                style={{ color: 'var(--navy)' }}
              >
                ‹
              </button>
              <span className="text-xs font-semibold capitalize w-28 text-center" style={{ color: 'var(--navy)' }}>
                {format(mesCalendario, 'MMMM yyyy', { locale })}
              </span>
              <button
                onClick={() => setMesCalendario(addMonths(mesCalendario, 1))}
                className="px-2 py-0.5 text-sm rounded transition hover:bg-[var(--bg)]"
                style={{ color: 'var(--navy)' }}
              >
                ›
              </button>
            </div>
          </div>
          <MonthGrid date={mesCalendario} events={sesiones} locale={locale} readOnly compact />
        </div>

        {/* ── Historial ── */}
        {sesiones.some((s) => s.estado === 'completada' || s.estado === 'cancelada_con_cargo') && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--navy)' }}>{t('patientDashboard.history')}</h3>
            {sesiones.filter((s) => s.estado === 'completada' || s.estado === 'cancelada_con_cargo')
              .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    {format(new Date(s.fecha_hora), "d MMM yyyy", { locale })} · {s.tipo === 'videollamada' ? t('patientDashboard.videocall') : t('patientDashboard.inPerson')}
                  </p>
                  {s.estado === 'completada'
                    ? <Badge estado="completada" label={t('patientDashboard.completed')} />
                    : <Badge estado="cancelada_con_cargo" label={t('patientDashboard.cancelledLate')} />
                  }
                </div>
              ))}
          </div>
        )}
        {/* ── Mis datos (RGPD) ── */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--navy)' }}>{t('patientDashboard.gdprTitle')}</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text)' }}>{t('patientDashboard.gdprDesc')}</p>
          <Button size="sm" variant="ghost" loading={exportando} onClick={exportarMisDatos}>
            ⬇ {exportando ? t('patientDashboard.gdprDownloading') : t('patientDashboard.gdprDownload')}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
