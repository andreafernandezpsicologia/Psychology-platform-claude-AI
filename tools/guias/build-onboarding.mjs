// Generador de la guía de bienvenida "Cómo funciona tu área privada" (ES / EN / DA).
// Para pacientes que ya venían trabajando con Andrea en papel y ahora reciben
// acceso a la app (activar cuenta, pedir cita, videollamada, bono, contrato, RGPD).
//
// Mismo patrón que build-guides.mjs: HTML con fuentes de marca → PDF con Chrome
// headless (--print-to-pdf). Editar textos aquí y volver a ejecutar:
//   node tools/guias/build-onboarding.mjs
//   (y renderizar con Chrome; ver memoria "landing-deploy-and-guides" para el gotcha de OneDrive)
//
// Salida: tools/guias/out/*.html

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

// Fuentes de marca (Cormorant Garamond / Spectral / Jost) POR DEFECTO.
// BRAND_FONTS=0 node build-onboarding.mjs → fallback a Georgia/Segoe (sistema).
const BRAND_FONTS = process.env.BRAND_FONTS !== '0';

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
  .step-head h3{ font-size:17.5pt; font-weight:600; }
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
  webLink: 'https://studiorenacer.com',
  app: 'app.studiorenacer.com',
  appLink: 'https://app.studiorenacer.com',
};

function channelsHtml() {
  const sep = '<span class="sep">·</span>';
  return [
    `<a href="mailto:${CONTACT.email}">${CONTACT.email}</a>`,
    `WhatsApp <a href="${CONTACT.waLink}">${CONTACT.wa}</a>`,
    `Instagram <a href="${CONTACT.igLink}">${CONTACT.ig}</a>`,
    `<a href="${CONTACT.webLink}">${CONTACT.web}</a>`,
  ].join(` ${sep} `);
}

