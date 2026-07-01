// Generador de las guías "5 señales de que tu ansiedad es laboral" (ES / EN / DA).
// Reconstruye el diseño original (portada marrón + acentos dorados) y produce HTML
// que luego se convierte a PDF con Chrome headless (--print-to-pdf).
//
// Editar el CTA, textos o datos de contacto aquí y volver a ejecutar:
//   node tools/guias/build-guides.mjs
//   (y renderizar con Chrome; ver README junto a este archivo)
//
// Salida: tools/guias/out/*.html

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

// Fuentes de marca (Cormorant Garamond / Spectral / Jost) POR DEFECTO.
// Para volver a Georgia/Segoe (sistema, sin dependencias): BRAND_FONTS=0 node build-guides.mjs
const BRAND_FONTS = process.env.BRAND_FONTS !== '0';

// Bloque que reasigna fuentes y compensa tamaños (Cormorant rinde más pequeña/fina que Georgia).
const BRAND_CSS = !BRAND_FONTS ? '' : `
  @font-face{font-family:'Cormorant Garamond';src:url('../fonts/CormorantGaramond.ttf') format('truetype');font-weight:300 700;font-style:normal;}
  @font-face{font-family:'Cormorant Garamond';src:url('../fonts/CormorantGaramond-Italic.ttf') format('truetype');font-weight:300 700;font-style:italic;}
  @font-face{font-family:'Spectral';src:url('../fonts/Spectral-Regular.ttf') format('truetype');font-weight:400;font-style:normal;}
  @font-face{font-family:'Spectral';src:url('../fonts/Spectral-Medium.ttf') format('truetype');font-weight:500;font-style:normal;}
  @font-face{font-family:'Spectral';src:url('../fonts/Spectral-Italic.ttf') format('truetype');font-weight:400;font-style:italic;}
  @font-face{font-family:'Jost';src:url('../fonts/Jost.ttf') format('truetype');font-weight:300 700;font-style:normal;}
  :root{
    --display:'Cormorant Garamond',Georgia,serif;
    --body-serif:'Spectral',Georgia,serif;
    --sans:'Jost','Segoe UI',sans-serif;
  }
  body{ font-size:11pt; }
  h2{ font-size:25pt; font-weight:600; }
  .cover h1{ font-size:44pt; font-weight:600; }
  .cover .cov-sub{ font-size:18pt; }
  .cover .author .name{ font-size:18pt; }
  .sign-head h3{ font-size:17.5pt; font-weight:600; }
  .cta-box h3{ font-size:20pt; font-weight:600; }
  .signature{ font-size:14.5pt; }
`;

// ---------- Datos de contacto (compartidos en los 3 idiomas) ----------
const CONTACT = {
  email: 'info@studiorenacer.com',
  wa: '+34 668 541 597',
  waLink: 'https://wa.me/34668541597',
  ig: '@andreapsicologaonline',
  igLink: 'https://instagram.com/andreapsicologaonline',
  web: 'studiorenacer.com',
  webLink: 'https://studiorenacer.com'
};

function channelsHtml() {
  const sep = '<span class="sep">·</span>';
  return [
    `<a href="mailto:${CONTACT.email}">${CONTACT.email}</a>`,
    `WhatsApp <a href="${CONTACT.waLink}">${CONTACT.wa}</a>`,
    `Instagram <a href="${CONTACT.igLink}">${CONTACT.ig}</a>`,
    `<a href="${CONTACT.webLink}">${CONTACT.web}</a>`
  ].join(` ${sep} `);
}

