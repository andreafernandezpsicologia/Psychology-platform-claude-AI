import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS, da } from 'date-fns/locale';
import Layout from '../../components/common/Layout';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { SkeletonCard } from '../../components/common/Skeleton';
import api from '../../utils/api';
import { estadoGoogle } from '../../utils/googleMeet';
import { parseWall, ahoraParedDate } from '../../utils/fechaPared';

const localeMap = { es, en: enUS, da };

const actionStyle = {
  completada:          { bg: '#E9F0E1', color: '#3B6D2A' },
  cancelada_con_cargo: { bg: '#F6E3DD', color: '#A33B2D' },
  reagendar:           { bg: '#F8EFD2', color: '#B07A2B' },
};

const pagoStyles = {
  pagado:       { bg: '#E9F0E1', color: '#3B6D2A' },
  pago_parcial: { bg: '#F8EFD2', color: '#B07A2B' },
  no_pagado:    { bg: '#F6E3DD', color: '#A33B2D' },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function abrirVentanaImpresion(titulo, contenido, metadatos = '') {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${escapeHtml(titulo)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #5B4128; line-height: 1.6; }
      h1 { font-size: 1.3rem; border-bottom: 2px solid #5B4128; padding-bottom: 8px; margin-bottom: 4px; }
      .meta { font-size: 0.85rem; color: #666; margin-bottom: 24px; }
      pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 0.9rem; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <h1>${escapeHtml(titulo)}</h1>
    <p class="meta">${escapeHtml(metadatos)}</p>
    <pre>${escapeHtml(contenido)}</pre>
    <br><br>
    <button onclick="window.print()" style="padding:8px 16px;background:#5B4128;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">
      🖨 Imprimir / Guardar como PDF
    </button>
  </body></html>`);
  win.document.close();
}

export default function PacienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || es;
  const fileInputRef = useRef(null);

  const [paciente, setPaciente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSesion, setShowSesion] = useState(false);
  const [showPack, setShowPack] = useState(false);
  const [sesionForm, setSesionForm] = useState({ fecha_hora: '', tipo: 'videollamada', enlace_videollamada: '', precio: '' });
  const [editandoEnlaceId, setEditandoEnlaceId] = useState(null);
  const [enlaceInput, setEnlaceInput] = useState('');
  const [savingEnlace, setSavingEnlace] = useState(false);
  const [googleOk, setGoogleOk] = useState(false);
  const [generandoMeetId, setGenerandoMeetId] = useState(null);
  const [packForm, setPackForm] = useState({ num_sesiones_total: 10, precio: '' });
  const [savingSesion, setSavingSesion] = useState(false);
  const [savingPack, setSavingPack] = useState(false);
  const [reagendando, setReagendando] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [confirmPack, setConfirmPack] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingEstado, setSavingEstado] = useState(false);
  const [savingPago, setSavingPago] = useState(null);  // packId en curso
  const [savingPagoSesion, setSavingPagoSesion] = useState(null);  // sesionId en curso
  const [savingPagoOnline, setSavingPagoOnline] = useState(false);
  const [enlacePagoId, setEnlacePagoId] = useState(null);  // pack/sesion en curso
  const [uploadingContrato, setUploadingContrato] = useState(null); // packId en curso
  const [contratoPackRef, setContratoPackRef] = useState(null); // packId para el file input admin
  const [enviandoContrato, setEnviandoContrato] = useState(null); // packId en curso

  const cargar = () => {
    setLoading(true);
    api.get(`/pacientes/${id}`)
      .then((res) => setPaciente(res.data))
      .catch(() => toast.error('Error al cargar el paciente'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); }, [id]);
  useEffect(() => { estadoGoogle().then((g) => setGoogleOk(g.conectado)); }, []);

  // ── Sesiones ──────────────────────────────────────────────────────────────
  const crearSesion = async (e) => {
    e.preventDefault();
    setSavingSesion(true);
    const pacienteId = paciente.pacientes?.id;
    const packActivo = paciente.pacientes?.packs?.find((p) => p.estado === 'activo');
    const { precio, ...restoSesion } = sesionForm;
    // Solo las sueltas (sin pack activo) llevan precio; el del bono se cobra aparte.
    const precio_cents = !packActivo && precio !== '' ? Math.round(parseFloat(precio) * 100) : undefined;
    try {
      await api.post('/sesiones', { paciente_id: pacienteId, pack_id: packActivo?.id || null, ...restoSesion, ...(precio_cents != null ? { precio_cents } : {}) });
      toast.success(t('patientDetail.sessionCreated', 'Sesión creada'));
      setShowSesion(false);
      setSesionForm({ fecha_hora: '', tipo: 'videollamada', enlace_videollamada: '', precio: '' });
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingSesion(false); }
  };

  const generarMeet = async (sesionId) => {
    setGenerandoMeetId(sesionId);
    try {
      await api.post(`/sesiones/${sesionId}/generar-meet`);
      toast.success(t('calendar.meetGenerated'));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setGenerandoMeetId(null); }
  };

  const guardarEnlace = async (sesionId) => {
    setSavingEnlace(true);
    try {
      await api.put(`/sesiones/${sesionId}/enlace`, { enlace_videollamada: enlaceInput.trim() });
      toast.success(t('calendar.videoLinkSaved'));
      setEditandoEnlaceId(null);
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingEnlace(false); }
  };

  const crearPack = async (e) => {
    e.preventDefault();
    setSavingPack(true);
    const pacienteId = paciente.pacientes?.id;
    const precio_cents = packForm.precio !== '' ? Math.round(parseFloat(packForm.precio) * 100) : undefined;
    try {
      await api.post('/packs', {
        paciente_id: pacienteId,
        num_sesiones_total: packForm.num_sesiones_total,
        ...(precio_cents != null ? { precio_cents } : {}),
      });
      toast.success(t('patientDetail.packCreated', 'Pack creado'));
      setShowPack(false);
      setPackForm({ num_sesiones_total: 10, precio: '' });
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingPack(false); }
  };

  const eliminarPack = async () => {
    try {
      await api.delete(`/packs/${confirmPack}`);
      toast.success(t('patientDetail.packDeleted', 'Pack eliminado'));
      setConfirmPack(null);
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); setConfirmPack(null); }
  };

  const cambiarEstado = async (sesionId, estado) => {
    try {
      await api.put(`/sesiones/${sesionId}/estado`, { estado });
      toast.success(t('patientDetail.updated', 'Actualizado'));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
  };

  const confirmarReagendar = async (sesionId) => {
    if (!nuevaFecha) return;
    try {
      await api.put(`/sesiones/${sesionId}/reagendar`, { fecha_hora: nuevaFecha });
      toast.success(t('patientDetail.rescheduled', 'Sesión reagendada'));
      setReagendando(null); setNuevaFecha('');
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
  };

  // ── Estado paciente ───────────────────────────────────────────────────────
  const cambiarEstadoPaciente = async (nuevoEstado) => {
    setSavingEstado(true);
    const pacienteId = paciente?.pacientes?.id;
    const estadoBD = nuevoEstado === 'inactivo' ? 'archivado' : nuevoEstado;
    try {
      await api.put(`/pacientes/${pacienteId}`, { estado: estadoBD });
      toast.success(nuevoEstado === 'inactivo' ? t('patientDetail.markInactive') : t('patientDetail.reactivate'));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingEstado(false); }
  };

  const eliminarPaciente = async () => {
    try {
      await api.delete(`/pacientes/${id}`);
      toast.success('Paciente eliminado');
      navigate('/admin');
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); setConfirmDelete(false); }
  };

  // ── Pago ─────────────────────────────────────────────────────────────────
  const cambiarPago = async (packId, estado_pago) => {
    setSavingPago(packId);
    try {
      await api.put(`/packs/${packId}/pago`, { estado_pago });
      toast.success(t(`patientDetail.${estado_pago}`));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingPago(null); }
  };

  // Pago de una sesión suelta (sin pack). Alterna no_pagado / pagado.
  const cambiarPagoSesion = async (sesionId, estado_pago) => {
    setSavingPagoSesion(sesionId);
    try {
      await api.put(`/sesiones/${sesionId}/pago`, { estado_pago });
      toast.success(t(`patientDetail.${estado_pago}`));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingPagoSesion(null); }
  };

  // Activar/desactivar el cobro online (Stripe/Bizum) para este paciente.
  const togglePagoOnline = async () => {
    setSavingPagoOnline(true);
    const pacienteId = paciente?.pacientes?.id;
    const nuevo = !paciente?.pacientes?.pago_online_habilitado;
    try {
      await api.put(`/pacientes/${pacienteId}`, { pago_online_habilitado: nuevo });
      toast.success(nuevo
        ? t('patientDetail.pagoOnlineOn', 'Cobro online activado')
        : t('patientDetail.pagoOnlineOff', 'Cobro online desactivado'));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setSavingPagoOnline(false); }
  };

  // Generar un enlace de pago (Stripe Checkout) y copiarlo al portapapeles para
  // enviárselo al paciente. `ids` = { sesion_id } o { pack_id }.
  const copiarEnlacePago = async (tipo, ids) => {
    const key = ids.sesion_id || ids.cuota_id || ids.pack_id;
    setEnlacePagoId(key);
    try {
      const res = await api.post('/pagos/enlace', { tipo, ...ids });
      await navigator.clipboard.writeText(res.data.url);
      toast.success(t('patientDetail.enlacePagoCopiado', 'Enlace de pago copiado al portapapeles'));
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setEnlacePagoId(null); }
  };

  // ── Contratos ─────────────────────────────────────────────────────────────
  const descargarFirmadoPaciente = async (packId) => {
    try {
      const res = await api.get(`/contratos/pack/${packId}/firmado-paciente`);
      window.open(res.data.url, '_blank');
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
  };

  const subirContratoAdmin = async (packId, file) => {
    if (!file) return;
    setUploadingContrato(packId);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      await api.post(`/contratos/pack/${packId}/subir-admin`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('patientDetail.contratoCompletado'));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setUploadingContrato(null); setContratoPackRef(null); }
  };

  // Enviar por email el contrato predeterminado (plantilla PDF) al paciente.
  // Marca el pack como contrato_estado='enviado': el paciente lo verá para firmar.
  const enviarContratoPredeterminado = async (packId) => {
    setEnviandoContrato(packId);
    try {
      await api.post(`/contratos/pack/${packId}/enviar-plantilla`);
      toast.success(t('patientDetail.contratoEnviadoOk'));
      cargar();
    } catch (err) { toast.error('Error: ' + (err.response?.data?.error || '')); }
    finally { setEnviandoContrato(null); }
  };

  // ── RGPD ─────────────────────────────────────────────────────────────────
  const verRgpd = async () => {
    try {
      const res = await api.get(`/pacientes/${id}/rgpd`);
      const { fecha_aceptacion, documentos_legales: doc } = res.data;
      const fecha = format(new Date(fecha_aceptacion), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale });
      abrirVentanaImpresion(
        doc.titulo,
        doc.contenido,
        `${t('patientDetail.rgpdFecha')}: ${fecha} · ${paciente.nombre_completo} · ${paciente.email}`
      );
    } catch (err) {
      toast.error(t('patientDetail.rgpdNoEncontrado'));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <Layout>
      <div className="space-y-4">
        <SkeletonCard lines={2} /><SkeletonCard lines={4} /><SkeletonCard lines={6} />
      </div>
    </Layout>
  );
  if (!paciente) return <Layout><p className="text-red-500">—</p></Layout>;

  const info = paciente.pacientes;
  const packs = info?.packs || [];
  const packActivo = packs.find((p) => p.estado === 'activo');
  const todasSesiones = info?.sesiones || [];
  const eur = (cents) => (cents == null ? null : (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }));
  const ahora = ahoraParedDate();
  const proximas = todasSesiones.filter((s) => s.estado === 'programada' && parseWall(s.fecha_hora) >= ahora)
    .sort((a, b) => parseWall(a.fecha_hora) - parseWall(b.fecha_hora));
  const pasadas = todasSesiones.filter((s) => s.estado !== 'programada' || parseWall(s.fecha_hora) < ahora)
    .sort((a, b) => parseWall(b.fecha_hora) - parseWall(a.fecha_hora));
  const sesionesTab = tab === 'upcoming' ? proximas : pasadas;

  return (
    <Layout>
      {/* File input oculto para subir contrato admin */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(e) => { if (contratoPackRef) subirContratoAdmin(contratoPackRef, e.target.files[0]); }}
      />

      <ConfirmDialog
        open={!!confirmPack}
        title={t('patientDetail.deletePack')}
        description={t('patientDetail.deletePackConfirm', '¿Seguro que quieres eliminar este pack?')}
        confirmLabel={t('patientDetail.deletePack')}
        onConfirm={eliminarPack}
        onCancel={() => setConfirmPack(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t('patientDetail.deletePatientConfirmTitle')}
        description={t('patientDetail.deletePatientConfirmDesc')}
        confirmLabel={t('patientDetail.deletePatientConfirmBtn')}
        onConfirm={eliminarPaciente}
        onCancel={() => setConfirmDelete(false)}
        danger
      />

      <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-5">
        ← {t('patientDetail.back')}
      </Button>

      {/* ── Cabecera del paciente ── */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="heading-serif" style={{ fontSize: '1.25rem' }}>{paciente.nombre_completo}</h2>
              <Badge estado={info?.estado || 'pendiente'} label={info?.estado || t('admin.statusPending')} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{paciente.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={verRgpd}>
              📄 {t('patientDetail.rgpdDescargar')}
            </Button>
            {(info?.estado === 'inactivo' || info?.estado === 'archivado') ? (
              <Button variant="ghost" size="sm" loading={savingEstado} onClick={() => cambiarEstadoPaciente('activo')}>
                ↩ {t('patientDetail.reactivate')}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" loading={savingEstado} onClick={() => cambiarEstadoPaciente('inactivo')}>
                ⏸ {t('patientDetail.markInactive')}
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              🗑 {t('patientDetail.deletePatient')}
            </Button>
          </div>
        </div>
        {(info?.estado === 'inactivo' || info?.estado === 'archivado') && (
          <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#F1EBDE', color: '#7A6A53' }}>
            ⚠ {t('patientDetail.inactiveWarning')}
          </div>
        )}

        {/* Cobro online (Stripe/Bizum): opt-in por paciente */}
        <div className="mt-3 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
              {t('patientDetail.pagoOnlineTitle', 'Cobro online (tarjeta / Bizum)')}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {info?.pago_online_habilitado
                ? t('patientDetail.pagoOnlineOnDesc', 'Este paciente puede pagar sesiones y bonos desde su área.')
                : t('patientDetail.pagoOnlineOffDesc', 'Cobro manual. Actívalo para que pueda pagar online.')}
            </p>
          </div>
          <button
            onClick={togglePagoOnline}
            disabled={savingPagoOnline}
            role="switch"
            aria-checked={!!info?.pago_online_habilitado}
            className="relative rounded-full transition shrink-0"
            style={{
              width: 44, height: 24,
              backgroundColor: info?.pago_online_habilitado ? '#3B6D2A' : 'var(--border)',
              opacity: savingPagoOnline ? 0.6 : 1,
            }}
          >
            <span className="absolute rounded-full bg-white transition-all" style={{
              width: 18, height: 18, top: 3,
              left: info?.pago_online_habilitado ? 23 : 3,
            }} />
          </button>
        </div>
      </div>

      {/* ── Packs ── */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>{t('patientDetail.packs')}</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowPack(!showPack)}>
            {t('patientDetail.newPack')}
          </Button>
        </div>

        {showPack && (
          <form onSubmit={crearPack} className="flex gap-3 mb-4 items-center flex-wrap">
            <input type="number" min="1" max="50" value={packForm.num_sesiones_total}
              onChange={(e) => setPackForm({ ...packForm, num_sesiones_total: parseInt(e.target.value) })}
              className="field-input w-24" />
            <span className="text-sm" style={{ color: 'var(--text)' }}>{t('patientDetail.sessions')}</span>
            <div className="flex items-center gap-1">
              <input type="number" min="0" step="0.01" placeholder={t('patientDetail.priceOptional', 'Precio')}
                value={packForm.precio}
                onChange={(e) => setPackForm({ ...packForm, precio: e.target.value })}
                className="field-input w-28" title={t('patientDetail.priceHint', 'Precio del bono (editable para precios especiales)')} />
              <span className="text-sm" style={{ color: 'var(--text)' }}>€</span>
            </div>
            <Button type="submit" size="sm" loading={savingPack}>{t('patientDetail.create')}</Button>
          </form>
        )}

        {packs.length === 0 ? (
          <div>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{t('patientDetail.noPacks')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{t('patientDetail.noPacksHint')}</p>
          </div>
        ) : packs.map((pk) => {
          const pagoEstado = pk.estado_pago || 'no_pagado';
          const contratoEstado = pk.contrato_estado || 'sin_contrato';
          const contratoLabel = {
            sin_contrato:     t('patientDetail.contratoSinContrato'),
            enviado:          t('patientDetail.contratoEstadoEnviado'),
            firmado_paciente: t('patientDetail.contratoFirmadoPaciente'),
            completado:       t('patientDetail.contratoCompletado'),
          }[contratoEstado] || contratoEstado;

          return (
            <div key={pk.id} className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Fila principal: info + estado pack + eliminar */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--brand)' }}>
                  {pk.num_sesiones_usadas}/{pk.num_sesiones_total} {t('patientDetail.sessions')}
                  {pk.precio_cents != null && (
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {eur(pk.precio_cents)}</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Badge estado={pk.estado} label={pk.estado} />
                  <Button variant="danger" size="sm" onClick={() => setConfirmPack(pk.id)}>
                    {t('patientDetail.deletePack')}
                  </Button>
                </div>
              </div>

              {/* Fila pago */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {t('patientDetail.payment')}:
                </span>
                {['pagado', 'pago_parcial', 'no_pagado'].map((op) => (
                  <button
                    key={op}
                    disabled={savingPago === pk.id}
                    onClick={() => cambiarPago(pk.id, op)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full transition"
                    style={pagoEstado === op
                      ? { ...pagoStyles[op], border: `1.5px solid ${pagoStyles[op].color}` }
                      : { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)' }
                    }
                  >
                    {t(`patientDetail.${op}`)}
                  </button>
                ))}
                {info?.pago_online_habilitado && pagoEstado !== 'pagado' && pk.precio_cents != null && (
                  <button
                    disabled={enlacePagoId === pk.id}
                    onClick={() => copiarEnlacePago('pack', { pack_id: pk.id })}
                    className="text-xs font-medium px-2.5 py-1 rounded-full transition hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg)', color: 'var(--brand)', border: '1.5px solid var(--border)' }}
                  >
                    🔗 {enlacePagoId === pk.id ? t('patientDetail.generando', 'Generando…') : t('patientDetail.copiarEnlacePago', 'Copiar enlace de pago')}
                  </button>
                )}
              </div>

              {/* Fila cuotas: solo si el paciente eligió pago fraccionado (2 cuotas) */}
              {pk.num_cuotas === 2 && (pk.cuotas_pack || []).length > 0 && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {t('patientDetail.cuotas', 'Cuotas')}:
                  </span>
                  {[...pk.cuotas_pack].sort((a, b) => a.numero - b.numero).map((c) => (
                    <span key={c.id} className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      style={c.estado_pago === 'pagado'
                        ? { ...pagoStyles.pagado, border: `1.5px solid ${pagoStyles.pagado.color}` }
                        : { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)' }}>
                      {c.numero}/2 · {eur(c.importe_cents)}
                      {c.estado_pago === 'pagado'
                        ? ' ✓'
                        : c.fecha_limite ? ` · vence ${c.fecha_limite}` : ''}
                      {c.estado_pago !== 'pagado' && info?.pago_online_habilitado && (
                        <button
                          disabled={enlacePagoId === c.id}
                          onClick={() => copiarEnlacePago('cuota', { cuota_id: c.id })}
                          className="hover:opacity-70"
                          title={t('patientDetail.copiarEnlacePago', 'Copiar enlace de pago')}
                        >
                          🔗
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Fila contrato */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {t('patientDetail.contratoTitle')}:
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={contratoEstado === 'completado'
                    ? { backgroundColor: '#E9F0E1', color: '#3B6D2A' }
                    : (contratoEstado === 'firmado_paciente' || contratoEstado === 'enviado')
                    ? { backgroundColor: '#F8EFD2', color: '#B07A2B' }
                    : { backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
                  {contratoLabel}
                </span>

                {/* Admin puede descargar el que firmó el paciente */}
                {contratoEstado === 'firmado_paciente' && (
                  <Button variant="ghost" size="sm" onClick={() => descargarFirmadoPaciente(pk.id)}>
                    ⬇ {t('patientDetail.contratoDescargarFirmadoPaciente')}
                  </Button>
                )}

                {/* Dos caminos mientras no haya firma: subir el contrato firmado en
                    papel, o enviar el predeterminado (el paciente lo verá en su área).
                    Con firma en marcha, el botón de subida pasa a "definitivo". */}
                <Button
                  variant="ghost"
                  size="sm"
                  loading={uploadingContrato === pk.id}
                  onClick={() => { setContratoPackRef(pk.id); fileInputRef.current?.click(); }}
                >
                  ⬆ {(contratoEstado === 'sin_contrato' || contratoEstado === 'enviado')
                    ? t('patientDetail.contratoSubirPapel')
                    : t('patientDetail.contratoSubirFirmado')}
                </Button>
                {(contratoEstado === 'sin_contrato' || contratoEstado === 'enviado') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={enviandoContrato === pk.id}
                    onClick={() => enviarContratoPredeterminado(pk.id)}
                  >
                    ✉ {contratoEstado === 'enviado'
                      ? t('patientDetail.contratoReenviarPlantilla')
                      : t('patientDetail.contratoEnviarPlantilla')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sesiones ── */}
      <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg)' }}>
            {['upcoming', 'past'].map((t_) => (
              <button key={t_} onClick={() => setTab(t_)}
                className="text-xs font-semibold px-3 py-1.5 rounded-md transition"
                style={tab === t_ ? { backgroundColor: 'var(--brand)', color: 'white' } : { color: 'var(--text)' }}>
                {t(`patientDetail.${t_ === 'upcoming' ? 'upcoming' : 'past'}`)}
                {t_ === 'upcoming' && proximas.length > 0 && (
                  <span className="ml-1.5 text-xs rounded-full px-1.5"
                    style={{ backgroundColor: tab === 'upcoming' ? 'rgba(255,255,255,0.3)' : 'var(--border)', color: tab === 'upcoming' ? 'white' : 'var(--text)' }}>
                    {proximas.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowSesion(!showSesion)}>
            {t('patientDetail.newSession')}
          </Button>
        </div>

        {showSesion && (
          <form onSubmit={crearSesion} className="flex gap-3 flex-wrap mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
            <input type="datetime-local" required value={sesionForm.fecha_hora}
              onChange={(e) => setSesionForm({ ...sesionForm, fecha_hora: e.target.value })}
              className="field-input w-auto" />
            <select value={sesionForm.tipo} onChange={(e) => setSesionForm({ ...sesionForm, tipo: e.target.value })}
              className="field-input w-auto">
              <option value="videollamada">{t('patientDetail.videocall')}</option>
              <option value="presencial">{t('patientDetail.inPerson')}</option>
            </select>
            {sesionForm.tipo === 'videollamada' && (
              <input type="url"
                placeholder={googleOk ? t('calendar.meetAutoPlaceholder') : t('calendar.videoLinkOptional')}
                value={sesionForm.enlace_videollamada}
                onChange={(e) => setSesionForm({ ...sesionForm, enlace_videollamada: e.target.value })}
                className="field-input w-auto" style={{ minWidth: '220px' }} />
            )}
            {!packActivo && (
              <div className="flex items-center gap-1">
                <input type="number" min="0" step="0.01"
                  placeholder={t('patientDetail.priceOptional', 'Precio')}
                  value={sesionForm.precio}
                  onChange={(e) => setSesionForm({ ...sesionForm, precio: e.target.value })}
                  className="field-input w-28"
                  title={t('patientDetail.priceSessionHint', 'Precio de la sesión suelta (editable)')} />
                <span className="text-sm" style={{ color: 'var(--text)' }}>€</span>
              </div>
            )}
            <Button type="submit" size="sm" loading={savingSesion}>{t('patientDetail.create')}</Button>
          </form>
        )}
        {showSesion && packActivo && (
          <p className="text-xs mb-3 -mt-1" style={{ color: 'var(--muted)' }}>
            {t('patientDetail.sessionGoesToPack', 'Esta sesión se descontará del bono activo.')}
          </p>
        )}

        {sesionesTab.length === 0 ? (
          <p className="text-sm py-2" style={{ color: 'var(--text)' }}>
            {t(tab === 'upcoming' ? 'patientDetail.noUpcoming' : 'patientDetail.noPast')}
          </p>
        ) : sesionesTab.map((s) => {
          const esProxima = s.estado === 'programada' && parseWall(s.fecha_hora) >= ahora;
          const statusKey = `patientDetail.status${s.estado.charAt(0).toUpperCase() + s.estado.slice(1)}`;
          return (
            <div key={s.id} className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                    {format(parseWall(s.fecha_hora), "d MMM yyyy · HH:mm", { locale })}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                    {s.tipo === 'videollamada' ? t('patientDetail.videocall') : t('patientDetail.inPerson')} · {s.duracion_minutos} {t('patientDetail.min')}
                  </p>
                </div>
                <Badge estado={s.estado} label={t(statusKey)} />
              </div>

              {s.tipo === 'videollamada' && s.estado === 'programada' && (
                <div className="mt-1.5">
                  {editandoEnlaceId === s.id ? (
                    <div className="flex gap-2">
                      <input type="url" autoFocus placeholder={t('calendar.videoLinkPlaceholder')}
                        value={enlaceInput} onChange={(e) => setEnlaceInput(e.target.value)}
                        className="field-input text-xs" />
                      <Button size="sm" loading={savingEnlace} onClick={() => guardarEnlace(s.id)}>
                        {t('calendar.videoLinkSave')}
                      </Button>
                    </div>
                  ) : s.enlace_videollamada ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={s.enlace_videollamada} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium truncate max-w-[200px]" style={{ color: '#2C3E54' }}>
                        🔗 {s.enlace_videollamada}
                      </a>
                      <button onClick={() => { setEditandoEnlaceId(s.id); setEnlaceInput(s.enlace_videollamada || ''); }}
                        className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--brand)' }}>
                        {t('calendar.videoLinkEdit')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      {googleOk && (
                        <button disabled={generandoMeetId === s.id} onClick={() => generarMeet(s.id)}
                          className="text-xs font-medium hover:opacity-70 disabled:opacity-50" style={{ color: 'var(--brand)' }}>
                          ⚡ {generandoMeetId === s.id ? t('calendar.meetGenerating') : t('calendar.meetGenerate')}
                        </button>
                      )}
                      <button onClick={() => { setEditandoEnlaceId(s.id); setEnlaceInput(''); }}
                        className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--brand)' }}>
                        + {t('calendar.videoLinkAdd')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sesión suelta (sin pack): estado de pago + marcar pagada */}
              {!s.pack_id && s.estado_pago && s.estado !== 'cancelada' && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {t('patientDetail.payment')}{s.precio_cents != null ? ` · ${eur(s.precio_cents)}` : ''}:
                  </span>
                  {['pagado', 'no_pagado'].map((op) => (
                    <button
                      key={op}
                      disabled={savingPagoSesion === s.id}
                      onClick={() => cambiarPagoSesion(s.id, op)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full transition"
                      style={s.estado_pago === op
                        ? { ...pagoStyles[op], border: `1.5px solid ${pagoStyles[op].color}` }
                        : { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)' }
                      }
                    >
                      {t(`patientDetail.${op}`)}
                    </button>
                  ))}
                  {info?.pago_online_habilitado && s.estado_pago !== 'pagado' && s.precio_cents != null && (
                    <button
                      disabled={enlacePagoId === s.id}
                      onClick={() => copiarEnlacePago('sesion', { sesion_id: s.id })}
                      className="text-xs font-medium px-2.5 py-1 rounded-full transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--bg)', color: 'var(--brand)', border: '1.5px solid var(--border)' }}
                    >
                      🔗 {enlacePagoId === s.id ? t('patientDetail.generando', 'Generando…') : t('patientDetail.copiarEnlacePago', 'Copiar enlace de pago')}
                    </button>
                  )}
                </div>
              )}

              {(esProxima || (s.estado === 'programada' && parseWall(s.fecha_hora) < ahora)) && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <button onClick={() => cambiarEstado(s.id, 'completada')}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-90"
                    style={actionStyle.completada}>
                    ✓ {t('patientDetail.confirmAttendance')}
                  </button>
                  <button onClick={() => cambiarEstado(s.id, 'cancelada_con_cargo')}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-90"
                    style={actionStyle.cancelada_con_cargo}>
                    ✕ {t('patientDetail.cancelLate')}
                  </button>
                  <button onClick={() => { setReagendando(reagendando === s.id ? null : s.id); setNuevaFecha(''); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-90"
                    style={actionStyle.reagendar}>
                    ↻ {t('patientDetail.reschedule')}
                  </button>
                </div>
              )}
              {reagendando === s.id && (
                <div className="flex gap-2 mt-2 items-center">
                  <input type="datetime-local" value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="field-input w-auto text-xs py-1.5" />
                  <Button size="sm" onClick={() => confirmarReagendar(s.id)}>{t('patientDetail.confirm')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setReagendando(null)}>✕</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