// ---------- Contenido por idioma ----------
const DATA = {
  es: {
    file: 'guia-area-privada-studio-renacer',
    lang: 'es',
    brandTop: 'STUDIO RENACER',
    coverEyebrow: 'TU ÁREA PRIVADA · GUÍA DE USO',
    titleHtml: 'Cómo funciona tu <em>área privada</em>',
    coverSubtitle: '(pedir cita, videollamada y más, paso a paso)',
    author: 'Andrea Fernández',
    authorLine: 'Studio Renacer',
    footerLeft: 'Studio Renacer ·Andrea Fernández ·psicóloga col. 27327',
    tipLabel: 'CONSEJO',
    intro: {
      eyebrow: 'BIENVENIDA/O',
      title: 'Ahora también gestionas tus sesiones online',
      lead: 'Tu terapia sigue exactamente igual. Lo único que cambia es que ahora tienes un espacio privado para pedir citas, unirte a las videollamadas y tener tus cosas a mano.',
      paras: [
        'He preparado esta guía para que empezar te resulte fácil. No necesitas saber de tecnología: son unos pocos pasos y, si algo no sale, me escribes y lo vemos juntas/os.',
        'Tu área privada está en <strong>app.studiorenacer.com</strong>. Es un espacio seguro y confidencial: solo tú y yo tenemos acceso a tu información.',
      ],
    },
    steps: [
      { t: 'Activar tu cuenta',
        body: [
          'Recibirás un email de <strong>Studio Renacer</strong> con el asunto «Activa tu cuenta». Ábrelo y pulsa el enlace.',
          'Primero eliges tu <strong>contraseña</strong> (mínimo 8 caracteres, con una mayúscula y un número). Después confirmas el <strong>consentimiento informado</strong>: es el mismo que ya firmaste conmigo en papel, ahora en digital, para que quede todo en un único sitio.',
        ],
        tip: 'El enlace del email caduca por seguridad. Si te ha caducado, dímelo y te reenvío uno nuevo en un momento.' },
      { t: 'Entrar cada vez',
        body: [
          'A partir de ahí, entras siempre desde <strong>app.studiorenacer.com</strong> con tu email y tu contraseña.',
          '¿Se te olvida la contraseña? En la pantalla de acceso pulsa «¿Olvidaste tu contraseña?» y sigue los pasos del email. No hace falta avisarme.',
        ] },
      { t: 'Pedir y gestionar tus citas',
        body: [
          'En tu panel, en el <strong>calendario</strong>, verás la fecha y la hora de tus citas ya programadas.',
          'Si quieres <strong>pedir otra cita o cambiar una</strong>, puedes solicitarlo ahí mismo: eliges día y hora libre (videollamada o presencial) y yo lo confirmo desde mi lado; te llega un email con la fecha.',
          'Y si alguna vez necesitas <strong>cancelar</strong>, recuerda la política de cancelación de 24 h que figura en tu contrato de servicios.',
        ],
        tip: 'Al confirmar una cita puedes añadirla a tu calendario (Google, Apple…) con un solo clic, para que no se te pase.' },
      { t: 'Unirte a la videollamada',
        body: [
          'Si tu sesión es online, en la propia cita aparece el <strong>enlace de la videollamada</strong>. No tienes que instalar nada.',
          'Unos minutos antes de la hora, entra en tu área privada, abre la sesión y pulsa el enlace. Busca un sitio tranquilo donde estés cómoda/o.',
        ] },
      { t: 'Tu bono de sesiones',
        body: [
          'En la parte de arriba verás tu <strong>bono</strong>: cuántas sesiones tienes y cuántas te quedan. Se actualiza solo a medida que las hacemos.',
          'Así siempre sabes cómo vas, sin tener que llevar tú la cuenta.',
        ] },
      { t: 'Tu contrato de servicios',
        body: [
          'El contrato que firmamos también queda guardado en tu área privada, en la sección de contrato, para que puedas <strong>consultarlo o descargarlo</strong> cuando lo necesites.',
        ] },
      { t: 'Tus datos y tus derechos',
        body: [
          'Tu información es confidencial y se guarda cifrada en servidores europeos. En cualquier momento puedes <strong>exportar todos tus datos</strong> desde tu área privada (botón de exportar), y ejercer tus derechos de acceso, rectificación o supresión.',
          'Para cualquier cosa relacionada con tus datos, escríbeme a <strong>info@studiorenacer.com</strong>.',
        ] },
    ],
    rules: {
      eyebrow: 'ANTES DE TU SESIÓN',
      title: 'Cómo preparar tu videollamada',
      lead: 'Unos pequeños detalles hacen que la sesión online sea tan cómoda y útil como una presencial.',
      groups: [
        { label: 'TU EQUIPO Y TU ESPACIO', items: [
          { t: 'Buena conexión y batería', d: 'Conéctate donde tengas internet estable y con el dispositivo cargado o enchufado, para que la sesión no se corte.' },
          { t: 'Que se te vea bien', d: 'Coloca la cámara de forma que se te vea la cara y el cuerpo al menos desde el pecho, con luz de frente (evita tener la ventana detrás).' },
          { t: 'Auriculares, mejor', d: 'Preferiblemente con auriculares: se oye mejor y añaden privacidad.' },
          { t: 'Un lugar privado y seguro', d: 'Busca un espacio tranquilo donde estés a solas y nadie te interrumpa ni te escuche.' },
        ] },
        { label: 'DURANTE LA SESIÓN', items: [
          { t: 'Sin distracciones', d: 'Móvil en silencio y evita hacer otras cosas mientras hablamos.' },
          { t: 'Confidencialidad', d: 'La sesión es privada: estate a solas y no la grabes ni hagas capturas.' },
          { t: 'Ponte cómoda/o', d: 'Ten agua y pañuelos a mano y colócate donde puedas hablar con tranquilidad.' },
        ] },
      ],
      note: 'Y sobre todo: es tu espacio, sin juicio. Habla con la libertad que necesites.',
    },
    end: {
      eyebrow: '¿DUDAS?',
      title: 'Estoy a un mensaje de distancia',
      lead: 'Si algún paso no te sale o tienes cualquier duda, no te pelees con la pantalla: escríbeme y lo resolvemos enseguida.',
      ctaHeading: 'Escríbeme cuando quieras',
      ctaLine: 'Estoy encantada de ayudarte a dar el primer paso.',
      signature: '— Andrea Fernández · Studio Renacer',
      disclaimer: 'Esta guía explica cómo usar tu área privada; no es una consulta ni sustituye a tus sesiones. Tu información de salud se trata conforme al RGPD (base jurídica: tu consentimiento explícito, art. 9.2.a). · © 2026 Studio Renacer · Andrea Fernández, psicóloga colegiada n.º 27327.',
    },
  },

  en: {
    file: 'guide-private-area-studio-renacer',
    lang: 'en',
    brandTop: 'STUDIO RENACER',
    coverEyebrow: 'YOUR PRIVATE AREA · USER GUIDE',
    titleHtml: 'How your <em>private area</em> works',
    coverSubtitle: '(booking, video calls and more, step by step)',
    author: 'Andrea Fernández',
    authorLine: 'Studio Renacer',
    footerLeft: 'Studio Renacer ·Andrea Fernández ·licensed psychologist (reg. 27327)',
    tipLabel: 'TIP',
    intro: {
      eyebrow: 'WELCOME',
      title: 'Now you also manage your sessions online',
      lead: 'Your therapy stays exactly the same. The only change is that you now have a private space to book sessions, join video calls and keep everything to hand.',
      paras: [
        'I’ve put this guide together to make getting started easy. You don’t need to be tech-savvy: it’s just a few steps, and if anything goes wrong, message me and we’ll sort it out together.',
        'Your private area is at <strong>app.studiorenacer.com</strong>. It’s a secure, confidential space: only you and I have access to your information.',
      ],
    },
    steps: [
      { t: 'Activate your account',
        body: [
          'You’ll receive an email from <strong>Studio Renacer</strong> with the subject “Activate your account”. Open it and click the link.',
          'First you choose your <strong>password</strong> (at least 8 characters, with one capital letter and one number). Then you confirm the <strong>informed consent</strong>: it’s the same one you already signed with me on paper, now digital, so everything lives in one place.',
        ],
        tip: 'The email link expires for security. If yours has expired, just tell me and I’ll resend a fresh one right away.' },
      { t: 'Logging in each time',
        body: [
          'From then on, you always log in at <strong>app.studiorenacer.com</strong> with your email and password.',
          'Forgotten your password? On the login screen tap “Forgot your password?” and follow the steps in the email. No need to let me know.',
        ] },
      { t: 'Booking and managing appointments',
        body: [
          'On your dashboard, in the <strong>calendar</strong>, you’ll see the date and time of your already scheduled appointments.',
          'If you want to <strong>request another appointment or change one</strong>, you can do it right there: pick a free day and time (video call or in person) and I confirm it from my side; you’ll get an email with the date.',
          'And if you ever need to <strong>cancel</strong>, please remember the 24-hour cancellation policy set out in your service contract.',
        ],
        tip: 'When an appointment is confirmed you can add it to your calendar (Google, Apple…) with one click, so it doesn’t slip by.' },
      { t: 'Joining the video call',
        body: [
          'If your session is online, the <strong>video call link</strong> appears on the appointment itself. There’s nothing to install.',
          'A few minutes before the time, go into your private area, open the session and click the link. Find a quiet spot where you feel comfortable.',
        ] },
      { t: 'Your session pack',
        body: [
          'At the top you’ll see your <strong>pack</strong>: how many sessions you have and how many are left. It updates on its own as we go.',
          'That way you always know where you stand, without having to keep count yourself.',
        ] },
      { t: 'Your service contract',
        body: [
          'The contract we signed is also stored in your private area, in the contract section, so you can <strong>view or download it</strong> whenever you need to.',
        ] },
      { t: 'Your data and your rights',
        body: [
          'Your information is confidential and stored encrypted on European servers. At any time you can <strong>export all your data</strong> from your private area (export button), and exercise your rights of access, rectification or erasure.',
          'For anything to do with your data, write to me at <strong>info@studiorenacer.com</strong>.',
        ] },
    ],
    rules: {
      eyebrow: 'BEFORE YOUR SESSION',
      title: 'How to set up your video call',
      lead: 'A few small details make an online session as comfortable and useful as an in-person one.',
      groups: [
        { label: 'YOUR DEVICE AND YOUR SPACE', items: [
          { t: 'Good connection and battery', d: 'Connect where you have a stable internet signal, with your device charged or plugged in, so the session doesn’t drop.' },
          { t: 'Make sure you’re well seen', d: 'Place the camera so your face and body are visible at least from the chest up, with light in front of you (avoid having the window behind you).' },
          { t: 'Headphones are better', d: 'Preferably with headphones: the sound is clearer and it adds privacy.' },
          { t: 'A private, safe place', d: 'Find a quiet space where you’re on your own and no one can interrupt or overhear you.' },
        ] },
        { label: 'DURING THE SESSION', items: [
          { t: 'No distractions', d: 'Phone on silent, and avoid doing other things while we talk.' },
          { t: 'Confidentiality', d: 'The session is private: be on your own and don’t record it or take screenshots.' },
          { t: 'Get comfortable', d: 'Keep water and tissues within reach and settle somewhere you can talk calmly.' },
        ] },
      ],
      note: 'And above all: this is your space, free of judgement. Speak as freely as you need to.',
    },
    end: {
      eyebrow: 'QUESTIONS?',
      title: 'I’m just one message away',
      lead: 'If any step doesn’t work or you have any doubt, don’t wrestle with the screen: message me and we’ll fix it in no time.',
      ctaHeading: 'Message me anytime',
      ctaLine: 'I’m happy to help you take the first step.',
      signature: '— Andrea Fernández · Studio Renacer',
      disclaimer: 'This guide explains how to use your private area; it is not a consultation and does not replace your sessions. Your health information is processed under the GDPR (legal basis: your explicit consent, art. 9.2.a). · © 2026 Studio Renacer · Andrea Fernández, licensed psychologist reg. no. 27327.',
    },
  },

  da: {
    file: 'guide-privat-omraade-studio-renacer',
    lang: 'da',
    brandTop: 'STUDIO RENACER',
    coverEyebrow: 'DIT PRIVATE OMRÅDE · BRUGERGUIDE',
    titleHtml: 'Sådan fungerer dit <em>private område</em>',
    coverSubtitle: '(bestil tid, videoopkald og mere, trin for trin)',
    author: 'Andrea Fernández',
    authorLine: 'Studio Renacer',
    footerLeft: 'Studio Renacer ·Andrea Fernández ·autoriseret psykolog (reg. 27327)',
    tipLabel: 'TIP',
    intro: {
      eyebrow: 'VELKOMMEN',
      title: 'Nu styrer du også dine sessioner online',
      lead: 'Din terapi er præcis den samme. Det eneste, der ændrer sig, er, at du nu har et privat rum til at bestille tider, deltage i videoopkald og have dine ting ved hånden.',
      paras: [
        'Jeg har lavet denne guide for at gøre det nemt at komme i gang. Du behøver ikke være teknisk: det er få trin, og hvis noget driller, skriver du til mig, og vi ser på det sammen.',
        'Dit private område findes på <strong>app.studiorenacer.com</strong>. Det er et sikkert og fortroligt rum: kun du og jeg har adgang til dine oplysninger.',
      ],
    },
    steps: [
      { t: 'Aktivér din konto',
        body: [
          'Du modtager en e-mail fra <strong>Studio Renacer</strong> med emnet «Aktivér din konto». Åbn den og klik på linket.',
          'Først vælger du din <strong>adgangskode</strong> (mindst 8 tegn, med et stort bogstav og et tal). Derefter bekræfter du det <strong>informerede samtykke</strong>: det er det samme, du allerede har underskrevet hos mig på papir, nu digitalt, så alt er ét sted.',
        ],
        tip: 'Linket i e-mailen udløber af sikkerhedshensyn. Er dit udløbet, så sig til, og jeg sender straks et nyt.' },
      { t: 'At logge ind hver gang',
        body: [
          'Fra da af logger du altid ind på <strong>app.studiorenacer.com</strong> med din e-mail og adgangskode.',
          'Glemt din adgangskode? På login-skærmen trykker du på «Glemt din adgangskode?» og følger trinnene i e-mailen. Du behøver ikke sige det til mig.',
        ] },
      { t: 'Bestil og styr dine tider',
        body: [
          'På dit overblik ser du i <strong>kalenderen</strong> dato og tid for dine allerede planlagte aftaler.',
          'Vil du <strong>bestille en ny tid eller ændre en</strong>, kan du gøre det samme sted: vælg en ledig dag og tid (video eller fysisk), og jeg bekræfter den fra min side; du får en e-mail med datoen.',
          'Og hvis du engang får brug for at <strong>aflyse</strong>, så husk 24-timers afbestillingspolitikken, der står i din servicekontrakt.',
        ],
        tip: 'Når en tid bekræftes, kan du tilføje den til din kalender (Google, Apple…) med ét klik, så den ikke glipper.' },
      { t: 'Deltag i videoopkaldet',
        body: [
          'Hvis din session er online, vises <strong>linket til videoopkaldet</strong> på selve tiden. Der er intet at installere.',
          'Et par minutter før tid går du ind i dit private område, åbner sessionen og klikker på linket. Find et roligt sted, hvor du føler dig godt tilpas.',
        ] },
      { t: 'Din session-pakke',
        body: [
          'Øverst ser du din <strong>pakke</strong>: hvor mange sessioner du har, og hvor mange der er tilbage. Den opdateres af sig selv, efterhånden som vi holder dem.',
          'Sådan ved du altid, hvor du står, uden selv at skulle holde regnskab.',
        ] },
      { t: 'Din servicekontrakt',
        body: [
          'Den kontrakt, vi underskrev, gemmes også i dit private område i kontrakt-afsnittet, så du kan <strong>se eller downloade den</strong>, når du har brug for det.',
        ] },
      { t: 'Dine data og dine rettigheder',
        body: [
          'Dine oplysninger er fortrolige og gemmes krypteret på europæiske servere. Når som helst kan du <strong>eksportere alle dine data</strong> fra dit private område (eksport-knap) og udøve dine rettigheder til indsigt, berigtigelse eller sletning.',
          'For alt vedrørende dine data, skriv til mig på <strong>info@studiorenacer.com</strong>.',
        ] },
    ],
    rules: {
      eyebrow: 'FØR DIN SESSION',
      title: 'Sådan gør du klar til dit videoopkald',
      lead: 'Nogle få små detaljer gør en online-session lige så behagelig og nyttig som en fysisk.',
      groups: [
        { label: 'DIT UDSTYR OG DIT RUM', items: [
          { t: 'God forbindelse og batteri', d: 'Log på et sted med stabilt internet og med enheden opladet eller i stikket, så sessionen ikke afbrydes.' },
          { t: 'Sørg for at ses godt', d: 'Placer kameraet, så dit ansigt og din krop ses mindst fra brystet og op, med lys forfra (undgå at have vinduet bag dig).' },
          { t: 'Høretelefoner er bedst', d: 'Helst med høretelefoner: lyden er klarere, og det giver mere privatliv.' },
          { t: 'Et privat og trygt sted', d: 'Find et roligt rum, hvor du er alene, og hvor ingen kan afbryde eller høre dig.' },
        ] },
        { label: 'UNDER SESSIONEN', items: [
          { t: 'Ingen forstyrrelser', d: 'Telefonen på lydløs, og undgå at lave andre ting, mens vi taler.' },
          { t: 'Fortrolighed', d: 'Sessionen er privat: vær alene, og optag den ikke, og tag ikke skærmbilleder.' },
          { t: 'Gør dig det behageligt', d: 'Hav vand og lommetørklæder ved hånden, og sæt dig et sted, hvor du kan tale i ro.' },
        ] },
      ],
      note: 'Og frem for alt: det er dit rum, uden fordømmelse. Tal så frit, som du har brug for.',
    },
    end: {
      eyebrow: 'SPØRGSMÅL?',
      title: 'Jeg er kun én besked væk',
      lead: 'Hvis et trin ikke lykkes, eller du er i tvivl om noget, så kæmp ikke med skærmen: skriv til mig, så løser vi det med det samme.',
      ctaHeading: 'Skriv til mig når som helst',
      ctaLine: 'Jeg hjælper dig gerne med at tage det første skridt.',
      signature: '— Andrea Fernández · Studio Renacer',
      disclaimer: 'Denne guide forklarer, hvordan du bruger dit private område; den er ikke en konsultation og erstatter ikke dine sessioner. Dine helbredsoplysninger behandles efter GDPR (retsgrundlag: dit udtrykkelige samtykke, art. 9.2.a). · © 2026 Studio Renacer · Andrea Fernández, autoriseret psykolog reg.nr. 27327.',
    },
  },
};