// ---------- Contenido por idioma ----------
const DATA = {
  es: {
    file: 'guia-ansiedad-laboral-studio-renacer',
    lang: 'es',
    brandTop: 'STUDIO RENACER',
    coverEyebrow: 'GUÍA GRATUITA · PSICOEDUCACIÓN',
    titleHtml: '5 señales de que tu ansiedad <em>es laboral</em>',
    coverSubtitle: '(y qué hacer con cada una)',
    author: 'Andrea Fernández',
    authorLine: 'Studio Renacer',
    footerLeft: 'Studio Renacer ·Andrea Fernández ·psicóloga col. 27327',
    labels: { sign: 'LA SEÑAL', why: 'POR QUÉ PASA', todo: 'QUÉ HACER HOY' },
    before: {
      eyebrow: 'ANTES DE EMPEZAR',
      title: 'Si llevas tiempo a tope, esto es para ti',
      lead: 'Si no sabes si lo tuyo es «el estrés normal del trabajo» o algo más, esta guía es para ti.',
      paras: [
        'No para diagnosticarte —eso no se hace con un PDF— sino para que pongas nombre a lo que te pasa y tengas algo concreto que hacer hoy.',
        'Te digo una cosa desde el principio: la ansiedad del trabajo casi nunca se arregla con un truco. Pero reconocerla a tiempo lo cambia todo. Vamos, sin prisa.'
      ]
    },
    signs: [
      { t: 'El domingo por la tarde ya no es tuyo',
        sign: 'A media tarde del domingo aparece un nudo en el estómago, irritabilidad o un bajón. No estás triste por nada concreto: tu cabeza ya está en el lunes.',
        why: 'Es ansiedad anticipatoria. Tu sistema nervioso «ensaya» la semana por adelantado para protegerte; cuando el trabajo es una fuente de tensión sostenida, lo hace cada vez más pronto.',
        todo: 'Dedica 10 minutos a sacar de la cabeza al papel todo lo que temes del lunes (tareas, conversaciones, correos). Al lado de cada cosa, escribe solo el primer paso pequeño. No resuelve la semana, pero baja el volumen: lo que está escrito deja de dar vueltas.' },
      { t: 'Tu cuerpo se queja antes que tu cabeza',
        sign: 'Mandíbula apretada, cuello y hombros cargados, sueño que no descansa, digestiones revueltas, dolores de cabeza, palpitaciones. En la revisión «todo bien», pero el cuerpo va tenso.',
        why: 'La ansiedad sostenida vive en el cuerpo antes que en los pensamientos. Cuando la fuente es el trabajo, suele salir primero en lo físico: es más fácil ignorar una preocupación que un dolor.',
        todo: 'Haz la prueba del patrón: ¿esos síntomas aparecen en días u horas de trabajo y aflojan el fin de semana o en vacaciones? Si la respuesta es sí, no es casualidad. Apúntalo durante una semana; ese patrón es información de oro.' },
      { t: 'Desconectar te cuesta, o te da culpa',
        sign: 'Sigues mirando el correo fuera de hora «solo por si acaso». Y cuando por fin paras, en lugar de descansar, sientes culpa.',
        why: 'Es hipervigilancia más autoexigencia. Si tu valor está muy unido a tu rendimiento, parar se vive como una amenaza y no como un descanso.',
        todo: 'Crea un ritual de cierre de jornada de 3 minutos: una frase («por hoy, hasta aquí»), cerrar pestañas y una acción física que marque el final (apagar el ordenador, salir a la calle, cambiarte de ropa). Le enseñas a tu cerebro dónde termina el trabajo.' },
      { t: 'Por fuera rindes igual; por dentro estás al límite',
        sign: 'Cumples, entregas, nadie diría que estás mal. Pero por dentro vas con el freno de mano echado: te cuesta el doble y temes que se note.',
        why: 'Es la ansiedad de alto rendimiento. Compensas el malestar con más esfuerzo, así que nadie lo ve… hasta que el cuerpo dice basta (a veces, en forma de baja). Aguantar no es lo mismo que estar bien.',
        todo: 'Empieza a medir tu energía, no solo tus tareas. Al acabar el día, puntúa del 1 al 10 cómo de vacía/o terminaste. Pedir ayuda cuando los números bajan no es bajar el rendimiento: es justo lo que lo protege.' },
      { t: 'Lo que antes te llenaba ahora te da igual (o todo te irrita)',
        sign: 'Cosas que disfrutabas ya no te dicen nada, o saltas a la mínima. Te notas más cínica/o o «desconectada/o» del trabajo y de la gente.',
        why: 'Son señales de desgaste (burnout), que no es solo cansancio: es agotamiento emocional, distancia y la sensación de que nada de lo que haces sirve. El cuerpo apaga lo que no puede sostener.',
        todo: 'Distingue el cansancio puntual del desgaste sostenido. ¿Llevas así días sueltos o semanas seguidas? Si son semanas, no es «una mala racha»: es una señal clara de que toca parar a mirar la raíz, no apretar más.' }
    ],
    end: {
      eyebrow: 'Y AHORA',
      title: '¿Te has reconocido en dos o más?',
      lead: 'No es debilidad ni «ser flojo». Es tu cuerpo y tu mente avisándote de que este ritmo no es sostenible — y eso tiene solución.',
      noLabel: 'LO QUE NO FUNCIONA',
      noText: 'Aguantar y esperar a que pase solo, o tapar la ansiedad con un consejo suelto.',
      yesLabel: 'LO QUE SÍ',
      yesText: 'Ir a la raíz, a tu ritmo, con un acompañamiento de verdad. Sin prisa y sin renunciar a tu carrera.',
      ctaHeading: '¿Quieres dar el primer paso?',
      ctaLine: 'Escríbeme y empezamos, sin compromiso.',
      signature: '— Andrea Fernández · Studio Renacer',
      disclaimer: 'Esta guía es información educativa; no es una consulta ni un diagnóstico. Si lo estás pasando mal, hablar con un profesional ayuda. Si estás en una crisis, en España puedes llamar al 024 (conducta suicida) o al 112. · © 2026 Studio Renacer · Andrea Fernández, psicóloga colegiada n.º 27327.'
    }
  },

  en: {
    file: 'guide-work-anxiety-studio-renacer',
    lang: 'en',
    brandTop: 'STUDIO RENACER',
    coverEyebrow: 'FREE GUIDE · PSYCHOEDUCATION',
    titleHtml: '5 signs your anxiety <em>is work-related</em>',
    coverSubtitle: '(and what to do about each one)',
    author: 'Andrea Fernández',
    authorLine: 'Studio Renacer',
    footerLeft: 'Studio Renacer ·Andrea Fernández ·licensed psychologist (reg. 27327)',
    labels: { sign: 'THE SIGN', why: 'WHY IT HAPPENS', todo: 'WHAT TO DO TODAY' },
    before: {
      eyebrow: 'BEFORE WE START',
      title: 'If you’ve been running on empty, this is for you',
      lead: 'If you don’t know whether it’s “normal work stress” or something more, this guide is for you.',
      paras: [
        'Not to diagnose you —that’s not done with a PDF— but so you can put a name to what’s happening and have something concrete to do today.',
        'Let me tell you one thing up front: work anxiety is almost never fixed with a trick. But recognising it in time changes everything. Let’s go, no rush.'
      ]
    },
    signs: [
      { t: 'Sunday afternoon stops being yours',
        sign: 'By mid-afternoon on Sunday a knot appears in your stomach, irritability or a low mood. You’re not sad about anything specific: your head is already in Monday.',
        why: 'It’s anticipatory anxiety. Your nervous system “rehearses” the week in advance to protect you; when work is a source of sustained tension, it does so earlier and earlier.',
        todo: 'Spend 10 minutes getting everything you dread about Monday out of your head and onto paper (tasks, conversations, emails). Next to each, write only the first small step. It won’t solve the week, but it lowers the volume: what’s written stops spinning.' },
      { t: 'Your body complains before your head does',
        sign: 'Clenched jaw, tight neck and shoulders, sleep that doesn’t rest, upset digestion, headaches, palpitations. At the check-up “all fine”, but the body is tense.',
        why: 'Sustained anxiety lives in the body before the thoughts. When the source is work, it usually shows up first in the physical: it’s easier to ignore a worry than a pain.',
        todo: 'Do the pattern test: do those symptoms appear on work days or hours and ease off at the weekend or on holiday? If yes, it’s no coincidence. Note it for a week; that pattern is gold.' },
      { t: 'Switching off is hard, or makes you feel guilty',
        sign: 'You keep checking email after hours “just in case”. And when you finally stop, instead of resting, you feel guilty.',
        why: 'It’s hypervigilance plus self-demand. If your worth is tightly tied to your performance, stopping is experienced as a threat, not a rest.',
        todo: 'Create a 3-minute end-of-day ritual: a phrase (“for today, that’s it”), close your tabs and a physical action that marks the end (turn off the computer, step outside, change clothes). You teach your brain where work ends.' },
      { t: 'On the outside you perform the same; inside you’re at your limit',
        sign: 'You deliver, you cope, no one would say you’re struggling. But inside you’re driving with the handbrake on: it takes twice the effort and you fear it’ll show.',
        why: 'It’s high-performance anxiety. You compensate for the discomfort with more effort, so no one sees it… until the body says enough (sometimes as sick leave). Holding on is not the same as being well.',
        todo: 'Start measuring your energy, not just your tasks. At the end of the day, rate from 1 to 10 how empty you finished. Asking for help when the numbers drop isn’t lowering your performance: it’s exactly what protects it.' },
      { t: 'What used to fill you now leaves you cold (or everything irritates you)',
        sign: 'Things you used to enjoy say nothing to you now, or you snap at the slightest thing. You notice yourself more cynical or “disconnected” from work and from people.',
        why: 'These are signs of burnout, which isn’t just tiredness: it’s emotional exhaustion, distance and the feeling that nothing you do matters. The body shuts down what it can’t sustain.',
        todo: 'Tell apart occasional tiredness from sustained burnout. Have you been like this for odd days or for weeks on end? If it’s weeks, it’s not “a bad patch”: it’s a clear sign that it’s time to stop and look at the root, not push harder.' }
    ],
    end: {
      eyebrow: 'AND NOW',
      title: 'Have you recognised yourself in two or more?',
      lead: 'It’s not weakness or “being soft”. It’s your body and mind warning you that this pace isn’t sustainable — and that has a solution.',
      noLabel: 'WHAT DOESN’T WORK',
      noText: 'Holding on and waiting for it to pass on its own, or covering anxiety with a stray piece of advice.',
      yesLabel: 'WHAT DOES',
      yesText: 'Going to the root, at your pace, with real support. No rush and without giving up your career.',
      ctaHeading: 'Want to take the first step?',
      ctaLine: 'Message me and we’ll begin — no commitment.',
      signature: '— Andrea Fernández · Studio Renacer',
      disclaimer: 'This guide is educational information; it is not a consultation or a diagnosis. If you’re going through a hard time, talking to a professional helps. If you’re in a crisis, call your local emergency number (112 in the EU) or a helpline (024 in Spain; Livslinien 70 201 201 in Denmark). · © 2026 Studio Renacer · Andrea Fernández, licensed psychologist reg. no. 27327.'
    }
  },

  da: {
    file: 'guide-arbejdsangst-studio-renacer',
    lang: 'da',
    brandTop: 'STUDIO RENACER',
    coverEyebrow: 'GRATIS GUIDE · PSYKOEDUKATION',
    titleHtml: '5 tegn på, at din angst <em>er arbejdsrelateret</em>',
    coverSubtitle: '(og hvad du kan gøre ved hver enkelt)',
    author: 'Andrea Fernández',
    authorLine: 'Studio Renacer',
    footerLeft: 'Studio Renacer ·Andrea Fernández ·autoriseret psykolog (reg. 27327)',
    labels: { sign: 'TEGNET', why: 'HVORFOR DET SKER', todo: 'HVAD DU KAN GØRE I DAG' },
    before: {
      eyebrow: 'FØR VI BEGYNDER',
      title: 'Hvis du længe har kørt på pumperne, er dette til dig',
      lead: 'Hvis du ikke ved, om det er «almindelig arbejdsstress» eller noget mere, er denne guide til dig.',
      paras: [
        'Ikke for at diagnosticere dig —det gør man ikke med en PDF— men så du kan sætte ord på det, du oplever, og have noget konkret at gøre i dag.',
        'Lad mig sige én ting med det samme: arbejdsangst løses næsten aldrig med et trick. Men at genkende den i tide ændrer alt. Lad os tage det roligt.'
      ]
    },
    signs: [
      { t: 'Søndag eftermiddag er ikke længere din',
        sign: 'Midt på søndag eftermiddag dukker en knude i maven op, irritabilitet eller et nedtur. Du er ikke ked af noget bestemt: dit hoved er allerede i mandagen.',
        why: 'Det er foregribende angst. Dit nervesystem «øver» ugen på forhånd for at beskytte dig; når arbejdet er en kilde til vedvarende spænding, sker det tidligere og tidligere.',
        todo: 'Brug 10 minutter på at få alt det, du frygter ved mandagen, ud af hovedet og ned på papir (opgaver, samtaler, mails). Ved siden af hver ting skriver du kun det første lille skridt. Det løser ikke ugen, men skruer ned for lyden: det, der er skrevet ned, holder op med at køre rundt.' },
      { t: 'Din krop klager, før dit hoved gør',
        sign: 'Sammenbidt kæbe, spændt nakke og skuldre, søvn der ikke giver hvile, urolig fordøjelse, hovedpine, hjertebanken. Ved undersøgelsen «alt fint», men kroppen er spændt.',
        why: 'Vedvarende angst bor i kroppen før tankerne. Når kilden er arbejdet, viser den sig som regel først fysisk: det er lettere at ignorere en bekymring end en smerte.',
        todo: 'Lav mønster-testen: dukker de symptomer op på arbejdsdage eller -timer og letter i weekenden eller på ferie? Hvis ja, er det ikke tilfældigt. Skriv det ned i en uge; det mønster er guld værd.' },
      { t: 'At koble af er svært, eller giver dig skyldfølelse',
        sign: 'Du bliver ved med at tjekke mail uden for arbejdstid «bare for en sikkerheds skyld». Og når du endelig stopper, føler du i stedet for at hvile skyld.',
        why: 'Det er hypervågenhed plus høje krav til dig selv. Hvis dit værd er tæt knyttet til din præstation, opleves det at stoppe som en trussel og ikke som hvile.',
        todo: 'Lav et 3-minutters afslutningsritual for dagen: en sætning («for i dag er det nok»), luk faner og en fysisk handling, der markerer slutningen (sluk computeren, gå udenfor, skift tøj). Du lærer din hjerne, hvor arbejdet slutter.' },
      { t: 'Udadtil præsterer du som altid; indeni er du på kanten',
        sign: 'Du leverer, du klarer det, ingen ville sige, at du har det skidt. Men indeni kører du med håndbremsen trukket: det koster dig det dobbelte, og du frygter, at det vil ses.',
        why: 'Det er højtydende angst. Du kompenserer for ubehaget med mere indsats, så ingen ser det… indtil kroppen siger stop (nogle gange som sygemelding). At holde ud er ikke det samme som at have det godt.',
        todo: 'Begynd at måle din energi, ikke kun dine opgaver. Når dagen er slut, så giv fra 1 til 10 for, hvor tom du sluttede. At bede om hjælp, når tallene falder, er ikke at sænke præstationen: det er netop det, der beskytter den.' },
      { t: 'Det, der før fyldte dig, er nu ligegyldigt (eller alt irriterer dig)',
        sign: 'Ting, du nød, siger dig ikke længere noget, eller du farer op ved den mindste ting. Du mærker dig selv mere kynisk eller «frakoblet» fra arbejdet og fra folk.',
        why: 'Det er tegn på udbrændthed (burnout), som ikke kun er træthed: det er følelsesmæssig udmattelse, distance og fornemmelsen af, at intet af det, du gør, nytter. Kroppen slukker for det, den ikke kan bære.',
        todo: 'Skeln mellem forbigående træthed og vedvarende udbrændthed. Har du haft det sådan i enkelte dage eller uger i træk? Hvis det er uger, er det ikke «en dårlig periode»: det er et klart tegn på, at det er tid til at stoppe op og se på roden, ikke presse mere.' }
    ],
    end: {
      eyebrow: 'OG NU',
      title: 'Har du genkendt dig selv i to eller flere?',
      lead: 'Det er ikke svaghed eller at «være pylret». Det er din krop og dit sind, der advarer dig om, at dette tempo ikke er holdbart — og det kan løses.',
      noLabel: 'DET, DER IKKE VIRKER',
      noText: 'At holde ud og vente på, at det går over af sig selv, eller at dække angsten med et løsrevet råd.',
      yesLabel: 'DET, DER VIRKER',
      yesText: 'At gå til roden, i dit eget tempo, med ægte støtte. Uden hastværk og uden at opgive din karriere.',
      ctaHeading: 'Vil du tage det første skridt?',
      ctaLine: 'Skriv til mig, så går vi i gang — helt uforpligtende.',
      signature: '— Andrea Fernández · Studio Renacer',
      disclaimer: 'Denne guide er uddannelsesmæssig information; den er ikke en konsultation eller en diagnose. Hvis du har det svært, hjælper det at tale med en fagperson. Hvis du er i krise, kan du i Danmark ringe til Livslinien på 70 201 201 eller til 112. · © 2026 Studio Renacer · Andrea Fernández, autoriseret psykolog reg.nr. 27327.'
    }
  }
};

