import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import api from '../utils/api';

// Pago de un bono: página PÚBLICA con enlace firmado, sin login. El paciente
// llega desde el enlace que le envía Andrea (o desde el recordatorio de la 2ª
// cuota) y elige pagarlo todo o en 2 pagos: la mitad antes de que acabe este
// mes y la otra mitad antes de que acabe el mes siguiente.
const T = {
  es: {
    cargando: 'Cargando…',
    titulo: 'Pago de tu bono',
    bono: (n) => `Bono de ${n} sesiones`,
    elige: 'Elige cómo prefieres pagarlo:',
    unicoTitulo: 'Pagarlo todo',
    unicoTexto: 'Un único pago ahora.',
    fracTitulo: 'En 2 pagos',
    fracTexto: (a, la, b, lb) => `${a} ahora (antes del ${la}) y ${b} el mes que viene (hasta el ${lb}). Te enviaremos un recordatorio por email.`,
    pagar: (x) => `Pagar ${x}`,
    cuota2Titulo: 'Segunda cuota pendiente',
    cuota2Texto: (l) => `Ya pagaste la primera mitad. Tienes hasta el ${l} para pagar la segunda.`,
    pagadoTitulo: 'Bono pagado ✓',
    pagadoTexto: 'Este bono ya está pagado por completo. ¡Gracias!',
    okTitulo: '¡Pago recibido! 🌱',
    okTexto: 'Gracias. En unos minutos lo verás reflejado en tu área privada.',
    cancelado: 'Pago cancelado. Puedes intentarlo de nuevo cuando quieras.',
    parcialTexto: 'Tienes un pago parcial registrado. Andrea te indicará cómo pagar el resto.',
    noDisponible: 'El pago online no está disponible para este bono. Contacta con Andrea.',
    nofoundTitulo: 'Enlace no válido',
    nofoundTexto: 'Este enlace no es correcto. Si crees que es un error, contacta con Andrea.',
    metodos: 'Pago seguro con tarjeta o Bizum a través de Stripe.',
    error: 'No se pudo iniciar el pago. Inténtalo de nuevo.',
  },
  en: {
    cargando: 'Loading…',
    titulo: 'Pay for your pack',
    bono: (n) => `Pack of ${n} sessions`,
    elige: 'Choose how you would like to pay:',
    unicoTitulo: 'Pay in full',
    unicoTexto: 'One single payment now.',
    fracTitulo: 'In 2 payments',
    fracTexto: (a, la, b, lb) => `${a} now (before ${la}) and ${b} next month (until ${lb}). We’ll send you an email reminder.`,
    pagar: (x) => `Pay ${x}`,
    cuota2Titulo: 'Second instalment pending',
    cuota2Texto: (l) => `You’ve already paid the first half. You have until ${l} to pay the second one.`,
    pagadoTitulo: 'Pack paid ✓',
    pagadoTexto: 'This pack is fully paid. Thank you!',
    okTitulo: 'Payment received! 🌱',
    okTexto: 'Thank you. It will show up in your private area in a few minutes.',
    cancelado: 'Payment cancelled. You can try again whenever you like.',
    parcialTexto: 'You have a partial payment registered. Andrea will tell you how to pay the rest.',
    noDisponible: 'Online payment is not available for this pack. Please contact Andrea.',
    nofoundTitulo: 'Invalid link',
    nofoundTexto: 'This link is not correct. If you think this is a mistake, contact Andrea.',
    metodos: 'Secure payment by card or Bizum via Stripe.',
    error: 'The payment could not be started. Please try again.',
  },
  da: {
    cargando: 'Indlæser…',
    titulo: 'Betaling af din pakke',
    bono: (n) => `Pakke med ${n} sessioner`,
    elige: 'Vælg, hvordan du vil betale:',
    unicoTitulo: 'Betal det hele',
    unicoTexto: 'Én samlet betaling nu.',
    fracTitulo: 'I 2 rater',
    fracTexto: (a, la, b, lb) => `${a} nu (inden ${la}) og ${b} næste måned (senest ${lb}). Vi sender dig en påmindelse på e-mail.`,
    pagar: (x) => `Betal ${x}`,
    cuota2Titulo: 'Anden rate mangler',
    cuota2Texto: (l) => `Du har allerede betalt den første halvdel. Du har indtil ${l} til at betale den anden.`,
    pagadoTitulo: 'Pakken er betalt ✓',
    pagadoTexto: 'Denne pakke er betalt fuldt ud. Tak!',
    okTitulo: 'Betaling modtaget! 🌱',
    okTexto: 'Tak. Om få minutter kan du se det i dit private område.',
    cancelado: 'Betalingen blev annulleret. Du kan prøve igen, når du vil.',
    parcialTexto: 'Du har en delvis betaling registreret. Andrea fortæller dig, hvordan du betaler resten.',
    noDisponible: 'Onlinebetaling er ikke tilgængelig for denne pakke. Kontakt Andrea.',
    nofoundTitulo: 'Ugyldigt link',
    nofoundTexto: 'Dette link er ikke korrekt. Hvis du mener, det er en fejl, så kontakt Andrea.',
    metodos: 'Sikker betaling med kort eller Bizum via Stripe.',
    error: 'Betalingen kunne ikke startes. Prøv igen.',
  },
};