// ---------- Plantilla ----------
const CSS = `
  @page { size:210mm 297mm; margin:0; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  :root{
    --paper:#F8F1E3; --ink:#5B4128; --brown:#5B4128; --body:#5B4128;
    --muted:#7A6A53; --oro:#E3A52A; --ocre:#B07A2B; --green:#3B6D2A; --red:#A33B2D;
    --card:#FFFFFF; --line:rgba(91,65,40,.14); --cream:#F8F1E3; --cream-muted:#C9A671;
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
  strong{ color:var(--ink); }
  .footer{ position:absolute; left:22mm; right:22mm; bottom:12mm;
    font-family:var(--sans); font-size:7.5pt; color:#9A8B73;
    display:flex; justify-content:space-between; }

  /* ---------- Portada ---------- */
  .cover{ background:var(--brown); color:var(--cream); display:flex; flex-direction:column; padding:24mm 24mm 22mm; }
  .cover .brandtop{ font-family:var(--sans); font-size:11pt; font-weight:700;
    letter-spacing:.42em; color:var(--oro); }
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

  /* ---------- Pasos ---------- */
  .step{ margin-top:15pt; }
  .step:first-of-type{ margin-top:6pt; }
  .step-head{ display:flex; align-items:center; gap:11pt; margin-bottom:8pt; }
  .num{ flex:0 0 auto; width:22pt; height:22pt; border-radius:50%; background:var(--oro); color:var(--brown);
    font-family:var(--sans); font-weight:600; font-size:10.5pt; display:flex; align-items:center; justify-content:center; }
  .step-head h3{ font-family:var(--display); font-weight:700; font-size:14.5pt; color:var(--ink); line-height:1.15; }
  .lbl{ font-family:var(--sans); font-size:8pt; font-weight:700; letter-spacing:.16em;
    text-transform:uppercase; color:var(--ocre); margin:9pt 0 4pt; }
  .tip{ background:var(--card); border:1px solid var(--line); border-left:4px solid var(--oro);
    border-radius:9px; padding:11pt 14pt 4pt; margin-top:11pt; }
  .tip .lbl{ margin-top:0; }
  .divider{ border:none; border-top:1px solid var(--line); margin:15pt 0 0; }

  /* ---------- Reglas de la sesión ---------- */
  .rules-group{ margin-top:15pt; }
  .rules-group .glabel{ font-family:var(--sans); font-size:9pt; font-weight:700; letter-spacing:.18em;
    text-transform:uppercase; color:var(--ocre); margin-bottom:7pt; padding-bottom:5pt; border-bottom:1px solid var(--line); }
  .rule{ display:flex; gap:10pt; align-items:flex-start; margin-top:9pt; }
  .rule .chk{ flex:0 0 auto; width:16pt; height:16pt; border-radius:50%; background:var(--oro); color:var(--brown);
    font-family:var(--sans); font-weight:700; font-size:9pt; display:flex; align-items:center; justify-content:center; margin-top:1.5pt; }
  .rule .rbody{ flex:1; }
  .rule .rt{ font-weight:700; color:var(--ink); }
  .rules-note{ background:var(--card); border:1px solid var(--line); border-left:4px solid var(--oro);
    border-radius:9px; padding:12pt 15pt; margin-top:16pt; font-style:italic; color:#6B4F2E; }

  /* ---------- Página final ---------- */
  .cta-box{ background:var(--brown); color:var(--cream); border-radius:12px; padding:17pt 20pt; margin-top:6pt; }
  .cta-box h3{ font-family:var(--display); font-weight:700; font-size:16pt; color:var(--cream); margin-bottom:8pt; }
  .cta-box .cta-line{ color:var(--cream); margin-bottom:8pt; }
  .cta-box .cta-channels{ font-family:var(--sans); font-size:9.5pt; line-height:1.9; color:var(--cream); margin-bottom:0; }
  .cta-box a{ color:var(--oro); font-weight:700; text-decoration:none; }
  .cta-box .sep{ color:#7d6a4e; margin:0 3pt; }
  .signature{ font-family:var(--display); font-style:italic; font-size:12pt; color:#6B4F2E; margin:16pt 0 0; }
  .disclaimer{ font-family:var(--sans); font-size:7.5pt; line-height:1.55; color:#8A7C64; margin-top:14pt; }
`;

