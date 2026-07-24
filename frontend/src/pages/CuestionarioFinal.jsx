import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import api from '../utils/api';

const OPINAR_URL = 'https://www.studiorenacer.com/opinar.html';

// Componentes de presentación definidos FUERA de la página: si se definen dentro
// del componente, cada pulsación (setForm → render) crea funciones nuevas que
// React trata como componentes distintos, remonta el <textarea> y pierde el
// foco — en móvil eso cierra el teclado en cada letra.
function Wrap({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FBF6EB 0%, #F8F1E3 45%, #F3E9D4 100%)', padding: '32px 16px', fontFamily: "'Jost', system-ui, sans-serif", color: '#6B4F2E' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, color: '#5B4128' }}>Studio Renacer</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E7DCC6', borderRadius: 16, padding: 28 }}>
          {children}
        </div>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}

function Escala({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 14 }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#5B4128' }}>{value}/10</span>
      </div>
      <input type="range" min="0" max="10" step="1" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#5B4128' }} />
    </div>
  );
}

function Texto({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        style={{ width: '100%', border: '1px solid #E7DCC6', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 14, color: '#6B4F2E', resize: 'vertical' }} />
    </div>
  );
}

// Cuestionario de fin de terapia: página PÚBLICA con token, sin login (el
// paciente puede que ya no entre a la app). Estilo propio de marca.
export default function CuestionarioFinal() {
  const { token } = useParams();
  const [estado, setEstado] = useState('cargando'); // cargando | form | respondido | nofound | gracias
  const [nombre, setNombre] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    satisfaccion: 8, recomendaria: 8, que_ayudo: '', que_mejorar: '', como_te_vas: '',
  });

  useEffect(() => {
    api.get(`/feedback/final/${token}`)
      .then((res) => {
        setNombre(res.data.nombre);
        setEstado(res.data.respondido ? 'respondido' : 'form');
      })
      .catch(() => setEstado('nofound'));
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post(`/feedback/final/${token}`, form);
      setEstado('gracias');
    } catch (err) {
      const code = err.response?.status;
      if (code === 409) { setEstado('respondido'); }
      else toast.error('Error: ' + (err.response?.data?.error || 'Inténtalo de nuevo'));
    } finally {
      setEnviando(false);
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  if (estado === 'cargando') return <Wrap><p style={{ textAlign: 'center', color: '#7A6A53' }}>Cargando…</p></Wrap>;

  if (estado === 'nofound') return (
    <Wrap>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#5B4128', marginTop: 0 }}>Enlace no válido</h1>
      <p>Este enlace no es correcto o ha caducado. Si crees que es un error, contacta con Andrea.</p>
    </Wrap>
  );

  if (estado === 'respondido') return (
    <Wrap>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#5B4128', marginTop: 0 }}>Ya respondido</h1>
      <p>Este cuestionario ya se había respondido. ¡Gracias por tu tiempo!</p>
    </Wrap>
  );

  if (estado === 'gracias') return (
    <Wrap>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#5B4128', marginTop: 0 }}>¡Gracias de corazón! 🌱</h1>
      <p>Tu respuesta me ayuda muchísimo a seguir mejorando. Ha sido un placer acompañarte.</p>
      <div style={{ marginTop: 20, padding: 16, background: '#F8F1E3', borderRadius: 12 }}>
        <p style={{ margin: '0 0 12px', fontSize: 14 }}>Si te apetece, y solo si quieres, puedes dejar una opinión pública para ayudar a otras personas que estén buscando apoyo:</p>
        <a href={OPINAR_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', background: '#B07A2B', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          Dejar una opinión (opcional)
        </a>
      </div>
    </Wrap>
  );

  // estado === 'form'
  return (
    <Wrap>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#5B4128', marginTop: 0, marginBottom: 4 }}>
        {nombre ? `Hola, ${nombre}` : 'Hola'} 🌿
      </h1>
      <p style={{ fontSize: 14, color: '#7A6A53', marginTop: 0, marginBottom: 20 }}>
        Has cerrado tu proceso. Cuéntame cómo ha sido tu experiencia — es voluntario y solo lo leo yo.
      </p>
      <form onSubmit={enviar}>
        <Escala label="¿Cómo de satisfecho/a estás con el proceso de terapia?" value={form.satisfaccion} onChange={(v) => set('satisfaccion', v)} />
        <Escala label="¿Recomendarías a Andrea a alguien que lo necesite?" value={form.recomendaria} onChange={(v) => set('recomendaria', v)} />
        <Texto label="¿Qué es lo que más te ha ayudado?" value={form.que_ayudo} onChange={(v) => set('que_ayudo', v)} />
        <Texto label="¿Qué mejorarías o echaste en falta?" value={form.que_mejorar} onChange={(v) => set('que_mejorar', v)} />
        <Texto label="¿Cómo te vas, cómo te sientes al cerrar este proceso?" value={form.como_te_vas} onChange={(v) => set('como_te_vas', v)} />
        <button type="submit" disabled={enviando}
          style={{ background: '#5B4128', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </Wrap>
  );
}
