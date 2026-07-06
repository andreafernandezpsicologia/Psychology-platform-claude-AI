import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Layout from '../../components/common/Layout';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SkeletonTable } from '../../components/common/Skeleton';
import api from '../../utils/api';

export default function AdminDashboard() {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: '', nombre: '', idioma: 'es' });
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    api.get('/pacientes')
      .then((res) => setPacientes(res.data))
      .catch(() => toast.error(t('admin.loadError', 'Error al cargar pacientes')))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/auth/invitar-paciente', invite);
      toast.success(`${t('admin.inviteSent')} ${invite.email}`);
      setInvite({ email: '', nombre: '', idioma: 'es' });
      setShowInvite(false);
      const res = await api.get('/pacientes');
      setPacientes(res.data);
    } catch (err) {
      toast.error(t('admin.inviteError') + (err.response?.data?.error || ''));
    } finally {
      setInviting(false);
    }
  };

  const esInactivo = (estado) => estado === 'inactivo' || estado === 'archivado';
  const inactivosCount = pacientes.filter(p => esInactivo(p.pacientes?.estado)).length;

  const filtered = pacientes.filter((p) => {
    const estado = p.pacientes?.estado;
    if (!showInactivos && esInactivo(estado)) return false;
    const q = search.toLowerCase();
    return (
      p.nombre_completo?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="heading-serif" style={{ fontSize: '1.5rem' }}>
          {t('admin.myPatients')}
        </h2>
        <Button onClick={() => setShowInvite(!showInvite)}>
          {t('admin.invitePatient')}
        </Button>
      </div>

      {showInvite && (
        <div className="bg-white rounded-xl p-5 mb-5" style={{ border: '1px solid var(--border)' }}>
          <h3 className="font-semibold mb-4 text-sm" style={{ color: 'var(--brand)' }}>
            {t('admin.newInvitation')}
          </h3>
          <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
            <input
              type="text"
              required
              placeholder={t('admin.fullName')}
              value={invite.nombre}
              onChange={(e) => setInvite({ ...invite, nombre: e.target.value })}
              className="field-input flex-1 min-w-40"
            />
            <input
              type="email"
              required
              placeholder={t('admin.colEmail')}
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              className="field-input flex-1 min-w-40"
            />
            <select
              value={invite.idioma}
              onChange={(e) => setInvite({ ...invite, idioma: e.target.value })}
              className="field-input w-auto"
              title={t('admin.language', 'Idioma de las comunicaciones')}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="da">Dansk</option>
            </select>
            <Button type="submit" loading={inviting}>
              {t('admin.sendInvitation')}
            </Button>
          </form>
        </div>
      )}

      {pacientes.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="search"
            placeholder={t('admin.searchPlaceholder', 'Buscar por nombre o email…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input max-w-xs"
          />
          {inactivosCount > 0 && (
            <button
              onClick={() => setShowInactivos(!showInactivos)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition"
              style={{
                backgroundColor: showInactivos ? 'var(--brand)' : 'var(--bg)',
                color: showInactivos ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {showInactivos
                ? t('admin.hideInactive', 'Ocultar inactivos')
                : t('admin.showInactive', `Mostrar inactivos (${inactivosCount})`)}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: '1px solid var(--border)' }}>
          <p className="font-medium" style={{ color: 'var(--brand)' }}>
            {search ? t('admin.noResults', 'Sin resultados') : t('admin.noPatients')}
          </p>
          {!search && (
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{t('admin.noPatientsHint')}</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {[t('admin.colName'), t('admin.colEmail'), t('admin.colStatus'), t('admin.colPacks'), ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const pac = p.pacientes;
                const packActivo = pac?.packs?.find((pk) => pk.estado === 'activo');
                const estado = pac?.estado || 'pendiente';
                const inactivo = esInactivo(estado);
                return (
                  <tr
                    key={p.id}
                    className="transition hover:bg-[var(--bg)]"
                    style={{ borderBottom: '1px solid var(--border)', opacity: inactivo ? 0.5 : 1 }}
                  >
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--brand)' }}>{p.nombre_completo}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{p.email}</td>
                    <td className="px-4 py-3">
                      <Badge estado={estado} label={pac?.estado || t('admin.statusPending')} />
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text)' }}>
                      {packActivo ? `${packActivo.num_sesiones_usadas}/${packActivo.num_sesiones_total} ${t('admin.sessions')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/paciente/${p.id}`)}>
                        {t('admin.viewDetail')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