const LOCALE = { es: 'es-ES', en: 'en-GB', da: 'da-DK' };

// Definidos FUERA del componente de página para que no se remonten en cada render.
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

function Opcion({ titulo, texto, boton, onClick, loading, principal }) {
  return (
    <div style={{ border: `1.5px solid ${principal ? '#5B4128' : '#E7DCC6'}`, borderRadius: 12, padding: 18, marginBottom: 12 }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#5B4128', margin: '0 0 4px' }}>{titulo}</p>
      <p style={{ fontSize: 14, margin: '0 0 14px', lineHeight: 1.5 }}>{texto}</p>
      <button type="button" onClick={onClick} disabled={loading}
        style={{
          background: principal ? '#5B4128' : '#F8F1E3', color: principal ? '#fff' : '#5B4128',
          border: principal ? 'none' : '1px solid #E7DCC6', padding: '11px 22px', borderRadius: 8,
          fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1,
        }}>
        {boton}
      </button>
    </div>
  );
}

export default function PagarBono() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [estado, setEstado] = useState('cargando'); // cargando|ok|nofound|listo
  const [lang, setLang] = useState('es');
  const [pagando, setPagando] = useState(null);

  useEffect(() => {
    const vuelta = new URLSearchParams(window.location.search).get('pago');
    if (vuelta) window.history.replaceState({}, '', window.location.pathname);
    api.get(`/pagos/publico/${token}`)
      .then((res) => {
        const idioma = T[res.data.idioma] ? res.data.idioma : 'es';
        setLang(idioma);
        setInfo(res.data);
        if (vuelta === 'ok') setEstado('ok');
        else {
          if (vuelta === 'cancelado') toast.info(T[idioma].cancelado);
          setEstado('listo');
        }
      })
      .catch(() => setEstado('nofound'));
  }, [token]);

  const pagar = async (plan) => {
    setPagando(plan);
    try {
      const res = await api.post(`/pagos/publico/${token}/checkout`, { plan });
      window.location.href = res.data.url;
    } catch {
      toast.error(T[lang].error);
      setPagando(null);
    }
  };

  const tt = T[lang];
  const eur = (c) => (c / 100).toLocaleString(LOCALE[lang], { style: 'currency', currency: 'EUR' });
  const fecha = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long' });

  if (estado === 'cargando') return <Wrap><p style={{ textAlign: 'center', color: '#7A6A53' }}>{tt.cargando}</p></Wrap>;
  if (estado === 'nofound') return <Wrap><H1>{tt.nofoundTitulo}</H1><p>{tt.nofoundTexto}</p></Wrap>;
  if (estado === 'ok') return <Wrap><H1>{tt.okTitulo}</H1><p>{tt.okTexto}</p></Wrap>;
  if (info.estado_pago === 'pagado') return <Wrap><H1>{tt.pagadoTitulo}</H1><p>{tt.pagadoTexto}</p></Wrap>;

  const cabecera = (
    <>
      <H1>{tt.titulo}</H1>
      {info.num_sesiones && (
        <p style={{ fontSize: 14, color: '#7A6A53', marginTop: 0 }}>
          {tt.bono(info.num_sesiones)}{info.precio_cents ? ` · ${eur(info.precio_cents)}` : ''}
        </p>
      )}
    </>
  );

  if (!info.disponible) return <Wrap>{cabecera}<p>{tt.noDisponible}</p></Wrap>;

  if (info.estado_pago === 'pago_parcial') {
    const c2 = info.cuota2_pendiente;
    return (
      <Wrap>
        {cabecera}
        {c2 ? (
          <Opcion principal titulo={tt.cuota2Titulo} texto={tt.cuota2Texto(fecha(c2.fecha_limite))}
            boton={tt.pagar(eur(c2.importe_cents))} loading={pagando === 'cuota2'} onClick={() => pagar('cuota2')} />
        ) : <p>{tt.parcialTexto}</p>}
        <p style={{ fontSize: 12, color: '#9A8A73', marginBottom: 0 }}>{tt.metodos}</p>
      </Wrap>
    );
  }

  const f = info.fraccionado;
  return (
    <Wrap>
      {cabecera}
      <p style={{ fontSize: 14, marginBottom: 16 }}>{tt.elige}</p>
      <Opcion principal titulo={tt.unicoTitulo} texto={tt.unicoTexto}
        boton={tt.pagar(eur(info.precio_cents))} loading={pagando === 'unico'} onClick={() => pagar('unico')} />
      <Opcion titulo={tt.fracTitulo}
        texto={tt.fracTexto(eur(f.cuota1_cents), fecha(f.cuota1_limite), eur(f.cuota2_cents), fecha(f.cuota2_limite))}
        boton={tt.pagar(eur(f.cuota1_cents))} loading={pagando === 'fraccionado'} onClick={() => pagar('fraccionado')} />
      <p style={{ fontSize: 12, color: '#9A8A73', marginBottom: 0 }}>{tt.metodos}</p>
    </Wrap>
  );
}