// ---------- Plantilla ----------
const CSS = `
  @page { size:210mm 297mm; margin:0; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  :root{
    /* Paleta oficial de marca Studio Renacer (Kit_de_Marca_StudioRenacer.html) */
    --paper:#F8F1E3;      /* crema — fondo principal */
    --ink:#5B4128;        /* marrón — titulares y tinta */
    --brown:#5B4128;      /* marrón — fondos con profundidad (portada, caja CTA) */
    --body:#5B4128;       /* marrón — cuerpo de texto */
    --muted:#7A6A53;      /* gris cálido — pies y notas */
    --oro:#E3A52A;        /* oro firma — filetes, círculos, enlaces, acentos */
    --ocre:#B07A2B;       /* ocre — etiquetas/eyebrows (dorado legible sobre crema) */
    --green:#3B6D2A;      /* verde — "lo que sí" */
    --red:#A33B2D;        /* terracota — "lo que no" */
    --card:#FFFFFF;       /* blanco — tarjetas */
    --line:rgba(91,65,40,.14);
    --cream:#F8F1E3;      /* crema — texto sobre marrón */
    --cream-muted:#C9A671;/* crema apagada sobre marrón */
    /* Fuentes: por defecto Georgia/Segoe; con BRAND_FONTS=1 se reasignan a Cormorant/Spectral/Jost */
    --display:Georgia,'Times New Roman',serif;
    --body-serif:Georgia,'Times New Roman',serif;
    --sans:'Segoe UI',Helvetica,Arial,sans-serif;
  }
  html,body{ background:#fff; }
  body{ font-family:var(--body-serif); color:var(--body); font-size:10.5pt; line-height:1.5; }
  .page{
    position:relative; width:210mm; height:297mm; padding:20mm 22mm 22mm;
    background:var(--paper); overflow:hidden; page-break-after:always;
  }
  .page:last-child{ page-break-after:auto; }
  .sans{ font-family:var(--sans); }
  .eyebrow{ font-family:var(--sans); font-size:8.5pt; font-weight:700;
    letter-spacing:.22em; color:var(--ocre); text-transform:uppercase; margin-bottom:9pt; }
  h2{ font-family:var(--display); font-weight:700; font-size:20pt; line-height:1.15; color:var(--ink); margin-bottom:11pt; }
  .lead{ font-style:italic; color:#6B4F2E; font-size:11.5pt; margin-bottom:13pt; }
  p{ margin-bottom:9pt; }
  .footer{ position:absolute; left:22mm; right:22mm; bottom:12mm;
    font-family:var(--sans); font-size:7.5pt; color:#9A8B73;
    display:flex; justify-content:space-between; }

  /* ---------- Portada ---------- */
  .cover{ background:var(--brown); color:var(--cream); display:flex; flex-direction:column; padding:24mm 24mm 22mm; }
  .cover .brandtop{ font-family:var(--sans); font-size:11pt; font-weight:700;
    letter-spacing:.42em; color:var(--oro); }
  .cover .spacer{ flex:0 0 auto; }
  .cover .mid{ margin-top:auto; }
  .cover .cov-eyebrow{ font-family:var(--sans); font-size:9.5pt; font-weight:700;
    letter-spacing:.24em; color:var(--oro); opacity:.9; }
  .cover .rule{ width:46px; height:3px; background:var(--oro); margin:16pt 0 18pt; }
  .cover h1{ font-family:var(--display); font-weight:700; font-size:37pt; line-height:1.08; color:var(--cream); letter-spacing:-0.01em; }
  .cover h1 em{ color:var(--oro); font-style:italic; }
  .cover .cov-sub{ font-family:var(--display); font-style:italic; font-size:15pt; color:var(--cream-muted); margin-top:14pt; }
  .cover .author{ margin-top:auto; }
  .cover .author .name{ font-family:var(--display); font-size:16pt; color:var(--cream); }
  .cover .author .role{ font-family:var(--sans); font-size:9pt; color:var(--cream-muted); margin-top:5pt; }
  .cover .author .web{ font-family:var(--sans); font-size:9pt; letter-spacing:.2em;
    color:var(--oro); margin-top:9pt; }

  /* ---------- Señales ---------- */
  .sign{ margin-top:15pt; }
  .sign:first-of-type{ margin-top:6pt; }
  .sign-head{ display:flex; align-items:center; gap:11pt; margin-bottom:8pt; }
  .num{ flex:0 0 auto; width:22pt; height:22pt; border-radius:50%; background:var(--oro); color:var(--brown);
    font-family:var(--sans); font-weight:600; font-size:10.5pt; display:flex; align-items:center; justify-content:center; }
  .sign-head h3{ font-family:var(--display); font-weight:700; font-size:14.5pt; color:var(--ink); line-height:1.15; }
  .lbl{ font-family:var(--sans); font-size:8pt; font-weight:700; letter-spacing:.16em;
    text-transform:uppercase; color:var(--ocre); margin:9pt 0 4pt; }
  .todo{ background:var(--card); border:1px solid var(--line); border-left:4px solid var(--oro);
    border-radius:9px; padding:11pt 14pt 4pt; margin-top:11pt; }
  .todo .lbl{ margin-top:0; }
  .divider{ border:none; border-top:1px solid var(--line); margin:15pt 0 0; }

  /* ---------- Página final ---------- */
  .two-cards{ display:flex; gap:14pt; margin:6pt 0 16pt; }
  .two-cards .card{ flex:1; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:13pt 15pt 6pt; }
  .card .lbl.red{ color:var(--red); }
  .card .lbl.green{ color:var(--green); }
  .cta-box{ background:var(--brown); color:var(--cream); border-radius:12px; padding:17pt 20pt; margin-top:4pt; }
  .cta-box h3{ font-family:var(--display); font-weight:700; font-size:16pt; color:var(--cream); margin-bottom:8pt; }
  .cta-box .cta-line{ color:var(--cream); margin-bottom:8pt; }
  .cta-box .cta-channels{ font-family:var(--sans); font-size:9.5pt; line-height:1.9;
    color:var(--cream); margin-bottom:0; }
  .cta-box a{ color:var(--oro); font-weight:700; text-decoration:none; }
  .cta-box .sep{ color:#7d6a4e; margin:0 3pt; }
  .signature{ font-family:var(--display); font-style:italic; font-size:12pt; color:#6B4F2E; margin:16pt 0 0; }
  .disclaimer{ font-family:var(--sans); font-size:7.5pt; line-height:1.55;
    color:#8A7C64; margin-top:14pt; }
`;

