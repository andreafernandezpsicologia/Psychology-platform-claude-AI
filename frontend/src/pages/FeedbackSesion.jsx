import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import api from '../utils/api';
import { preguntasDe, tituloDe, labelDe, opcionesDe } from '../config/feedbackPreguntas';

// Feedback de sesión (ORS antes / SRS después): página PÚBLICA con token, sin
// login. El paciente llega desde el enlace del email. Las preguntas vienen del
// catálogo compartido (config/feedbackPreguntas.js); aquí solo van los textos
// del "chrome" (saludo, botones, estados) en los 3 idiomas.
const T = {
  es: {
    cargando: 'Cargando…',
    hola: (n) => (n ? `Hola, ${n} 🌿` : 'Hola 🌿'),
    intro: 'Solo te llevará 30 segundos. Es voluntario y lo leo solo yo.',
    enviar: 'Enviar', enviando: 'Enviando…',
    graciasTitulo: '¡Gracias! 🌱', graciasTexto: 'Tu respuesta me ayuda a acompañarte mejor. — Andrea',
    respondidoTitulo: 'Ya respondido', respondidoTexto: 'Este cuestionario ya se había respondido. ¡Gracias por tu tiempo!',
    caducadoTitulo: 'Enlace caducado', caducadoTexto: 'Este enlace ya no está disponible (caduca a los 3 días). Si quieres, lo vemos en tu próxima sesión.',
    nofoundTitulo: 'Enlace no válido', nofoundTexto: 'Este enlace no es correcto o ha caducado. Si crees que es un error, contacta con Andrea.',
    error: 'Error, inténtalo de nuevo',
  },
  en: {
    cargando: 'Loading…',
    hola: (n) => (n ? `Hi ${n} 🌿` : 'Hi 🌿'),
    intro: 'It only takes 30 seconds. It’s voluntary and only I read it.',
    enviar: 'Send', enviando: 'Sending…',
    graciasTitulo: 'Thank you! 🌱', graciasTexto: 'Your answer helps me support you better. — Andrea',
    respondidoTitulo: 'Already answered', respondidoTexto: 'This questionnaire had already been answered. Thank you for your time!',
    caducadoTitulo: 'Link expired', caducadoTexto: 'This link is no longer available (it expires after 3 days). We can go over it in your next session.',
    nofoundTitulo: 'Invalid link', nofoundTexto: 'This link is not correct or has expired. If you think this is a mistake, contact Andrea.',
    error: 'Something went wrong, please try again',
  },
  da: {
    cargando: 'Indlæser…',
    hola: (n) => (n ? `Hej ${n} 🌿` : 'Hej 🌿'),
    intro: 'Det tager kun 30 sekunder. Det er frivilligt, og kun jeg læser det.',
    enviar: 'Send', enviando: 'Sender…',
    graciasTitulo: 'Tak! 🌱', graciasTexto: 'Dit svar hjælper mig med at støtte dig bedre. — Andrea',
    respondidoTitulo: 'Allerede besvaret', respondidoTexto: 'Dette spørgeskema er allerede blevet besvaret. Tak for din tid!',
    caducadoTitulo: 'Linket er udløbet', caducadoTexto: 'Dette link er ikke længere tilgængeligt (det udløber efter 3 dage). Vi kan tage det på din næste session.',
    nofoundTitulo: 'Ugyldigt link', nofoundTexto: 'Dette link er ikke korrekt eller er udløbet. Hvis du mener, det er en fejl, så kontakt Andrea.',
    error: 'Noget gik galt, prøv igen',
  },
};

// ── Componentes de presentación (definidos FUERA del componente de página para
// que no se remonten en cada render; si no, en móvil se cierra el teclado / se
// pierde el foco al interactuar) ─────────────────────────────────────────────
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

const H1 = ({ children }) => (
  <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#5B4128', marginTop: 0, marginBottom: 8 }}>{children}</h1>
);