function stepHtml(s, n, tipLabel, withDivider = true) {
  const bodyHtml = s.body.map((p) => `<p>${p}</p>`).join('');
  const tipHtml = s.tip
    ? `<div class="tip"><div class="lbl">${tipLabel}</div><p>${s.tip}</p></div>`
    : '';
  return `
    <section class="step">
      <div class="step-head"><span class="num">${n}</span><h3>${s.t}</h3></div>
      ${bodyHtml}
      ${tipHtml}
    </section>${withDivider ? '\n    <hr class="divider">' : ''}`;
}

function rulesPageHtml(r) {
  const groups = r.groups.map((g) => `
    <div class="rules-group">
      <div class="glabel">${g.label}</div>
      ${g.items.map((it) => `<div class="rule"><span class="chk">✓</span><div class="rbody"><span class="rt">${it.t}.</span> ${it.d}</div></div>`).join('')}
    </div>`).join('');
  return `
  <div class="eyebrow">${r.eyebrow}</div>
  <h2>${r.title}</h2>
  <p class="lead">${r.lead}</p>
  ${groups}
  <div class="rules-note">${r.note}</div>`;
}

function render(d) {
  const i = d.intro;
  const e = d.end;
  const footer = (n) => `<div class="footer"><span>${d.footerLeft}</span><span>${CONTACT.app} ·${n}</span></div>`;

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
    <div class="web">${CONTACT.app}</div>
  </div>
</div>

<div class="page">
  <div class="eyebrow">${i.eyebrow}</div>
  <h2>${i.title}</h2>
  <p class="lead">${i.lead}</p>
  ${i.paras.map((p) => `<p>${p}</p>`).join('')}
  ${stepHtml(d.steps[0], 1, d.tipLabel, true)}
  ${stepHtml(d.steps[1], 2, d.tipLabel, false)}
  ${footer(2)}
</div>

<div class="page">
  ${stepHtml(d.steps[2], 3, d.tipLabel, true)}
  ${stepHtml(d.steps[3], 4, d.tipLabel, false)}
  ${footer(3)}
</div>

<div class="page">
  ${stepHtml(d.steps[4], 5, d.tipLabel, true)}
  ${stepHtml(d.steps[5], 6, d.tipLabel, true)}
  ${stepHtml(d.steps[6], 7, d.tipLabel, false)}
  ${footer(4)}
</div>

<div class="page">
  ${rulesPageHtml(d.rules)}
  ${footer(5)}
</div>

<div class="page">
  <div class="eyebrow">${e.eyebrow}</div>
  <h2>${e.title}</h2>
  <p class="lead" style="font-style:normal;color:var(--body)">${e.lead}</p>
  <div class="cta-box">
    <h3>${e.ctaHeading}</h3>
    <p class="cta-line">${e.ctaLine}</p>
    <p class="cta-channels">${channelsHtml()}</p>
  </div>
  <p class="signature">${e.signature}</p>
  <p class="disclaimer">${e.disclaimer}</p>
  ${footer(6)}
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