function signHtml(s, n, labels, withDivider = true) {
  return `
    <section class="sign">
      <div class="sign-head"><span class="num">${n}</span><h3>${s.t}</h3></div>
      <div class="lbl">${labels.sign}</div>
      <p>${s.sign}</p>
      <div class="lbl">${labels.why}</div>
      <p>${s.why}</p>
      <div class="todo"><div class="lbl">${labels.todo}</div><p>${s.todo}</p></div>
    </section>${withDivider ? '\n    <hr class="divider">' : ''}`;
}

function render(d) {
  const L = d.labels;
  const b = d.before;
  const e = d.end;
  const footer = (n) => `<div class="footer"><span>${d.footerLeft}</span><span>${CONTACT.web} ·${n}</span></div>`;

  return `<!doctype html><html lang="${d.lang}"><head><meta charset="utf-8">
<title>${d.file}</title><style>${CSS}${BRAND_CSS}</style></head><body>

<div class="page cover">
  <div class="brandtop">${d.brandTop}</div>
  <div class="mid">
    <div class="cov-eyebrow">${d.coverEyebrow}</div>
    <div class="rule"></div>
    <h1>${d.titleHtml}</h1>
    <div class="cov-sub">${d.coverSubtitle}</div>
  </div>
  <div class="author">
    <div class="name">${d.author}</div>
    <div class="role">${d.authorLine}</div>
    <div class="web">${CONTACT.web}</div>
  </div>
</div>

<div class="page">
  <div class="eyebrow">${b.eyebrow}</div>
  <h2>${b.title}</h2>
  <p class="lead">${b.lead}</p>
  ${b.paras.map(p => `<p>${p}</p>`).join('')}
  ${signHtml(d.signs[0], 1, L, true)}
  ${signHtml(d.signs[1], 2, L, false)}
  ${footer(2)}
</div>

<div class="page">
  ${signHtml(d.signs[2], 3, L, true)}
  ${signHtml(d.signs[3], 4, L, false)}
  ${footer(3)}
</div>

<div class="page">
  ${signHtml(d.signs[4], 5, L, false)}
  ${footer(4)}
</div>

<div class="page">
  <div class="eyebrow">${e.eyebrow}</div>
  <h2>${e.title}</h2>
  <p class="lead" style="font-style:normal;color:var(--body)">${e.lead}</p>
  <div class="two-cards">
    <div class="card"><div class="lbl red">${e.noLabel}</div><p>${e.noText}</p></div>
    <div class="card"><div class="lbl green">${e.yesLabel}</div><p>${e.yesText}</p></div>
  </div>
  <div class="cta-box">
    <h3>${e.ctaHeading}</h3>
    <p class="cta-line">${e.ctaLine}</p>
    <p class="cta-channels">${channelsHtml()}</p>
  </div>
  <p class="signature">${e.signature}</p>
  <p class="disclaimer">${e.disclaimer}</p>
  ${footer(5)}
</div>

</body></html>`;
}

for (const key of Object.keys(DATA)) {
  const d = DATA[key];
  const html = render(d);
  const path = join(OUT, `${d.file}.html`);
  writeFileSync(path, html, 'utf8');
  console.log('escrito', path);
}
console.log('OK');