function Escala({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
        <label style={{ fontSize: 14 }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#5B4128' }}>{value}/10</span>
      </div>
      <input type="range" min="0" max="10" step="1" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#5B4128' }} />
    </div>
  );
}

function Frecuencia({ label, opciones, value, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {opciones.map((op, idx) => (
          <button key={idx} type="button" onClick={() => onChange(idx)}
            style={{
              fontSize: 13, fontWeight: 500, padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #E7DCC6',
              background: value === idx ? '#5B4128' : '#F8F1E3',
              color: value === idx ? '#fff' : '#6B4F2E',
            }}>
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackSesion() {
  const { token } = useParams();
  const [estado, setEstado] = useState('cargando'); // cargando|form|respondido|caducado|nofound|gracias
  const [lang, setLang] = useState('es');
  const [nombre, setNombre] = useState(null);
  const [tipo, setTipo] = useState(null); // ors|srs
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/feedback/sesion/${token}`)
      .then((res) => {
        const { tipo: tp, nombre: nb, idioma, respondido, caducado } = res.data;
        setLang(T[idioma] ? idioma : 'es');
        setNombre(nb);
        setTipo(tp);
        // Valor inicial: mitad para deslizadores (5), primera opción para frecuencia (0).
        setRespuestas(Object.fromEntries(preguntasDe(tp).map((p) => [p.id, p.tipo === 'escala' ? 5 : 0])));
        if (respondido) setEstado('respondido');
        else if (caducado) setEstado('caducado');
        else setEstado('form');
      })
      .catch(() => setEstado('nofound'));
  }, [token]);

  const set = (id, v) => setRespuestas((prev) => ({ ...prev, [id]: Number(v) }));

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post(`/feedback/sesion/${token}`, { respuestas });
      setEstado('gracias');
    } catch (err) {
      const code = err.response?.status;
      if (code === 409) setEstado('respondido');
      else if (code === 410) setEstado('caducado');
      else toast.error(T[lang].error);
    } finally {
      setEnviando(false);
    }
  };

  const tt = T[lang];

  if (estado === 'cargando') return <Wrap><p style={{ textAlign: 'center', color: '#7A6A53' }}>{tt.cargando}</p></Wrap>;
  if (estado === 'nofound') return <Wrap><H1>{tt.nofoundTitulo}</H1><p>{tt.nofoundTexto}</p></Wrap>;
  if (estado === 'respondido') return <Wrap><H1>{tt.respondidoTitulo}</H1><p>{tt.respondidoTexto}</p></Wrap>;
  if (estado === 'caducado') return <Wrap><H1>{tt.caducadoTitulo}</H1><p>{tt.caducadoTexto}</p></Wrap>;
  if (estado === 'gracias') return <Wrap><H1>{tt.graciasTitulo}</H1><p>{tt.graciasTexto}</p></Wrap>;

  // estado === 'form'
  const preguntas = preguntasDe(tipo);
  return (
    <Wrap>
      <H1>{tt.hola(nombre)}</H1>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#5B4128', margin: '0 0 4px' }}>{tituloDe(tipo, lang)}</p>
      <p style={{ fontSize: 13, color: '#7A6A53', marginTop: 0, marginBottom: 20 }}>{tt.intro}</p>
      <form onSubmit={enviar}>
        {preguntas.map((p) => (
          p.tipo === 'escala' ? (
            <Escala key={p.id} label={labelDe(p, lang)} value={respuestas[p.id]} onChange={(v) => set(p.id, v)} />
          ) : (
            <Frecuencia key={p.id} label={labelDe(p, lang)} opciones={opcionesDe(p, lang)} value={respuestas[p.id]} onChange={(v) => set(p.id, v)} />
          )
        ))}
        <button type="submit" disabled={enviando}
          style={{ background: '#5B4128', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
          {enviando ? tt.enviando : tt.enviar}
        </button>
      </form>
    </Wrap>
  );
}
